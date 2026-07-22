const { PrismaClient } = require('@prisma/client');
const { Parser } = require('json2csv');
const { calculateShiftSummary } = require('../services/shiftSummaryService');
const prisma = new PrismaClient();

/**
 * GET DASHBOARD STATS — Enhanced with expenses, shifts, category breakdown, bestsellers
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const { startDate, endDate, period } = req.query;

        let start, end;
        const now = new Date();

        if (startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'week') {
            start = new Date(now);
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), 11, 31);
            end.setHours(23, 59, 59, 999);
        } else {
            // Default: 'month' or no period — current month
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
        }

        const dateFilter = { createdAt: { gte: start, lte: end } };

        // 1. Transaction Stats
        const transactions = await prisma.transaction.findMany({
            where: {
                ...dateFilter,
                status: { in: ['PAID', 'COMPLETED'] }
            },
            include: {
                items: { include: { product: { select: { name: true, categoryId: true, imageUrl: true } } } },
                user: { select: { name: true } },
                customer: { select: { name: true } },
                payments: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.grandTotal), 0);
        const totalTransactions = transactions.length;
        const totalTax = transactions.reduce((sum, t) => sum + Number(t.taxAmount), 0);
        const totalDiscount = transactions.reduce((sum, t) => sum + Number(t.discountAmount), 0);

        // 1b. Today-only stats for dashboard cards
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const todayTransactions = transactions.filter(t => t.createdAt >= todayStart && t.createdAt <= todayEnd);
        const todayRevenue = todayTransactions.reduce((sum, t) => sum + Number(t.grandTotal), 0);
        const todayCount = todayTransactions.length;
        let todayProfit = 0;
        for (const trx of todayTransactions) {
            for (const item of trx.items) {
                todayProfit += (Number(item.price) - Number(item.costPrice)) * item.qty;
            }
        }

        // 2. Profit calculation (using cost price snapshots)
        let totalProfit = 0;
        for (const trx of transactions) {
            for (const item of trx.items) {
                totalProfit += (Number(item.price) - Number(item.costPrice)) * item.qty;
            }
        }

        // 3. Payment method breakdown
        const cashRevenue = transactions
            .filter(t => t.payments.some(p => p.paymentType === 'CASH'))
            .reduce((sum, t) => sum + Number(t.grandTotal), 0);
        const qrisRevenue = transactions
            .filter(t => t.payments.some(p => p.paymentType === 'QRIS'))
            .reduce((sum, t) => sum + Number(t.grandTotal), 0);
        const transferRevenue = transactions
            .filter(t => t.payments.some(p => p.paymentType === 'TRANSFER'))
            .reduce((sum, t) => sum + Number(t.grandTotal), 0);

        // 4. Order type breakdown (Dine In vs Take Away)
        const dineInCount = transactions.filter(t => t.orderType === 'DINE_IN').length;
        const takeAwayCount = transactions.filter(t => t.orderType === 'TAKE_AWAY').length;

        // 5. Category breakdown
        const categoryMap = {};
        for (const trx of transactions) {
            for (const item of trx.items) {
                const catId = item.product?.categoryId || 0;
                if (!categoryMap[catId]) categoryMap[catId] = { qty: 0, revenue: 0 };
                categoryMap[catId].qty += item.qty;
                categoryMap[catId].revenue += Number(item.price) * item.qty;
            }
        }
        const categories = await prisma.category.findMany();
        const categoryBreakdown = categories.map(c => ({
            id: c.id,
            name: c.name,
            qty: categoryMap[c.id]?.qty || 0,
            revenue: categoryMap[c.id]?.revenue || 0
        })).sort((a, b) => b.revenue - a.revenue);

        // 6. Bestseller products (field names match frontend: name, sold, imageUrl)
        const productMap = {};
        for (const trx of transactions) {
            for (const item of trx.items) {
                const key = item.productId;
                if (!productMap[key]) productMap[key] = { name: item.product?.name || 'Unknown', imageUrl: item.product?.imageUrl || null, sold: 0, revenue: 0 };
                productMap[key].sold += item.qty;
                productMap[key].revenue += Number(item.price) * item.qty;
            }
        }
        const topProducts = Object.entries(productMap)
            .map(([id, data]) => ({ productId: parseInt(id), ...data }))
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 10);

        // 7. Returns
        const returns = await prisma.transaction.findMany({
            where: { ...dateFilter, status: 'RETURNED' },
            include: { items: true }
        });
        const returnCount = returns.length;
        const returnTotal = returns.reduce((sum, t) => sum + Number(t.grandTotal), 0);

        // 8. Expenses
        const expenses = await prisma.expense.findMany({
            where: dateFilter,
            orderBy: { createdAt: 'desc' }
        });
        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

        // 9. Low stock products
        const lowStockProducts = await prisma.product.findMany({
            where: {
                isActive: true,
                isUnlimitedStock: false,
                stock: { lte: 5 }
            },
            include: { category: { select: { name: true } } },
            orderBy: { stock: 'asc' },
            take: 10
        });

        // 10. Sales chart data (daily breakdown)
        const salesByDay = {};
        for (const trx of transactions) {
            const day = trx.createdAt.toISOString().split('T')[0];
            if (!salesByDay[day]) salesByDay[day] = { revenue: 0, count: 0 };
            salesByDay[day].revenue += Number(trx.grandTotal);
            salesByDay[day].count += 1;
        }
        const chartData = Object.entries(salesByDay).map(([date, data]) => ({
            date,
            label: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            revenue: data.revenue,
            total: data.revenue,
            count: data.count
        })).sort((a, b) => a.date.localeCompare(b.date));

        // 11. Recent transactions (last 5)
        const recentTransactions = transactions.slice(0, 5);

        res.json({
            success: true,
            data: {
                summary: {
                    totalRevenue,
                    grossRevenue: totalRevenue + returnTotal,
                    returnCount,
                    returnTotal,
                    todayRevenue,
                    totalTransactions,
                    todayCount,
                    totalProfit,
                    grossProfit: todayProfit,
                    totalTax,
                    totalDiscount,
                    totalExpenses,
                    netProfit: totalProfit - totalExpenses,
                    lowStockCount: lowStockProducts.length // for dashboard
                },
                paymentBreakdown: {
                    cash: cashRevenue,
                    qris: qrisRevenue,
                    transfer: transferRevenue
                },
                orderTypeBreakdown: {
                    dineIn: dineInCount,
                    takeAway: takeAwayCount
                },
                categoryBreakdown,
                topProducts,
                bestsellers: topProducts,
                returns: { count: returnCount, total: returnTotal },
                lowStockProducts,
                chart: chartData,
                chartData,
                recentTransactions,
                expenses: { total: totalExpenses, items: expenses }
            }
        });
    } catch (error) {
        console.error("Report Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * EXPORT TRANSACTION REPORT — CSV
 */
exports.exportTransactionReport = async (req, res) => {
    try {
        const { startDate, endDate, format } = req.query;
        const dateFilter = {};

        if (startDate && endDate) {
            dateFilter.createdAt = {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        const transactions = await prisma.transaction.findMany({
            where: { ...dateFilter, status: { in: ['PAID', 'COMPLETED'] } },
            include: {
                user: { select: { name: true } },
                customer: { select: { name: true } },
                items: { include: { product: { select: { name: true } } } },
                payments: true
            },
            orderBy: { createdAt: 'desc' }
        });

        if (format === 'csv') {
            const csvData = transactions.map(t => ({
                'No. Invoice': t.invoiceNumber,
                'Tanggal': t.createdAt.toISOString(),
                'Kasir': t.user?.name || '-',
                'Pelanggan': t.customer?.name || t.customerName || 'Guest',
                'Tipe Order': t.orderType || '-',
                'No. Meja': t.tableNumber || '-',
                'Subtotal': Number(t.subTotal),
                'Diskon': Number(t.discountAmount),
                'Pajak': Number(t.taxAmount),
                'Total': Number(t.grandTotal),
                'Pembayaran': t.payments[0]?.paymentType || '-',
                'Status': t.status
            }));

            const parser = new Parser();
            const csv = parser.parse(csvData);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=laporan_transaksi_${startDate || 'all'}.csv`);
            return res.send(csv);
        }

        res.json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET SHIFT REPORT — Summary of a specific shift or all shifts
 */
exports.getShiftReport = async (req, res) => {
    try {
        const { shiftId } = req.params;

        if (shiftId) {
            const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
            if (!shift) return res.status(404).json({ success: false, message: "Shift tidak ditemukan" });

            const shiftEnd = shift.closedAt || new Date();
            const shiftTransactions = await prisma.transaction.findMany({
                where: {
                    OR: [
                        { shiftId: shift.id },
                        { shiftId: null, createdAt: { gte: shift.openedAt, lte: shiftEnd } }
                    ],
                    status: { in: ['PAID', 'COMPLETED'] }
                },
                include: { payments: true }
            });
            const expenses = await prisma.expense.findMany({
                where: {
                    OR: [
                        { shiftId: shift.id },
                        { shiftId: null, createdAt: { gte: shift.openedAt, lte: shiftEnd } }
                    ]
                }
            });
            const summary = calculateShiftSummary({ shift, transactions: shiftTransactions, expenses });

            return res.json({
                success: true,
                data: {
                    shift,
                    ...summary
                }
            });
        }

        const shifts = await prisma.shift.findMany({ orderBy: { openedAt: 'desc' }, take: 20 });
        res.json({ success: true, data: shifts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Helper: Parse date range from query params
 */
const parseDateRange = (query) => {
    const { startDate, endDate, period } = query;
    let start, end;
    const now = new Date();

    if (startDate && endDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
    } else if (period === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
    } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end, dateFilter: { createdAt: { gte: start, lte: end } } };
};

/**
 * GET REPORT BY CATEGORY
 */
exports.getReportByCategory = async (req, res) => {
    try {
        const { dateFilter } = parseDateRange(req.query);

        const transactions = await prisma.transaction.findMany({
            where: {
                ...dateFilter,
                status: { in: ['PAID', 'COMPLETED'] }
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { name: true, categoryId: true }
                        }
                    }
                }
            }
        });

        const categoryMap = {};
        const productsByCategory = {};

        for (const trx of transactions) {
            for (const item of trx.items) {
                const catId = item.product?.categoryId || 0;
                if (!categoryMap[catId]) {
                    categoryMap[catId] = { totalQty: 0, totalRevenue: 0, totalProfit: 0 };
                    productsByCategory[catId] = new Set();
                }
                categoryMap[catId].totalQty += item.qty;
                categoryMap[catId].totalRevenue += Number(item.price) * item.qty;
                categoryMap[catId].totalProfit += (Number(item.price) - Number(item.costPrice)) * item.qty;
                productsByCategory[catId].add(item.productId);
            }
        }

        const categories = await prisma.category.findMany();
        const data = categories.map(c => ({
            id: c.id,
            name: c.name,
            totalQty: categoryMap[c.id]?.totalQty || 0,
            totalRevenue: categoryMap[c.id]?.totalRevenue || 0,
            totalProfit: categoryMap[c.id]?.totalProfit || 0,
            productCount: productsByCategory[c.id]?.size || 0
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        res.json({ success: true, data });
    } catch (error) {
        console.error("Report By Category Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET REPORT BY CUSTOMER
 */
exports.getReportByCustomer = async (req, res) => {
    try {
        const { dateFilter } = parseDateRange(req.query);

        const transactions = await prisma.transaction.findMany({
            where: {
                ...dateFilter,
                status: { in: ['PAID', 'COMPLETED'] },
                customerId: { not: null }
            },
            include: {
                customer: { select: { id: true, name: true, phone: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const customerMap = {};

        for (const trx of transactions) {
            const custId = trx.customerId;
            if (!customerMap[custId]) {
                customerMap[custId] = {
                    id: trx.customer?.id,
                    name: trx.customer?.name || trx.customerName || 'Guest',
                    phone: trx.customer?.phone || null,
                    visitCount: 0,
                    totalSpent: 0,
                    lastVisit: trx.createdAt,
                    transactions: []
                };
            }
            customerMap[custId].visitCount += 1;
            customerMap[custId].totalSpent += Number(trx.grandTotal);
            if (trx.createdAt > customerMap[custId].lastVisit) {
                customerMap[custId].lastVisit = trx.createdAt;
            }
        }

        const data = Object.values(customerMap).map(c => ({
            ...c,
            avgTransaction: c.visitCount > 0 ? Math.round(c.totalSpent / c.visitCount) : 0
        })).sort((a, b) => b.totalSpent - a.totalSpent);

        res.json({ success: true, data });
    } catch (error) {
        console.error("Report By Customer Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET PEAK HOURS
 */
exports.getPeakHours = async (req, res) => {
    try {
        const { dateFilter } = parseDateRange(req.query);

        const transactions = await prisma.transaction.findMany({
            where: {
                ...dateFilter,
                status: { in: ['PAID', 'COMPLETED'] }
            },
            select: { createdAt: true, grandTotal: true }
        });

        // Hourly breakdown (0-23)
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            transactionCount: 0,
            totalRevenue: 0
        }));

        // Day of week breakdown (0=Sunday, 6=Saturday)
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dailyData = Array.from({ length: 7 }, (_, i) => ({
            day: i,
            dayName: dayNames[i],
            transactionCount: 0,
            totalRevenue: 0
        }));

        for (const trx of transactions) {
            const hour = trx.createdAt.getHours();
            const day = trx.createdAt.getDay();
            const revenue = Number(trx.grandTotal);

            hourlyData[hour].transactionCount += 1;
            hourlyData[hour].totalRevenue += revenue;

            dailyData[day].transactionCount += 1;
            dailyData[day].totalRevenue += revenue;
        }

        // Find peak hour
        const peakHour = hourlyData.reduce((max, h) =>
            h.transactionCount > max.transactionCount ? h : max, hourlyData[0]);

        // Find peak day
        const peakDay = dailyData.reduce((max, d) =>
            d.transactionCount > max.transactionCount ? d : max, dailyData[0]);

        res.json({
            success: true,
            data: {
                hourlyBreakdown: hourlyData,
                dailyBreakdown: dailyData,
                peakHour: { hour: peakHour.hour, transactionCount: peakHour.transactionCount, totalRevenue: peakHour.totalRevenue },
                peakDay: { day: peakDay.dayName, transactionCount: peakDay.transactionCount, totalRevenue: peakDay.totalRevenue }
            }
        });
    } catch (error) {
        console.error("Peak Hours Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET PROFIT & LOSS REPORT
 */
exports.getProfitLoss = async (req, res) => {
    try {
        const { dateFilter } = parseDateRange(req.query);

        // Gross revenue from PAID/COMPLETED transactions
        const paidTransactions = await prisma.transaction.findMany({
            where: {
                ...dateFilter,
                status: { in: ['PAID', 'COMPLETED'] }
            },
            include: { items: true }
        });

        const grossRevenue = paidTransactions.reduce((sum, t) => sum + Number(t.grandTotal), 0);

        // COGS calculation
        let cogs = 0;
        for (const trx of paidTransactions) {
            for (const item of trx.items) {
                cogs += Number(item.costPrice) * item.qty;
            }
        }

        // Returns
        const returns = await prisma.transaction.findMany({
            where: { ...dateFilter, status: 'RETURNED' }
        });
        const returnTotal = returns.reduce((sum, t) => sum + Number(t.grandTotal), 0);

        // Net revenue
        const netRevenue = grossRevenue - returnTotal;

        // Gross profit
        const grossProfit = netRevenue - cogs;

        // Expenses
        const expenses = await prisma.expense.findMany({
            where: dateFilter
        });
        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

        // Expense breakdown by category
        const expenseCategoryMap = {};
        for (const exp of expenses) {
            const cat = exp.category || 'Umum';
            if (!expenseCategoryMap[cat]) expenseCategoryMap[cat] = 0;
            expenseCategoryMap[cat] += Number(exp.amount);
        }
        const expenseBreakdown = Object.entries(expenseCategoryMap).map(([category, amount]) => ({
            category,
            amount
        })).sort((a, b) => b.amount - a.amount);

        // Net profit
        const netProfit = grossProfit - totalExpenses;

        res.json({
            success: true,
            data: {
                grossRevenue,
                returnTotal,
                returnCount: returns.length,
                netRevenue,
                cogs,
                grossProfit,
                totalExpenses,
                netProfit,
                expenseBreakdown,
                transactionCount: paidTransactions.length
            }
        });
    } catch (error) {
        console.error("Profit Loss Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET RETURNS LIST
 */
exports.getReturnsList = async (req, res) => {
    try {
        const { dateFilter } = parseDateRange(req.query);
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const whereClause = {
            ...dateFilter,
            status: 'RETURNED'
        };

        const [returns, total] = await prisma.$transaction([
            prisma.transaction.findMany({
                where: whereClause,
                include: {
                    items: { include: { product: { select: { name: true, sku: true } } } },
                    user: { select: { name: true } },
                    customer: { select: { name: true, phone: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.transaction.count({ where: whereClause })
        ]);

        res.json({
            success: true,
            data: returns,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Returns List Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
