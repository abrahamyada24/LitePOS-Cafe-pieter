const { PrismaClient } = require('@prisma/client');
const { getJakartaDateKey } = require('../utils/orderQueue');
const { getKitchenPaymentStatus } = require('../services/kitchenPaymentStatusService');
const prisma = new PrismaClient();

const VALID_STATUSES = ['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

const serializeOrder = (order, transaction = null) => {
    let items = [];
    try {
        items = JSON.parse(order.itemsJson || '[]');
    } catch {
        items = [];
    }
    return {
        ...order,
        items,
        paymentStatus: getKitchenPaymentStatus(transaction),
        transactionStatus: transaction?.status || null
    };
};

const releaseTableIfUnused = async (tx, order) => {
    if (!order.tableNumber) return;
    const otherActiveOrders = await tx.kitchenOrder.count({
        where: {
            id: { not: order.id },
            tableNumber: order.tableNumber,
            status: { in: ['NEW', 'PREPARING', 'READY'] }
        }
    });
    if (otherActiveOrders === 0) {
        await tx.dineTable.updateMany({
            where: { number: order.tableNumber },
            data: { status: 'AVAILABLE', occupiedAt: null, statusUpdatedAt: new Date() }
        });
    }
};

const cancelKitchenOrder = async (tx, currentOrder) => {
    if (currentOrder.transactionId) {
        const error = new Error('Order sudah masuk proses pembayaran. Gunakan Retur Transaksi jika pembayaran sudah berhasil.');
        error.code = 'ORDER_PAYMENT_EXISTS';
        throw error;
    }
    const updatedOrder = await tx.kitchenOrder.update({
        where: { id: currentOrder.id },
        data: { status: 'CANCELLED', completedAt: new Date() }
    });
    if (currentOrder.savedOrderId) {
        await tx.savedTransaction.deleteMany({ where: { id: currentOrder.savedOrderId } });
    }
    await releaseTableIfUnused(tx, currentOrder);
    return updatedOrder;
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

        const transactionIds = orders.map(order => order.transactionId).filter(Boolean);
        const transactions = transactionIds.length > 0
            ? await prisma.transaction.findMany({
                where: { id: { in: transactionIds } },
                include: { payments: true }
            })
            : [];
        const transactionMap = new Map(transactions.map(transaction => [transaction.id, transaction]));

        res.json({ success: true, data: orders.map(order => serializeOrder(order, transactionMap.get(order.transactionId) || null)) });
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

            if (status === 'CANCELLED') return cancelKitchenOrder(tx, currentOrder);

            const updatedOrder = await tx.kitchenOrder.update({ where: { id: currentOrder.id }, data });

            return updatedOrder;
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Pesanan dapur tidak ditemukan.' });
        }

        res.json({ success: true, data: serializeOrder(order), message: 'Status pesanan diperbarui.' });
    } catch (error) {
        res.status(error.code === 'ORDER_PAYMENT_EXISTS' ? 409 : 500).json({ success: false, message: error.message });
    }
};

exports.cancelKitchenOrderByCode = async (req, res) => {
    try {
        const orderCode = String(req.params.orderCode || '').trim().toUpperCase();
        if (!orderCode) return res.status(400).json({ success: false, message: 'Kode order tidak valid.' });

        const order = await prisma.$transaction(async (tx) => {
            const currentOrder = await tx.kitchenOrder.findUnique({ where: { orderCode } });
            if (!currentOrder) return null;
            if (currentOrder.status === 'CANCELLED') return currentOrder;
            if (currentOrder.status === 'COMPLETED') {
                const error = new Error('Order yang sudah selesai tidak dapat dibatalkan.');
                error.code = 'ORDER_COMPLETED';
                throw error;
            }
            return cancelKitchenOrder(tx, currentOrder);
        });

        if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
        res.json({ success: true, data: serializeOrder(order), message: 'Order berhasil dibatalkan.' });
    } catch (error) {
        const conflict = ['ORDER_PAYMENT_EXISTS', 'ORDER_COMPLETED'].includes(error.code);
        res.status(conflict ? 409 : 500).json({ success: false, message: error.message });
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
