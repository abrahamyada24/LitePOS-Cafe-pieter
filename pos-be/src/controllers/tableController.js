const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getStatusUpdate = (status, currentTable) => ({
    status,
    statusUpdatedAt: new Date(),
    occupiedAt: status === 'OCCUPIED'
        ? (currentTable?.occupiedAt || new Date())
        : status === 'AVAILABLE' || status === 'RESERVED'
            ? null
            : currentTable?.occupiedAt || null
});

// 1. GET ALL TABLES
exports.getAllTables = async (req, res) => {
    try {
        const tables = await prisma.dineTable.findMany({
            orderBy: { number: 'asc' }
        });
        res.json({ success: true, data: tables });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. CREATE TABLE
exports.createTable = async (req, res) => {
    try {
        const { number, name, capacity } = req.body;

        if (!number) {
            return res.status(400).json({ success: false, message: "Nomor meja wajib diisi" });
        }

        const existing = await prisma.dineTable.findUnique({ where: { number } });
        if (existing) {
            return res.status(400).json({ success: false, message: "Nomor meja sudah digunakan" });
        }

        const table = await prisma.dineTable.create({
            data: {
                number,
                name: name || null,
                capacity: parseInt(capacity) || 4,
                status: 'AVAILABLE'
            }
        });

        res.status(201).json({ success: true, message: "Meja berhasil ditambahkan", data: table });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. UPDATE TABLE
exports.updateTable = async (req, res) => {
    try {
        const { id } = req.params;
        const { number, name, capacity, status } = req.body;

        const updateData = {};
        if (number) updateData.number = number;
        if (name !== undefined) updateData.name = name;
        if (capacity) updateData.capacity = parseInt(capacity);
        if (status) {
            const currentTable = await prisma.dineTable.findUnique({ where: { id: parseInt(id) } });
            Object.assign(updateData, getStatusUpdate(status, currentTable));
        }

        const table = await prisma.dineTable.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json({ success: true, message: "Meja berhasil diperbarui", data: table });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. DELETE TABLE
exports.deleteTable = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.dineTable.delete({ where: { id: parseInt(id) } });
        res.json({ success: true, message: "Meja berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 5. UPDATE TABLE STATUS (for real-time tracking)
exports.updateTableStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status tidak valid. Gunakan: ${validStatuses.join(', ')}`
            });
        }

        const currentTable = await prisma.dineTable.findUnique({ where: { id: parseInt(id) } });
        if (!currentTable) {
            return res.status(404).json({ success: false, message: 'Meja tidak ditemukan' });
        }

        const table = await prisma.dineTable.update({
            where: { id: parseInt(id) },
            data: getStatusUpdate(status, currentTable)
        });

        res.json({ success: true, message: "Status meja berhasil diperbarui", data: table });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
