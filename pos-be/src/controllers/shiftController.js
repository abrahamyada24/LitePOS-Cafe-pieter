const { PrismaClient } = require('@prisma/client');
const { calculateShiftSummary } = require('../services/shiftSummaryService');
const prisma = new PrismaClient();

// 1. OPEN SHIFT
exports.openShift = async (req, res) => {
    try {
        const parsedOpeningCash = Number(req.body.openingCash || 0);
        if (!Number.isFinite(parsedOpeningCash) || parsedOpeningCash < 0) {
            return res.status(400).json({ success: false, message: "Kas awal tidak valid." });
        }

        const setting = await prisma.storeSetting.findFirst({ select: { enableShift: true } });
        if (setting?.enableShift === false) {
            return res.status(409).json({
                success: false,
                code: 'SHIFT_DISABLED',
                message: 'Fitur shift sedang dinonaktifkan di Pengaturan.'
            });
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
        const parsedClosingCash = Number(closingCash);
        if (!Number.isFinite(parsedClosingCash) || parsedClosingCash < 0) {
            return res.status(400).json({ success: false, code: 'INVALID_CLOSING_CASH', message: 'Kas akhir tidak valid.' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const shift = await tx.shift.findUnique({ where: { id } });
            if (!shift) {
                const error = new Error('Shift tidak ditemukan');
                error.statusCode = 404;
                error.code = 'SHIFT_NOT_FOUND';
                throw error;
            }
            if (shift.status === 'CLOSED') {
                const error = new Error('Shift sudah ditutup');
                error.statusCode = 409;
                error.code = 'SHIFT_ALREADY_CLOSED';
                throw error;
            }

            const canClose = shift.userId === req.user.id || ['ADMIN', 'OWNER'].includes(String(req.user.role || '').toUpperCase());
            if (!canClose) {
                const error = new Error(`Shift ini dibuka oleh ${shift.userName}. Minta kasir tersebut atau Admin/Owner untuk menutupnya.`);
                error.statusCode = 403;
                error.code = 'SHIFT_CLOSE_FORBIDDEN';
                throw error;
            }

            const closedAt = new Date();
            const shiftScope = [
                { shiftId: shift.id },
                {
                    shiftId: null,
                    createdAt: { gte: shift.openedAt, lte: closedAt }
                }
            ];
            const pendingPaymentCount = await tx.transaction.count({
                where: {
                    OR: shiftScope,
                    status: 'PENDING',
                    payments: { some: { paymentStatus: 'PENDING' } }
                }
            });
            if (pendingPaymentCount > 0) {
                const error = new Error(`Masih ada ${pendingPaymentCount} pembayaran digital yang menunggu konfirmasi.`);
                error.statusCode = 409;
                error.code = 'SHIFT_HAS_PENDING_PAYMENTS';
                throw error;
            }

            const shiftTransactions = await tx.transaction.findMany({
                where: {
                    OR: shiftScope,
                    status: { in: ['PAID', 'COMPLETED'] }
                },
                include: { payments: true }
            });
            const expenses = await tx.expense.findMany({
                where: {
                    OR: [
                        { shiftId: shift.id },
                        {
                            shiftId: null,
                            createdAt: { gte: shift.openedAt, lte: closedAt }
                        }
                    ]
                }
            });
            const summary = calculateShiftSummary({
                shift,
                transactions: shiftTransactions,
                expenses,
                closingCash: parsedClosingCash
            });
            const updated = await tx.shift.update({
                where: { id },
                data: {
                    closedAt,
                    closingCash: parsedClosingCash,
                    status: 'CLOSED'
                }
            });

            return { updated, summary };
        }, { isolationLevel: 'Serializable' });

        res.json({
            success: true,
            message: "Shift berhasil ditutup",
            data: {
                ...result.updated,
                ...result.summary
            }
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || 'SHIFT_CLOSE_FAILED',
            message: error.message,
            error: error.message
        });
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
        const [setting, shift] = await Promise.all([
            prisma.storeSetting.findFirst({ select: { enableShift: true } }),
            prisma.shift.findFirst({
                where: { status: 'OPEN' },
                orderBy: { openedAt: 'desc' }
            })
        ]);

        res.json({ success: true, enabled: setting?.enableShift !== false, data: shift });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
