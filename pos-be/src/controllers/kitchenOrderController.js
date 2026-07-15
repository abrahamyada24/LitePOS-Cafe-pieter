const { PrismaClient } = require('@prisma/client');
const { getJakartaDateKey } = require('../utils/orderQueue');
const prisma = new PrismaClient();

const VALID_STATUSES = ['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

const serializeOrder = (order) => {
    let items = [];
    try {
        items = JSON.parse(order.itemsJson || '[]');
    } catch {
        items = [];
    }
    return { ...order, items };
};

exports.getKitchenOrders = async (req, res) => {
    try {
        const queueDate = req.query.date || getJakartaDateKey();
        const includeCompleted = req.query.includeCompleted === 'true';
        const status = req.query.status;
        const where = { queueDate };

        if (status && VALID_STATUSES.includes(status)) {
            where.status = status;
        } else if (!includeCompleted) {
            where.status = { in: ['NEW', 'PREPARING', 'READY'] };
        }

        const orders = await prisma.kitchenOrder.findMany({
            where,
            orderBy: [{ queueNumber: 'asc' }, { createdAt: 'asc' }]
        });

        res.json({ success: true, data: orders.map(serializeOrder) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateKitchenOrderStatus = async (req, res) => {
    try {
        const status = String(req.body.status || '').toUpperCase();
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status pesanan dapur tidak valid.' });
        }

        const data = { status };
        if (status === 'PREPARING') data.startedAt = new Date();
        if (status === 'READY') data.readyAt = new Date();
        if (status === 'COMPLETED' || status === 'CANCELLED') data.completedAt = new Date();

        const order = await prisma.$transaction(async (tx) => {
            const currentOrder = await tx.kitchenOrder.findUnique({ where: { id: req.params.id } });
            if (!currentOrder) return null;

            const updatedOrder = await tx.kitchenOrder.update({
                where: { id: currentOrder.id },
                data
            });

            if (status === 'CANCELLED' && currentOrder.savedOrderId) {
                await tx.savedTransaction.deleteMany({ where: { id: currentOrder.savedOrderId } });
            }

            return updatedOrder;
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Pesanan dapur tidak ditemukan.' });
        }

        res.json({ success: true, data: serializeOrder(order), message: 'Status pesanan diperbarui.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getKitchenOrderSummary = async (req, res) => {
    try {
        const queueDate = req.query.date || getJakartaDateKey();
        const grouped = await prisma.kitchenOrder.groupBy({
            by: ['status'],
            where: { queueDate },
            _count: { _all: true }
        });
        const data = Object.fromEntries(grouped.map(item => [item.status, item._count._all]));
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
