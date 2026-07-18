const { PrismaClient } = require('@prisma/client');
const midtransClient = require('midtrans-client');
const { getProductPrice } = require('../utils/productDiscount');
const { reserveQueue } = require('../utils/orderQueue');
const prisma = new PrismaClient();

// Inisialisasi Midtrans Snap
const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

/**
 * HELPER: Generate Invoice Number Otomatis dengan Suffix Unik
 * Menghindari error 'Order ID already taken' di Midtrans.
 */
const generateInvoiceNumber = async (tx) => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}${mm}${dd}`;

    const lastTransaction = await tx.transaction.findFirst({
        where: { invoiceNumber: { contains: `INV/${todayStr}` } },
        orderBy: { id: 'desc' }
    });

    let sequence = 1;
    if (lastTransaction) {
        const parts = lastTransaction.invoiceNumber.split('/');
        if (parts.length >= 3) {
            const cleanSeq = parts[2].split('-')[0];
            sequence = parseInt(cleanSeq) + 1;
        }
    }

    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `INV/${todayStr}/${String(sequence).padStart(4, '0')}-${randomSuffix}`;
};

/**
 * 1. CREATE TRANSACTION (CHECKOUT)
 */
exports.createTransaction = async (req, res) => {
    try {
        const {
            userId, customerId, customerName, items, payment,
            orderType, tableNumber, note,
            preOrderDate, discountAmount, discountType, takeawayOption,
            loyaltyPointsRedeemed, sourceOrderCode
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Keranjang kosong!" });
        }

        const result = await prisma.$transaction(async (tx) => {
            let subTotal = 0;
            const transactionItemsData = [];
            const itemDetailsForMidtrans = [];
            const kitchenItems = [];
            const stockDeductions = new Map();
            const addStockDeduction = (product, qty) => {
                const current = stockDeductions.get(product.id);
                stockDeductions.set(product.id, { product, qty: (current?.qty || 0) + qty });
            };

            // Validasi produk dan hitung total
            for (const item of items) {
                const requestedQty = Math.max(1, parseInt(item.qty) || 1);
                const packageId = parseInt(item.packageId) || (String(item.productId || '').startsWith('pkg-') ? parseInt(String(item.productId).replace('pkg-', '')) : null);

                if (packageId) {
                    const pkg = await tx.package.findUnique({
                        where: { id: packageId },
                        include: { items: { include: { product: true } } }
                    });
                    if (!pkg || !pkg.isActive || pkg.items.length === 0) throw new Error('Paket produk tidak tersedia.');

                    const packagePrice = Number(pkg.price);
                    subTotal += packagePrice * requestedQty;
                    pkg.items.forEach((packageItem, index) => {
                        const componentQty = packageItem.qty * requestedQty;
                        addStockDeduction(packageItem.product, componentQty);
                        transactionItemsData.push({
                            productId: packageItem.productId,
                            qty: componentQty,
                            price: index === 0 ? packagePrice / packageItem.qty : 0,
                            originalPrice: index === 0 ? packagePrice / packageItem.qty : 0,
                            discountAmount: 0,
                            costPrice: packageItem.product.costPrice,
                            notes: `[Paket ${pkg.name}] ${item.notes || ''}`.trim()
                        });
                    });
                    kitchenItems.push({
                        packageId: pkg.id,
                        name: `[Paket] ${pkg.name}`,
                        qty: requestedQty,
                        price: packagePrice,
                        notes: item.notes || null,
                        components: pkg.items.map(packageItem => ({ name: packageItem.product.name, qty: packageItem.qty }))
                    });
                    itemDetailsForMidtrans.push({ id: `PKG-${pkg.id}`, price: Math.round(packagePrice), quantity: requestedQty, name: pkg.name.substring(0, 50) });
                    continue;
                }

                const product = await tx.product.findUnique({ where: { id: parseInt(item.productId) } });

                if (!product || !product.isActive) {
                    throw new Error(`Produk tidak valid.`);
                }
                // Skip stock check for unlimited stock products
                if (!product.isUnlimitedStock && product.stock < requestedQty) {
                    throw new Error(`Stok ${product.name} tidak mencukupi.`);
                }

                const priceInfo = getProductPrice(product);
                const price = priceInfo.effectivePrice;
                subTotal += price * requestedQty;
                addStockDeduction(product, requestedQty);

                transactionItemsData.push({
                    productId: product.id,
                    qty: requestedQty,
                    price,
                    originalPrice: priceInfo.originalPrice,
                    discountAmount: priceInfo.discountAmount,
                    costPrice: product.costPrice,
                    notes: item.notes || null
                });

                kitchenItems.push({
                    productId: product.id,
                    name: product.name,
                    qty: requestedQty,
                    price,
                    originalPrice: priceInfo.originalPrice,
                    discountAmount: priceInfo.discountAmount,
                    notes: item.notes || null
                });

                itemDetailsForMidtrans.push({
                    id: product.sku || product.id.toString(),
                    price: Math.round(price),
                    quantity: requestedQty,
                    name: product.name.substring(0, 50)
                });
            }

            for (const { product, qty } of stockDeductions.values()) {
                if (!product.isUnlimitedStock && product.stock < qty) {
                    throw new Error(`Stok ${product.name} tidak mencukupi.`);
                }
            }

            // Hitung pajak
            const setting = await tx.storeSetting.findFirst();
            const taxRate = setting?.taxRate ? Number(setting.taxRate) / 100 : 0;

            // Calculate discount (support percent and amount modes)
            let discount = 0;
            if (discountType === 'percent') {
                discount = subTotal * (parseFloat(discountAmount) / 100);
            } else {
                discount = parseFloat(discountAmount) || 0;
            }

            // Loyalty points redemption discount
            let loyaltyDiscount = 0;
            if (parseInt(loyaltyPointsRedeemed) > 0 && customerId) {
                const loyaltyConfig = await tx.loyaltyConfig.findFirst({ where: { isActive: true } });
                if (loyaltyConfig) {
                    const customer = await tx.customer.findUnique({ where: { id: parseInt(customerId) } });
                    if (customer && customer.points >= parseInt(loyaltyPointsRedeemed) && parseInt(loyaltyPointsRedeemed) >= loyaltyConfig.minRedemptionPoints) {
                        loyaltyDiscount = parseInt(loyaltyPointsRedeemed) * Number(loyaltyConfig.pointValue);
                        discount += loyaltyDiscount;
                    }
                }
            }

            const taxableAmount = subTotal - discount;
            const taxAmount = Math.round(taxableAmount * taxRate);
            const grandTotal = taxableAmount + taxAmount;

            // Generate Invoice unik
            const invoiceNumber = await generateInvoiceNumber(tx);

            // Tambahkan pajak ke item details Midtrans
            if (taxAmount > 0) {
                itemDetailsForMidtrans.push({
                    id: 'TAX-PPN',
                    price: taxAmount,
                    quantity: 1,
                    name: `Pajak (PPN ${setting.taxRate || 0}%)`
                });
            }

            const isInstantPayment = payment.type === 'CASH' || payment.type === 'QRIS_MANUAL';
            const initialStatus = isInstantPayment ? 'PAID' : 'PENDING';
            const paymentStatus = isInstantPayment ? 'SETTLEMENT' : 'PENDING';

            // HANYA KURANGI STOCK JIKA PAYMENT = CASH ATAU QRIS_MANUAL
            if (isInstantPayment) {
                for (const { product, qty } of stockDeductions.values()) {
                    // Skip stock deduction for unlimited stock products
                    if (!product.isUnlimitedStock) {
                        await tx.product.update({
                            where: { id: product.id },
                            data: { stock: product.stock - qty }
                        });
                    }

                    await tx.stockMovement.create({
                        data: {
                            productId: product.id,
                            type: 'OUT',
                            qty,
                            source: 'SALE',
                            description: `Penjualan ${payment.type} - ${invoiceNumber}`
                        }
                    });
                }
            }

            // Buat transaksi
            const newTransaction = await tx.transaction.create({
                data: {
                    userId: parseInt(userId),
                    customerId: customerId ? parseInt(customerId) : null,
                    customerName: takeawayOption ? `${customerName || 'Umum'} (${takeawayOption})` : (customerName || null),
                    invoiceNumber,
                    subTotal,
                    taxAmount,
                    discountAmount: discount,
                    grandTotal,
                    cashAmount: payment.cashAmount != null ? parseFloat(payment.cashAmount) : null,
                    changeAmount: payment.changeAmount != null ? parseFloat(payment.changeAmount) : null,
                    status: initialStatus,
                    orderType: orderType || 'DINE_IN',
                    tableNumber: tableNumber || null,
                    note: note || null,
                    preOrderDate: preOrderDate ? new Date(preOrderDate) : null,
                    preOrderConfirmed: false,
                    items: { create: transactionItemsData },
                    payments: {
                        create: {
                            paymentType: payment.type,
                            amount: grandTotal,
                            paymentStatus: paymentStatus
                        }
                    }
                },
                include: { items: true, payments: true }
            });

            let kitchenQueue = null;
            if (isInstantPayment && (orderType || 'DINE_IN') !== 'PRE_ORDER') {
                if (sourceOrderCode) {
                    const existingKitchenOrder = await tx.kitchenOrder.findUnique({
                        where: { orderCode: String(sourceOrderCode) }
                    });
                    if (!existingKitchenOrder) {
                        throw new Error('Antrean order meja tidak ditemukan. Muat ulang Order Meja lalu coba lagi.');
                    }
                    if (['CANCELLED', 'COMPLETED'].includes(existingKitchenOrder.status)) {
                        throw new Error(`Order meja sudah berstatus ${existingKitchenOrder.status === 'CANCELLED' ? 'dibatalkan' : 'selesai'}.`);
                    }

                    kitchenQueue = {
                        queueDate: existingKitchenOrder.queueDate,
                        queueNumber: existingKitchenOrder.queueNumber,
                        queueLabel: existingKitchenOrder.queueLabel
                    };
                    await tx.kitchenOrder.update({
                        where: { id: existingKitchenOrder.id },
                        data: {
                            status: existingKitchenOrder.status === 'NEW' ? 'PREPARING' : existingKitchenOrder.status,
                            startedAt: existingKitchenOrder.startedAt || new Date(),
                            tableNumber: tableNumber || existingKitchenOrder.tableNumber,
                            customerName: customerName || existingKitchenOrder.customerName,
                            note: note || existingKitchenOrder.note,
                            total: grandTotal,
                            itemsJson: JSON.stringify(kitchenItems),
                            transactionId: newTransaction.id
                        }
                    });
                } else {
                    kitchenQueue = await reserveQueue(tx);
                    await tx.kitchenOrder.create({
                        data: {
                            source: 'POS',
                            orderCode: invoiceNumber,
                            ...kitchenQueue,
                            tableNumber: tableNumber || null,
                            customerName: customerName || null,
                            note: note || null,
                            total: grandTotal,
                            itemsJson: JSON.stringify(kitchenItems),
                            transactionId: newTransaction.id
                        }
                    });
                }
            }

            // Loyalty points earning
            if (customerId && isInstantPayment) {
                const loyaltyConfig = await tx.loyaltyConfig.findFirst({ where: { isActive: true } });
                if (loyaltyConfig) {
                    const earnedPoints = Math.floor(Number(grandTotal) / Number(loyaltyConfig.multiplierAmount)) * Number(loyaltyConfig.pointMultiplier);
                    const pointsChange = earnedPoints - (parseInt(loyaltyPointsRedeemed) || 0);

                    await tx.customer.update({
                        where: { id: parseInt(customerId) },
                        data: { points: { increment: pointsChange } }
                    });
                }
            }

            // Update table status if dine-in
            if (orderType === 'DINE_IN' && tableNumber) {
                const dineTable = await tx.dineTable.findUnique({ where: { number: tableNumber } });
                if (dineTable) {
                    await tx.dineTable.update({
                        where: { id: dineTable.id },
                        data: {
                            status: 'OCCUPIED',
                            occupiedAt: dineTable.occupiedAt || new Date(),
                            statusUpdatedAt: dineTable.status === 'OCCUPIED'
                                ? dineTable.statusUpdatedAt
                                : new Date()
                        }
                    });
                }
            }

            let midtransToken = null;
            let midtransUrl = null;

            // Buat transaksi Midtrans jika bukan CASH / QRIS_MANUAL
            if (!isInstantPayment) {
                const parameter = {
                    transaction_details: {
                        order_id: invoiceNumber,
                        gross_amount: Math.round(grandTotal)
                    },
                    item_details: itemDetailsForMidtrans,
                    credit_card: { secure: true },
                    enabled_payments: ['gopay', 'other_qris', 'shopeepay']
                };

                try {
                    const transaction = await snap.createTransaction(parameter);
                    midtransToken = transaction.token;
                    midtransUrl = transaction.redirect_url;

                    console.log('[OK] Midtrans transaction created:', invoiceNumber);
                } catch (midtransErr) {
                    console.error('[ERROR] Midtrans Error:', midtransErr.message);
                    throw new Error(`Gagal membuat payment link: ${midtransErr.message}`);
                }
            }

            return { ...newTransaction, ...kitchenQueue, midtransToken, midtransUrl };
        }, {
            timeout: 10000
        });

        res.status(201).json({
            success: true,
            message: "Transaksi berhasil dibuat!",
            data: result
        });

    } catch (error) {
        console.error('[ERROR] Transaction Error:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * 2. GET ALL TRANSACTIONS
 */
exports.getAllTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search, preOrder, startDate, endDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const whereClause = {};

        if (status) whereClause.status = status;
        if (search) whereClause.invoiceNumber = { contains: search };
        if (preOrder === 'true') whereClause.preOrderDate = { not: null };
        if (startDate && endDate) {
            whereClause.createdAt = {
                gte: new Date(startDate + 'T00:00:00'),
                lte: new Date(endDate + 'T23:59:59')
            };
        }

        const [transactions, total] = await prisma.$transaction([
            prisma.transaction.findMany({
                where: whereClause,
                include: {
                    user: { select: { name: true } },
                    customer: { select: { name: true } },
                    payments: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.transaction.count({ where: whereClause })
        ]);

        res.json({
            success: true,
            data: transactions,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[ERROR] Get Transactions Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 3. GET TRANSACTION BY ID
 */
exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: { select: { name: true } },
                customer: { select: { name: true, phone: true } },
                items: { include: { product: { select: { name: true, sku: true } } } },
                payments: true
            }
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaksi tidak ditemukan"
            });
        }

        const storeSettings = await prisma.storeSetting.findFirst();
        res.json({
            success: true,
            data: transaction,
            store: storeSettings
        });
    } catch (error) {
        console.error('[ERROR] Get Transaction Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 4. WEBHOOK HANDLER - PENTING: Ini yang sinkronkan status payment
 */
exports.handleMidtransNotification = async (req, res) => {
    try {
        console.log('[WEBHOOK] Midtrans notification received');
        console.log("Body:", JSON.stringify(req.body, null, 2));

        const notification = await snap.transaction.notification(req.body);
        const orderId = notification.order_id;
        const transactionStatus = notification.transaction_status;
        const fraudStatus = notification.fraud_status;
        const transactionId = notification.transaction_id;

        console.log(`[WEBHOOK] Order: ${orderId} | Status: ${transactionStatus} | Fraud: ${fraudStatus}`);

        // Cari transaksi
        const transaction = await prisma.transaction.findUnique({
            where: { invoiceNumber: orderId },
            include: { items: true, payments: true }
        });

        if (!transaction) {
            console.error('[ERROR] Transaction not found:', orderId);
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        // Mapping status
        let newStatus = '';
        let paymentStatus = '';

        if (transactionStatus === 'capture') {
            if (fraudStatus === 'challenge') {
                newStatus = 'PENDING';
                paymentStatus = 'PENDING';
            } else if (fraudStatus === 'accept') {
                newStatus = 'PAID';
                paymentStatus = 'SETTLEMENT';
            }
        } else if (transactionStatus === 'settlement') {
            newStatus = 'PAID';
            paymentStatus = 'SETTLEMENT';
        } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
            newStatus = 'CANCELLED';
            paymentStatus = 'FAILED';
        } else if (transactionStatus === 'pending') {
            newStatus = 'PENDING';
            paymentStatus = 'PENDING';
        }

        if (!newStatus) {
            console.log('[WARN] Unknown status, skipping update');
            return res.status(200).json({ status: 'OK', message: 'Unknown status' });
        }

        // Update database dalam satu transaksi
        await prisma.$transaction(async (tx) => {
            // Update transaction status
            await tx.transaction.update({
                where: { invoiceNumber: orderId },
                data: { status: newStatus }
            });

            // Update payment status - PERBAIKAN QUERY
            await tx.payment.updateMany({
                where: { transactionId: transaction.id },
                data: {
                    paymentStatus: paymentStatus,
                    referenceId: transactionId
                }
            });

            // JIKA PAID, KURANGI STOCK (untuk non-CASH payment)
            if (newStatus === 'PAID' && transaction.status !== 'PAID') {
                console.log('[OK] Payment confirmed! Reducing stock...');

                for (const item of transaction.items) {
                    const product = await tx.product.findUnique({
                        where: { id: item.productId }
                    });

                    if (product) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: product.stock - item.qty }
                        });

                        await tx.stockMovement.create({
                            data: {
                                productId: item.productId,
                                type: 'OUT',
                                qty: item.qty,
                                source: 'SALE',
                                description: `Penjualan QRIS/Digital - ${orderId}`
                            }
                        });

                        console.log(`  [OK] ${product.name}: ${product.stock} -> ${product.stock - item.qty}`);
                    }
                }
            }

            // JIKA CANCELLED/EXPIRED, CEK APAKAH PERLU ROLLBACK STOCK
            if (newStatus === 'CANCELLED' && transaction.status === 'PAID') {
                console.log('[INFO] Transaction cancelled after payment, restoring stock...');

                // Cari stock movements yang terkait
                const movements = await tx.stockMovement.findMany({
                    where: {
                        description: { contains: orderId },
                        type: 'OUT'
                    }
                });

                for (const movement of movements) {
                    const product = await tx.product.findUnique({
                        where: { id: movement.productId }
                    });

                    if (product) {
                        await tx.product.update({
                            where: { id: movement.productId },
                            data: { stock: product.stock + movement.qty }
                        });

                        await tx.stockMovement.create({
                            data: {
                                productId: movement.productId,
                                type: 'IN',
                                qty: movement.qty,
                                source: 'RETURN',
                                description: `Rollback pembatalan - ${orderId}`
                            }
                        });

                        console.log(`  [OK] Restored ${product.name}: ${product.stock} -> ${product.stock + movement.qty}`);
                    }
                }
            }
        });

        console.log(`[OK] [WEBHOOK] Invoice ${orderId} updated: ${newStatus}`);
        res.status(200).json({ status: 'OK' });

    } catch (error) {
        console.error('[ERROR] [WEBHOOK]:', error.message);
        console.error(error.stack);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 5. CHECK STATUS MANUAL (untuk debugging)
 */
exports.checkTransactionStatus = async (req, res) => {
    try {
        const { invoiceNumber } = req.params;

        // Check di Midtrans
        const statusResponse = await snap.transaction.status(invoiceNumber);
        console.log('Midtrans Status:', statusResponse);

        // Update database
        const transaction = await prisma.transaction.findUnique({
            where: { invoiceNumber: invoiceNumber },
            include: { payments: true, items: true }
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaksi tidak ditemukan'
            });
        }

        let newStatus = '';
        let paymentStatus = '';

        if (statusResponse.transaction_status === 'settlement') {
            newStatus = 'PAID';
            paymentStatus = 'SETTLEMENT';
        } else if (statusResponse.transaction_status === 'pending') {
            newStatus = 'PENDING';
            paymentStatus = 'PENDING';
        } else if (['cancel', 'deny', 'expire'].includes(statusResponse.transaction_status)) {
            newStatus = 'CANCELLED';
            paymentStatus = 'FAILED';
        }

        if (newStatus && transaction.status !== newStatus) {
            await prisma.$transaction(async (tx) => {
                await tx.transaction.update({
                    where: { invoiceNumber: invoiceNumber },
                    data: { status: newStatus }
                });

                await tx.payment.updateMany({
                    where: { transactionId: transaction.id },
                    data: {
                        paymentStatus: paymentStatus,
                        referenceId: statusResponse.transaction_id
                    }
                });

                // Kurangi stock jika baru jadi PAID
                if (newStatus === 'PAID' && transaction.status !== 'PAID') {
                    for (const item of transaction.items) {
                        const product = await tx.product.findUnique({
                            where: { id: item.productId }
                        });

                        if (product) {
                            await tx.product.update({
                                where: { id: item.productId },
                                data: { stock: product.stock - item.qty }
                            });

                            await tx.stockMovement.create({
                                data: {
                                    productId: item.productId,
                                    type: 'OUT',
                                    qty: item.qty,
                                    source: 'SALE',
                                    description: `Manual Check - ${invoiceNumber}`
                                }
                            });
                        }
                    }
                }
            });
        }

        res.json({
            success: true,
            message: 'Status checked and updated',
            data: {
                midtransStatus: statusResponse.transaction_status,
                databaseStatus: newStatus,
                updated: transaction.status !== newStatus
            }
        });

    } catch (error) {
        console.error('[ERROR] Check Status Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * 6. RETURN TRANSACTION — Mark as RETURNED and revert stock
 */
exports.returnTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) },
            include: { items: true }
        });

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
        }

        if (transaction.status === 'RETURNED') {
            return res.status(400).json({ success: false, message: "Transaksi sudah diretur" });
        }

        if (transaction.status === 'CANCELLED') {
            return res.status(400).json({ success: false, message: "Tidak bisa meretur transaksi yang sudah dibatalkan" });
        }

        await prisma.$transaction(async (tx) => {
            // Update transaction status
            await tx.transaction.update({
                where: { id: parseInt(id) },
                data: { status: 'RETURNED' }
            });

            // Revert stock
            for (const item of transaction.items) {
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (product && !product.isUnlimitedStock) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: product.stock + item.qty }
                    });
                }

                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        type: 'IN',
                        qty: item.qty,
                        source: 'RETURN',
                        description: `Retur transaksi - ${transaction.invoiceNumber}`
                    }
                });
            }

            // Setelah transaksi dine-in selesai/retur, meja perlu dibersihkan sebelum dipakai lagi.
            if (transaction.orderType === 'DINE_IN' && transaction.tableNumber) {
                await tx.dineTable.updateMany({
                    where: { number: transaction.tableNumber },
                    data: { status: 'CLEANING', statusUpdatedAt: new Date() }
                });
            }
        });

        res.json({ success: true, message: "Transaksi berhasil diretur, stok dikembalikan" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 7. GET PRE-ORDERS — List upcoming pre-orders
 */
exports.getPreOrders = async (req, res) => {
    try {
        const preOrders = await prisma.transaction.findMany({
            where: {
                preOrderDate: { not: null },
                preOrderConfirmed: false,
                status: { in: ['PAID', 'COMPLETED'] }
            },
            include: {
                user: { select: { name: true } },
                customer: { select: { name: true, phone: true } },
                items: { include: { product: { select: { name: true } } } }
            },
            orderBy: { preOrderDate: 'asc' }
        });

        res.json({ success: true, data: preOrders });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 8. CONFIRM PRE-ORDER PICKUP
 */
exports.confirmPreOrder = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.transaction.update({
            where: { id: parseInt(id) },
            data: { preOrderConfirmed: true, status: 'COMPLETED' }
        });

        res.json({ success: true, message: "Pre-order confirmed as picked up" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = exports;
