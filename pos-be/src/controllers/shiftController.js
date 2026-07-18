const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. OPEN SHIFT
exports.openShift = async (req, res) => {
    try {
        const parsedOpeningCash = Number(req.body.openingCash || 0);
        if (!Number.isFinite(parsedOpeningCash) || parsedOpeningCash < 0) {
            return res.status(400).json({ success: false, message: "Kas awal tidak valid." });
        }

        const activeUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, isActive: true }
        });

        if (!activeUser || !activeUser.isActive) {
            return res.status(403).json({ success: false, message: "Pengguna tidak aktif atau tidak ditemukan." });
        }

        const shift = await prisma.$transaction(async (tx) => {
            const existingOpen = await tx.shift.findFirst({
                where: { status: 'OPEN' },
                orderBy: { openedAt: 'desc' }
            });

            if (existingOpen) {
                const conflict = new Error('SHIFT_ALREADY_OPEN');
                conflict.shift = existingOpen;
                throw conflict;
            }

            return tx.shift.create({
                data: {
                    userId: activeUser.id,
                    userName: activeUser.name,
                    openedAt: new Date(),
                    openingCash: parsedOpeningCash,
                    status: 'OPEN'
                }
            });
        }, { isolationLevel: 'Serializable' });

        res.status(201).json({ success: true, message: "Shift berhasil dibuka", data: shift });
    } catch (error) {
        if (error.message === 'SHIFT_ALREADY_OPEN') {
            return res.status(409).json({
                success: false,
                code: 'SHIFT_ALREADY_OPEN',
                message: "Sudah ada shift yang sedang berjalan.",
                data: error.shift
            });
        }
        if (error.code === 'P2034') {
            const existingOpen = await prisma.shift.findFirst({
                where: { status: 'OPEN' },
                orderBy: { openedAt: 'desc' }
            });
            return res.status(409).json({
                success: false,
                code: 'SHIFT_ALREADY_OPEN',
                message: "Shift lain dibuka bersamaan. Gunakan shift yang sedang berjalan.",
                data: existingOpen
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. CLOSE SHIFT
exports.closeShift = async (req, res) => {
    try {
        const { id } = req.params;
        const { closingCash } = req.body;

        const shift = await prisma.shift.findUnique({ where: { id } });
        if (!shift) {
            return res.status(404).json({ success: false, message: "Shift tidak ditemukan" });
        }
        if (shift.status === 'CLOSED') {
            return res.status(400).json({ success: false, message: "Shift sudah ditutup" });
        }

        // Calculate sales during shift
        const shiftTransactions = await prisma.transaction.findMany({
            where: {
                createdAt: {
                    gte: shift.openedAt,
                    lte: new Date()
                },
                status: { in: ['PAID', 'COMPLETED'] }
            }
        });

        const totalSales = shiftTransactions.reduce((sum, t) => sum + Number(t.grandTotal), 0);
        const transactionCount = shiftTransactions.length;

        const updated = await prisma.shift.update({
            where: { id },
            data: {
                closedAt: new Date(),
                closingCash: closingCash !== undefined ? parseFloat(closingCash) : null,
                status: 'CLOSED'
            }
        });

        res.json({
            success: true,
            message: "Shift berhasil ditutup",
            data: {
                ...updated,
                totalSales,
                transactionCount,
                expectedCash: Number(shift.openingCash) + totalSales,
                difference: closingCash !== undefined ? parseFloat(closingCash) - (Number(shift.openingCash) + totalSales) : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. GET ALL SHIFTS
exports.getAllShifts = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const whereClause = {};

        if (startDate && endDate) {
            whereClause.openedAt = {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        const shifts = await prisma.shift.findMany({
            where: whereClause,
            orderBy: { openedAt: 'desc' }
        });

        res.json({ success: true, data: shifts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. GET CURRENT OPEN SHIFT
exports.getCurrentShift = async (req, res) => {
    try {
        const shift = await prisma.shift.findFirst({
            where: { status: 'OPEN' },
            orderBy: { openedAt: 'desc' }
        });

        res.json({ success: true, data: shift });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
