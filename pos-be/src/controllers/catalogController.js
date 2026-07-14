const { PrismaClient } = require('@prisma/client');
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

const getJakartaDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const formatQueueLabel = (queueNumber) => `A-${String(queueNumber).padStart(3, '0')}`;

const getNextQueueNumber = async (tx, queueDate) => {
    await tx.$executeRaw`
        INSERT INTO order_queue_counters (queue_date, last_number, created_at, updated_at)
        VALUES (${queueDate}, LAST_INSERT_ID(1), NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
            last_number = LAST_INSERT_ID(last_number + 1),
            updated_at = NOW(3)
    `;
    const rows = await tx.$queryRaw`SELECT LAST_INSERT_ID() AS queueNumber`;
    return Number(rows[0].queueNumber);
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

        res.status(200).json({
            success: true,
            data: {
                products,
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

            const price = Number(product.price);
            grandTotal += price * qty;
            cartItems.push({
                id: product.id,
                productId: product.id,
                serverProductId: product.id,
                name: product.name,
                categoryName: product.category?.name || null,
                price,
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
        const queueDate = getJakartaDateKey();

        const result = await prisma.$transaction(async (tx) => {
            const queueNumber = await getNextQueueNumber(tx, queueDate);
            const queueLabel = formatQueueLabel(queueNumber);
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

            await tx.dineTable.update({
                where: { id: table.id },
                data: { status: 'OCCUPIED' }
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
                grandTotal
            }
        });
    } catch (error) {
        console.error('Error in createTableOrder:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat mengirim order meja.' });
    }
};
