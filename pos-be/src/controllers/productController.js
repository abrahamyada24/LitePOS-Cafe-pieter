const { PrismaClient } = require('@prisma/client');
const { serializeProductPrice } = require('../utils/productDiscount');
const prisma = new PrismaClient();

const optionalDate = (value) => value ? new Date(value) : null;
const parseDiscountData = (body) => ({
  discountActive: body.discountActive === 'true' || body.discountActive === true || body.discountActive === 1,
  discountType: ['PERCENT', 'NOMINAL'].includes(String(body.discountType || '').toUpperCase())
    ? String(body.discountType).toUpperCase()
    : null,
  discountValue: Math.max(0, parseFloat(body.discountValue) || 0),
  discountStartAt: optionalDate(body.discountStartAt),
  discountEndAt: optionalDate(body.discountEndAt),
  discountStartTime: body.discountStartTime || null,
  discountEndTime: body.discountEndTime || null,
  discountDays: Array.isArray(body.discountDays) ? body.discountDays.join(',') : (body.discountDays || null),
  discountLabel: body.discountLabel || null
});

// Helper: Generate SKU Otomatis (Format: PROD-0001)
const generateAutoSKU = async () => {
  const lastProduct = await prisma.product.findFirst({
    orderBy: { id: 'desc' }
  });
  const nextId = lastProduct ? lastProduct.id + 1 : 1;
  return `PROD-${String(nextId).padStart(4, '0')}`;
};

exports.getAllProducts = async (req, res) => {
  try {
    const { search, category_id } = req.query;
    const whereClause = {};
    if (search) whereClause.name = { contains: search };
    if (category_id) whereClause.categoryId = parseInt(category_id);

    const products = await prisma.product.findMany({
      where: whereClause,
      include: { category: true, addons: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: products.map(product => serializeProductPrice(product)) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    let { sku, name, price, costPrice, stock, minStock, categoryId, isActive, displayType, barcode, isUnlimitedStock, enableCostPrice, addons } = req.body;

    // Handle SKU Otomatis jika kosong
    if (!sku || sku.trim() === "" || sku === "undefined") {
      sku = await generateAutoSKU();
    } else {
      const existing = await prisma.product.findUnique({ where: { sku: sku.toUpperCase() } });
      if (existing) return res.status(400).json({ success: false, message: "SKU sudah digunakan!" });
    }

    /**
     * LOGIKA PENYIMPANAN LOKAL:
     * req.file.filename berisi nama file unik (contoh: image-1712345.jpg)
     * Kita simpan dengan prefix '/uploads/' agar sinkron dengan express.static di app.js
     */
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const product = await prisma.product.create({
      data: {
        sku: sku.toUpperCase(),
        name,
        price: parseFloat(price) || 0,
        costPrice: parseFloat(costPrice) || 0,
        stock: parseInt(stock) || 0,
        categoryId: categoryId && categoryId !== "undefined" ? parseInt(categoryId) : null,
        isActive: isActive === 'true' || isActive === true,
        displayType: displayType || 'normal',
        imageUrl: imageUrl,
        barcode: barcode || null,
        isUnlimitedStock: isUnlimitedStock === 'true' || isUnlimitedStock === true,
        enableCostPrice: enableCostPrice === 'true' || enableCostPrice === true,
        minStock: parseInt(minStock) || 0,
        ...parseDiscountData(req.body)
      }
    });

    // Handle addons
    if (addons) {
      const addonsArray = typeof addons === 'string' ? JSON.parse(addons) : addons;
      if (addonsArray && addonsArray.length > 0) {
        await prisma.productAddon.createMany({
          data: addonsArray.map(addon => ({
            productId: product.id,
            name: addon.name,
            price: parseFloat(addon.price) || 0
          }))
        });
      }
    }

    res.status(201).json({ success: true, message: "Produk berhasil dibuat", data: serializeProductPrice(product) });
  } catch (error) {
    console.error("CREATE ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, price, costPrice, stock, minStock, categoryId, isActive, displayType, barcode, isUnlimitedStock, enableCostPrice, addons } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (sku) {
      const existing = await prisma.product.findFirst({
        where: { sku: sku.toUpperCase(), NOT: { id: parseInt(id) } }
      });
      if (existing) return res.status(400).json({ success: false, message: "SKU sudah digunakan produk lain!" });
      updateData.sku = sku.toUpperCase();
    }

    if (price !== undefined && price !== '') updateData.price = parseFloat(price) || 0;
    if (costPrice !== undefined && costPrice !== '') updateData.costPrice = parseFloat(costPrice) || 0;
    if (stock !== undefined && stock !== '') updateData.stock = parseInt(stock) || 0;
    if (categoryId && categoryId !== '' && categoryId !== 'undefined') updateData.categoryId = parseInt(categoryId);
    if (displayType) updateData.displayType = displayType;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (barcode !== undefined) updateData.barcode = barcode || null;
    if (isUnlimitedStock !== undefined) updateData.isUnlimitedStock = isUnlimitedStock === 'true' || isUnlimitedStock === true;
    if (enableCostPrice !== undefined) updateData.enableCostPrice = enableCostPrice === 'true' || enableCostPrice === true;
    if (minStock !== undefined) updateData.minStock = parseInt(minStock) || 0;
    if (req.body.discountActive !== undefined) Object.assign(updateData, parseDiscountData(req.body));

    // Handle upload gambar jika ada
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    // Handle addons
    if (addons) {
      const addonsArray = typeof addons === 'string' ? JSON.parse(addons) : addons;
      
      // Delete existing addons
      await prisma.productAddon.deleteMany({
        where: { productId: parseInt(id) }
      });
      
      // Insert new addons
      if (addonsArray && addonsArray.length > 0) {
        await prisma.productAddon.createMany({
          data: addonsArray.map(addon => ({
            productId: parseInt(id),
            name: addon.name,
            price: parseFloat(addon.price) || 0
          }))
        });
      }
    }

    res.json({ success: true, message: "Produk berhasil diupdate", data: serializeProductPrice(product) });
  } catch (error) {
    console.error("UPDATE ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    // Soft delete: nonaktifkan produk alih-alih menghapus dari database
    // Ini mencegah error foreign key constraint dari tabel terkait
    // (transaction_items, stock_movements, package_items, dll.)
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false }
    });

    res.json({ success: true, message: "Produk berhasil dinonaktifkan" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET PRODUCT BY BARCODE
exports.getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const product = await prisma.product.findFirst({
      where: { barcode, isActive: true },
      include: { category: true, addons: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan dengan barcode tersebut" });
    }

    res.json({ success: true, data: serializeProductPrice(product) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET PRODUCT WITH ADDONS
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { category: true, addons: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan" });
    }

    res.json({ success: true, data: serializeProductPrice(product) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
