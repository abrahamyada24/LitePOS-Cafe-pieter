const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. GET SAVED TRANSACTIONS
exports.getSavedTransactions = async (req, res) => {
    try {
        const cancelledTableOrders = await prisma.kitchenOrder.findMany({
            where: { status: 'CANCELLED', savedOrderId: { not: null } },
            select: { savedOrderId: true }
        });
        const cancelledIds = cancelledTableOrders.map(order => order.savedOrderId).filter(Boolean);
        const saved = await prisma.savedTransaction.findMany({
            where: cancelledIds.length > 0 ? { id: { notIn: cancelledIds } } : undefined,
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: saved });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. SAVE TRANSACTION (Cart as Pending)
exports.saveTransaction = async (req, res) => {
    try {
        const { name, cartData, userId } = req.body;

        if (!name || !cartData) {
            return res.status(400).json({ success: false, message: "Nama dan data keranjang wajib diisi" });
        }

        const saved = await prisma.savedTransaction.create({
            data: {
                name,
                cartData: typeof cartData === 'string' ? cartData : JSON.stringify(cartData),
                userId: parseInt(userId)
            }
        });

        res.status(201).json({ success: true, message: "Transaksi berhasil disimpan", data: saved });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. DELETE SAVED TRANSACTION
exports.deleteSavedTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const accepted = req.query.action === 'accepted';
        await prisma.$transaction(async (tx) => {
            await tx.kitchenOrder.updateMany({
                where: { savedOrderId: id, status: { in: ['NEW', 'PREPARING'] } },
                data: accepted
                    ? { status: 'PREPARING', startedAt: new Date() }
                    : { status: 'CANCELLED', completedAt: new Date() }
            });
            await tx.savedTransaction.delete({ where: { id } });
        });
        res.json({ success: true, message: "Transaksi tersimpan berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. GET SAVED TRANSACTION BY ID
exports.getSavedTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const saved = await prisma.savedTransaction.findUnique({
            where: { id },
            include: { user: { select: { name: true } } }
        });

        if (!saved) {
            return res.status(404).json({ success: false, message: "Transaksi tersimpan tidak ditemukan" });
        }

        res.json({ success: true, data: saved });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
