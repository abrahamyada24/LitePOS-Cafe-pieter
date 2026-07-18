const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTP } = require('../utils/emailService');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const normalizedName = String(name || '').trim();
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedRole = String(role || 'CASHIER').toUpperCase();

        if (!normalizedName || !normalizedEmail || !password) {
            return res.status(400).json({
                success: false,
                message: 'Nama, email, dan password wajib diisi.'
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password minimal 6 karakter.'
            });
        }

        if (!['ADMIN', 'CASHIER'].includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                message: 'Role user tidak valid.'
            });
        }

        /**
         * LOGIKA PENYIMPANAN LOKAL:
         * Menggunakan req.file.filename untuk menyimpan path relatif folder uploads.
         */
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) return res.status(400).json({ success: false, message: "Email sudah terdaftar!" });

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                name: normalizedName,
                email: normalizedEmail,
                password: hashedPassword,
                role: normalizedRole,
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
        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email dan password wajib diisi.'
            });
        }

        console.log(`[LOGIN ATTEMPT] Email: ${normalizedEmail}`);

        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            console.log(`[LOGIN FAILED] User not found: ${normalizedEmail}`);
            return res.status(401).json({ success: false, message: "Email atau Password salah!" });
        }

        const isMatch = await bcrypt.compare(String(password), user.password);
        if (!isMatch) {
            console.log(`[LOGIN FAILED] Password mismatch for: ${normalizedEmail}`);
            return res.status(401).json({ success: false, message: "Email atau Password salah!" });
        }

        if (!user.isActive) {
            console.log(`[LOGIN BLOCKED] Account inactive: ${normalizedEmail}`);
            return res.status(403).json({ success: false, message: "Akun non-aktif." });
        }

        // Generate Token Akses langsung tanpa OTP
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

        console.log(`[LOGIN SUCCESS] User: ${normalizedEmail}, Role: ${user.role}`);

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
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Password lama dan password baru wajib diisi.' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || !user.isActive) {
            return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan atau tidak aktif.' });
        }

        const currentPasswordMatches = await bcrypt.compare(String(oldPassword), user.password);
        if (!currentPasswordMatches) {
            return res.status(401).json({ success: false, message: 'Password lama salah.' });
        }

        const newPasswordMatchesCurrent = await bcrypt.compare(String(newPassword), user.password);
        if (newPasswordMatchesCurrent) {
            return res.status(400).json({ success: false, message: 'Password baru harus berbeda dari password lama.' });
        }

        const hashedPassword = await bcrypt.hash(String(newPassword), 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        return res.json({ success: true, message: 'Password berhasil diubah.' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
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
