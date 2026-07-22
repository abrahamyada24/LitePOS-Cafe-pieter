const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. GET ALL EXPENSES (with date filtering)
exports.getAllExpenses = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const whereClause = {};

        if (startDate && endDate) {
            whereClause.createdAt = {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        } else if (startDate) {
            whereClause.createdAt = { gte: new Date(startDate) };
        }

        const expenses = await prisma.expense.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

        res.json({ success: true, data: expenses, total });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. CREATE EXPENSE
exports.createExpense = async (req, res) => {
    try {
        const { description, amount, category, type } = req.body;

        if (!description || !amount) {
            return res.status(400).json({ success: false, message: "Deskripsi dan jumlah wajib diisi" });
        }

        const setting = await prisma.storeSetting.findFirst({ select: { enableShift: true } });
        const activeShift = setting?.enableShift !== false
            ? await prisma.shift.findFirst({ where: { status: 'OPEN' }, orderBy: { openedAt: 'desc' } })
            : null;

        const expense = await prisma.expense.create({
            data: {
                shiftId: activeShift?.id || null,
                description,
                amount: parseFloat(amount),
                category: category || 'Umum',
                type: type || 'EXPENSE'
            }
        });

        res.status(201).json({ success: true, message: "Pengeluaran berhasil dicatat", data: expense });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. DELETE EXPENSE
exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.expense.delete({ where: { id: parseInt(id) } });
        res.json({ success: true, message: "Pengeluaran berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
