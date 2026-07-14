const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 1. GET SETTINGS
 * Mengambil konfigurasi toko. Jika data belum ada (instalasi baru),
 * maka sistem akan otomatis membuat satu record default.
 */
exports.getSettings = async (req, res) => {
  try {
    let setting = await prisma.storeSetting.findFirst();

    if (!setting) {
      // Buat pengaturan awal jika database masih kosong
      setting = await prisma.storeSetting.create({
        data: {
          storeName: "LitePOS Store",
          taxRate: 11,
          serviceCharge: 0,
          enableCash: true,
          enableQris: false,
          autoPrintReceipt: true
        }
      });
    }

    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 2. UPDATE SETTINGS
 * Mengupdate profil toko, kebijakan pajak, dan logo struk.
 */
exports.updateSettings = async (req, res) => {
  try {
    const {
      storeName, address, phone, email, website,
      taxRate, serviceCharge, receiptFooter,
      enableCash, enableQris, enableDebit, autoPrintReceipt,
      allowNegativeStock, showImages, theme
    } = req.body;

    const firstSetting = await prisma.storeSetting.findFirst();
    const id = firstSetting ? firstSetting.id : 0;

    const dataToUpdate = {};

    // Map data teks
    if (storeName) dataToUpdate.storeName = storeName;
    if (address) dataToUpdate.address = address;
    if (phone) dataToUpdate.phone = phone;
    if (email) dataToUpdate.email = email;
    if (website) dataToUpdate.website = website;
    if (receiptFooter) dataToUpdate.receiptFooter = receiptFooter;

    // Map data angka
    if (taxRate !== undefined) dataToUpdate.taxRate = parseFloat(taxRate);
    if (serviceCharge !== undefined) dataToUpdate.serviceCharge = parseFloat(serviceCharge);

    // Konversi string 'true'/'false' dari FormData menjadi Boolean murni
    if (enableCash !== undefined) dataToUpdate.enableCash = enableCash === 'true' || enableCash === true;
    if (enableQris !== undefined) dataToUpdate.enableQris = enableQris === 'true' || enableQris === true;
    if (enableDebit !== undefined) dataToUpdate.enableDebit = enableDebit === 'true' || enableDebit === true;
    if (autoPrintReceipt !== undefined) dataToUpdate.autoPrintReceipt = autoPrintReceipt === 'true' || autoPrintReceipt === true;

    // New PosAndroid integration toggles
    if (allowNegativeStock !== undefined) dataToUpdate.allowNegativeStock = allowNegativeStock === 'true' || allowNegativeStock === true;
    if (showImages !== undefined) dataToUpdate.showImages = showImages === 'true' || showImages === true;
    if (theme !== undefined) dataToUpdate.theme = theme;
    if (req.body.enablePreOrder !== undefined) dataToUpdate.enablePreOrder = req.body.enablePreOrder === 'true' || req.body.enablePreOrder === true;
    if (req.body.enableShift !== undefined) dataToUpdate.enableShift = req.body.enableShift === 'true' || req.body.enableShift === true;
    if (req.body.enableDineTable !== undefined) dataToUpdate.enableDineTable = req.body.enableDineTable === 'true' || req.body.enableDineTable === true;
    if (req.body.enableTableOrder !== undefined) dataToUpdate.enableTableOrder = req.body.enableTableOrder === 'true' || req.body.enableTableOrder === true;
    if (dataToUpdate.enableTableOrder === true) dataToUpdate.enableDineTable = true;
    if (dataToUpdate.enableTableOrder !== true && dataToUpdate.enableDineTable === false) dataToUpdate.enableTableOrder = false;
    if (req.body.takeawayOptions !== undefined) dataToUpdate.takeawayOptions = req.body.takeawayOptions;

    /**
     * LOGIKA PENYIMPANAN LOGO LOKAL:
     * Menggunakan req.file.filename untuk mendapatkan nama file unik di folder uploads.
     */
    if (req.file) {
      dataToUpdate.logoUrl = `/uploads/${req.file.filename}`;
    }

    // Upsert: Update jika ID ada, Create jika ID tidak ada (0)
    const updated = await prisma.storeSetting.upsert({
      where: { id: id },
      update: dataToUpdate,
      create: {
        storeName: storeName || "Savoria Bistro",
        ...dataToUpdate
      }
    });

    res.json({ success: true, message: "Pengaturan berhasil disimpan", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 3. GET LOYALTY CONFIG
 */
exports.getLoyaltyConfig = async (req, res) => {
  try {
    let config = await prisma.loyaltyConfig.findFirst();
    if (!config) {
        config = await prisma.loyaltyConfig.create({
            data: {
                pointMultiplier: 1,
                multiplierAmount: 10000,
                pointValue: 100,
                minRedemptionPoints: 10,
                isActive: true
            }
        });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 4. UPDATE LOYALTY CONFIG
 */
exports.updateLoyaltyConfig = async (req, res) => {
  try {
    const { pointMultiplier, multiplierAmount, pointValue, minRedemptionPoints, isActive } = req.body;
    
    let config = await prisma.loyaltyConfig.findFirst();
    const id = config ? config.id : 0;

    const data = {
        pointMultiplier: parseFloat(pointMultiplier),
        multiplierAmount: parseFloat(multiplierAmount),
        pointValue: parseFloat(pointValue),
        minRedemptionPoints: parseInt(minRedemptionPoints),
        isActive: isActive === true || isActive === 'true'
    };

    const updated = await prisma.loyaltyConfig.upsert({
        where: { id: id },
        update: data,
        create: { id: 1, ...data }
    });

    res.json({ success: true, message: "Konfigurasi loyalitas disimpan", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
