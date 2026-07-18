const { PrismaClient } = require('@prisma/client');
const { getProductPrice, serializeProductPrice } = require('../utils/productDiscount');
const { reserveQueue } = require('../utils/orderQueue');
const prisma = new PrismaClient();

const generateTableOrderCode = () => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MEJA-${yyyy}${mm}${dd}-${hh}${mi}-${suffix}`;
};

exports.getPublicCatalog = async (req, res) => {
    try {
        // Ambil produk yang AKTIF dan stoknya > 0, termasuk informasi kategorinya
        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                OR: [
                    { stock: { gt: 0 } },
                    { isUnlimitedStock: true }
                ]
            },
            include: {
                category: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Ambil kategori yang memiliki produk aktif dengan stok > 0
        const activeCategoryIds = [...new Set(products.map(p => p.categoryId))];
        const categories = await prisma.category.findMany({
            where: {
                id: { in: activeCategoryIds }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Ambil pengaturan toko untuk mendapatkan nomor WhatsApp
        const settings = await prisma.storeSetting.findFirst();
        const packages = await prisma.package.findMany({
            where: { isActive: true },
            include: { items: { include: { product: true } } },
            orderBy: { name: 'asc' }
        });
        const availablePackages = packages.filter(pkg => pkg.items.length > 0 && pkg.items.every(item =>
            item.product.isActive && (item.product.isUnlimitedStock || item.product.stock >= item.qty)
        ));

        res.status(200).json({
            success: true,
            data: {
                products: products.map(product => serializeProductPrice(product)),
                packages: availablePackages.map(pkg => ({
                    ...pkg,
                    price: Number(pkg.price),
                    categoryId: 'PACKAGE',
                    category: { id: 'PACKAGE', name: 'Paket' },
                    isPackage: true,
                    stock: 999,
                    isUnlimitedStock: true
                })),
                categories,
                settings
            }
        });
    } catch (error) {
        console.error('Error in getPublicCatalog:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat mengambil data katalog.' });
    }
};

exports.createTableOrder = async (req, res) => {
    try {
        const { tableNumber, customerName, note, items } = req.body;

        const cleanTableNumber = String(tableNumber || '').trim();
        if (!cleanTableNumber) {
            return res.status(400).json({ success: false, message: 'Nomor meja wajib diisi.' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Keranjang masih kosong.' });
        }

        const tableOrderSettings = await prisma.storeSetting.findFirst({
            select: { enableTableOrder: true }
        });
        if (!tableOrderSettings?.enableTableOrder) {
            return res.status(403).json({
                success: false,
                message: 'Fitur order meja sedang tidak aktif.'
            });
        }

        const table = await prisma.dineTable.findUnique({ where: { number: cleanTableNumber } });
        if (!table) {
            return res.status(404).json({ success: false, message: `Meja ${cleanTableNumber} tidak ditemukan.` });
        }

        const user = await prisma.user.findFirst({
            where: { isActive: true },
            orderBy: { id: 'asc' }
        });

        if (!user) {
            return res.status(500).json({ success: false, message: 'Belum ada user kasir aktif untuk menerima order.' });
        }

        const cartItems = [];
        let grandTotal = 0;

        for (const item of items) {
            const packageId = parseInt(item.packageId) || (String(item.productId || item.id || '').startsWith('pkg-') ? parseInt(String(item.productId || item.id).replace('pkg-', '')) : null);
            if (packageId) {
                const pkg = await prisma.package.findUnique({
                    where: { id: packageId },
                    include: { items: { include: { product: true } } }
                });
                const qty = Math.max(1, parseInt(item.qty || item.quantity || 1, 10));
                if (!pkg || !pkg.isActive || pkg.items.length === 0) {
                    return res.status(400).json({ success: false, message: 'Paket tidak tersedia.' });
                }
                const unavailable = pkg.items.find(packageItem => !packageItem.product.isActive || (!packageItem.product.isUnlimitedStock && packageItem.product.stock < packageItem.qty * qty));
                if (unavailable) {
                    return res.status(400).json({ success: false, message: `Stok isi paket ${pkg.name} tidak mencukupi.` });
                }
                const price = Number(pkg.price);
                grandTotal += price * qty;
                cartItems.push({
                    id: `pkg-${pkg.id}`,
                    packageId: pkg.id,
                    name: `[Paket] ${pkg.name}`,
                    price,
                    originalPrice: price,
                    quantity: qty,
                    qty,
                    notes: item.notes || null,
                    isPackage: true,
                    components: pkg.items.map(packageItem => ({ name: packageItem.product.name, qty: packageItem.qty }))
                });
                continue;
            }

            const productId = parseInt(item.productId || item.id, 10);
            const qty = Math.max(1, parseInt(item.qty || item.quantity || 1, 10));

            if (!productId || Number.isNaN(productId)) {
                return res.status(400).json({ success: false, message: 'Produk tidak valid.' });
            }

            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: { category: true }
            });

            if (!product || !product.isActive) {
                return res.status(400).json({ success: false, message: 'Produk tidak tersedia.' });
            }

            if (!product.isUnlimitedStock && product.stock < qty) {
                return res.status(400).json({
                    success: false,
                    message: `Stok ${product.name} tidak mencukupi.`
                });
            }

            const priceInfo = getProductPrice(product);
            const price = priceInfo.effectivePrice;
            grandTotal += price * qty;
            cartItems.push({
                id: product.id,
                productId: product.id,
                serverProductId: product.id,
                name: product.name,
                categoryName: product.category?.name || null,
                price,
                originalPrice: priceInfo.originalPrice,
                discountAmount: priceInfo.discountAmount,
                discountLabel: priceInfo.discountLabel,
                quantity: qty,
                qty,
                notes: item.notes || null,
                imageUrl: product.imageUrl,
                stock: product.stock,
                isUnlimitedStock: product.isUnlimitedStock ? 1 : 0
            });
        }

        const cleanCustomerName = String(customerName || '').trim();
        const orderCode = generateTableOrderCode();

        const result = await prisma.$transaction(async (tx) => {
            const { queueDate, queueNumber, queueLabel } = await reserveQueue(tx);
            const orderName = `${queueLabel} - Meja ${table.number} - ${cleanCustomerName || 'Pelanggan'}`;
            const cartData = {
                source: 'TABLE_QR',
                orderCode,
                queueDate,
                queueNumber,
                queueLabel,
                tableNumber: table.number,
                customerName: cleanCustomerName || `Pelanggan Meja ${table.number}`,
                note: note || null,
                grandTotal,
                items: cartItems
            };

            const created = await tx.savedTransaction.create({
                data: {
                    name: orderName,
                    cartData: JSON.stringify(cartData),
                    userId: user.id
                }
            });

            await tx.kitchenOrder.create({
                data: {
                    source: 'TABLE_QR',
                    orderCode,
                    queueDate,
                    queueNumber,
                    queueLabel,
                    tableNumber: table.number,
                    customerName: cartData.customerName,
                    note: note || null,
                    total: grandTotal,
                    itemsJson: JSON.stringify(cartItems),
                    savedOrderId: created.id
                }
            });

            await tx.dineTable.update({
                where: { id: table.id },
                data: {
                    status: 'OCCUPIED',
                    occupiedAt: table.occupiedAt || new Date(),
                    statusUpdatedAt: new Date()
                }
            });

            return { saved: created, queueNumber, queueLabel };
        });

        res.status(201).json({
            success: true,
            message: 'Order meja berhasil dikirim ke kasir.',
            data: {
                id: result.saved.id,
                orderCode,
                queueNumber: result.queueNumber,
                queueLabel: result.queueLabel,
                tableNumber: table.number,
                grandTotal,
                status: 'NEW'
            }
        });
    } catch (error) {
        console.error('Error in createTableOrder:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat mengirim order meja.' });
    }
};

exports.getTableOrderStatus = async (req, res) => {
    try {
        const orderCode = String(req.params.orderCode || '').trim().toUpperCase();
        if (!orderCode || orderCode.length > 100) {
            return res.status(400).json({ success: false, message: 'Kode order tidak valid.' });
        }

        const order = await prisma.kitchenOrder.findUnique({
            where: { orderCode },
            select: {
                source: true,
                orderCode: true,
                queueLabel: true,
                tableNumber: true,
                total: true,
                status: true,
                createdAt: true,
                startedAt: true,
                readyAt: true,
                completedAt: true,
                updatedAt: true
            }
        });

        if (!order || order.source !== 'TABLE_QR') {
            return res.status(404).json({ success: false, message: 'Order meja tidak ditemukan.' });
        }

        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            data: {
                ...order,
                total: Number(order.total)
            }
        });
    } catch (error) {
        console.error('Error in getTableOrderStatus:', error);
        res.status(500).json({ success: false, message: 'Status order belum dapat diperbarui.' });
    }
};
