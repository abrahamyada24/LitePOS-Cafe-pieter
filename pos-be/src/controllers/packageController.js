const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const parseBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    return value === true || value === 1 || value === '1' || value === 'true';
};

const parseItems = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    const items = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(items)) throw new Error('Daftar isi paket tidak valid.');
    return items;
};

exports.getAllPackages = async (req, res) => {
    try {
        const packages = await prisma.package.findMany({
            include: {
                items: {
                    include: { product: true }
                }
            }
        });
        res.json({ success: true, data: packages });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getPackageById = async (req, res) => {
    try {
        const pkg = await prisma.package.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });
        if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
        res.json({ success: true, data: pkg });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.createPackage = async (req, res) => {
    try {
        const { name, description, price, isActive } = req.body;
        const items = parseItems(req.body.items, []);
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const newPackage = await prisma.package.create({
            data: {
                name,
                description,
                imageUrl,
                price: parseFloat(price),
                isActive: parseBoolean(isActive, true),
                items: {
                    create: items.map(item => ({
                        productId: parseInt(item.productId),
                        qty: parseInt(item.qty || 1)
                    }))
                }
            },
            include: { items: true }
        });
        res.status(201).json({ success: true, data: newPackage, message: 'Package created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updatePackage = async (req, res) => {
    try {
        const { name, description, price, isActive } = req.body;
        const items = parseItems(req.body.items, undefined);
        const packageId = Number(req.params.id);

        const updatedPackage = await prisma.$transaction(async (tx) => {
            // Delete old items
            if (items !== undefined) {
                await tx.packageItem.deleteMany({ where: { packageId } });
            }

            // Update package
            return await tx.package.update({
                where: { id: packageId },
                data: {
                    name: name !== undefined ? name : undefined,
                    description: description !== undefined ? description : undefined,
                    price: price !== undefined && price !== '' ? parseFloat(price) : undefined,
                    isActive: isActive !== undefined ? parseBoolean(isActive, true) : undefined,
                    imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
                    ...(items !== undefined && {
                        items: {
                            create: items.map(item => ({
                                productId: parseInt(item.productId),
                                qty: parseInt(item.qty || 1)
                            }))
                        }
                    })
                },
                include: { items: { include: { product: true } } }
            });
        });

        res.json({ success: true, data: updatedPackage, message: 'Package updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.deletePackage = async (req, res) => {
    try {
        const packageId = Number(req.params.id);
        
        await prisma.$transaction([
            prisma.packageItem.deleteMany({ where: { packageId } }),
            prisma.package.delete({ where: { id: packageId } })
        ]);

        res.json({ success: true, message: 'Package deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
