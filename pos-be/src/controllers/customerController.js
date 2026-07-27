const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper: Generate ID Member Otomatis (Format: MBR-0001)
const generateMemberId = async () => {
  const lastCustomer = await prisma.customer.findFirst({
    where: { memberId: { startsWith: 'MBR-' } },
    orderBy: { id: 'desc' }
  });

  let sequence = 1;
  if (lastCustomer && lastCustomer.memberId) {
    const parts = lastCustomer.memberId.split('-');
    if (parts.length === 2) {
      sequence = parseInt(parts[1]) + 1;
    }
  }
  return `MBR-${String(sequence).padStart(4, '0')}`;
};

exports.getAllCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { memberId: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        transactions: {
          where: { status: 'PAID' },
          select: { grandTotal: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedData = customers.map(cust => {
      const totalSpent = cust.transactions.reduce((sum, trx) => sum + Number(trx.grandTotal), 0);
      return {
        id: cust.id,
        memberId: cust.memberId,
        name: cust.name,
        phone: cust.phone,
        email: cust.email,
        imageUrl: cust.imageUrl,
        displayType: cust.displayType,
        totalSpent: totalSpent,
        totalVisits: cust.transactions.length
      };
    });

    res.json({ success: true, data: formattedData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, email, displayType } = req.body;
    const validName = name && String(name).trim();

    if (!validName) {
      return res.status(400).json({ success: false, message: "Nama pelanggan wajib diisi." });
    }

    /**
     * LOGIKA PENYIMPANAN LOKAL:
     * Menggunakan req.file.filename untuk menyimpan path relatif folder uploads.
     */
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const memberId = await generateMemberId();

    const validPhone = phone && String(phone).trim() !== "" ? String(phone).trim() : null;
    const validEmail = email && String(email).trim() !== "" ? String(email).trim() : null;

    if (validPhone && validPhone.length > 20) {
      return res.status(400).json({ success: false, message: "Nomor HP maksimal 20 karakter." });
    }

    if (validPhone) {
      const exist = await prisma.customer.findUnique({ where: { phone: validPhone } });
      if (exist) return res.status(400).json({ success: false, message: "Nomor HP sudah terdaftar!" });
    }

    const customer = await prisma.customer.create({
      data: {
        memberId,
        name: validName,
        phone: validPhone,
        email: validEmail,
        imageUrl,
        displayType: displayType || 'normal'
      }
    });

    res.status(201).json({ success: true, message: "Pelanggan berhasil ditambahkan", data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, displayType } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone.trim() !== "" ? phone : null;
    if (email) updateData.email = email.trim() !== "" ? email : null;
    if (displayType) updateData.displayType = displayType;

    // Update foto menggunakan jalur lokal jika ada file baru yang diunggah
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const customer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ success: true, message: "Data pelanggan berhasil diupdate", data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.customer.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: "Pelanggan berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
