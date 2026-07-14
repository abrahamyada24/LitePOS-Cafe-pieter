const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTP } = require('../utils/emailService');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        /**
         * LOGIKA PENYIMPANAN LOKAL:
         * Menggunakan req.file.filename untuk menyimpan path relatif folder uploads.
         */
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ success: false, message: "Email sudah terdaftar!" });

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'CASHIER',
                imageUrl // Simpan path lokal (/uploads/...)
            }
        });

        res.status(201).json({ success: true, message: "User berhasil didaftarkan!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[LOGIN ATTEMPT] Email: ${email}`);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            console.log(`[LOGIN FAILED] User not found: ${email}`);
            return res.status(401).json({ success: false, message: "Email atau Password salah!" });
        }

        if (password) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                console.log(`[LOGIN FAILED] Password mismatch for: ${email}`);
                return res.status(401).json({ success: false, message: "Email atau Password salah!" });
            }
        }

        if (!user.isActive) {
            console.log(`[LOGIN BLOCKED] Account inactive: ${email}`);
            return res.status(403).json({ success: false, message: "Akun non-aktif." });
        }

        // Generate Token Akses langsung tanpa OTP
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

        console.log(`[LOGIN SUCCESS] User: ${email}, Role: ${user.role}`);

        res.json({
            success: true,
            message: "Login Berhasil",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                imageUrl: user.imageUrl
            }
        });
    } catch (error) {
        console.error(`[LOGIN ERROR]: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.changePassword = async (req, res) => {
    // Logika ganti password (opsional)
};

exports.me = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'User tidak ditemukan atau non-aktif.' });
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                imageUrl: user.imageUrl
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
