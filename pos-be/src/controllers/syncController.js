const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 1. GET MASTER DATA
 * Mengembalikan semua data katalog yang dibutuhkan aplikasi Android
 * untuk disimpan ke dalam database SQLite lokal.
 */
exports.getMasterData = async (req, res) => {
  try {
    const [
      settings,
      loyaltyConfig,
      categories,
      products,
      addons,
      users,
      customers,
      suppliers,
      packages,
      packageItems,
      tables
    ] = await Promise.all([
      prisma.storeSetting.findFirst(),
      prisma.loyaltyConfig.findFirst(),
      prisma.category.findMany(),
      prisma.product.findMany(),
      prisma.productAddon.findMany(),
      prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } }),
      prisma.customer.findMany(),
      prisma.supplier.findMany(),
      prisma.package.findMany(),
      prisma.packageItem.findMany(),
      prisma.dineTable.findMany()
    ]);

    // Format settings to Key-Value array as expected by Android SQLite
    const formattedSettings = settings ? [
      { key: 'storeName', value: settings.storeName },
      { key: 'storeAddress', value: settings.address || '' },
      { key: 'storePhone', value: settings.phone || '' },
      { key: 'storeLogo', value: settings.logoUrl || '' },
      { key: 'enablePreOrder', value: settings.enablePreOrder ? 'true' : 'false' },
      { key: 'enableShift', value: settings.enableShift ? 'true' : 'false' },
      { key: 'enableDineTable', value: settings.enableDineTable ? 'true' : 'false' },
      { key: 'enableTableOrder', value: settings.enableTableOrder ? 'true' : 'false' },
      { key: 'receiptFooter', value: settings.receiptFooter || '' },
      { key: 'taxRate', value: settings.taxRate.toString() },
      { key: 'serviceCharge', value: settings.serviceCharge.toString() },
      { key: 'takeawayOptions', value: settings.takeawayOptions || '[]' },
      { key: 'allowNegativeStock', value: settings.allowNegativeStock ? 'true' : 'false' },
      { key: 'showImages', value: settings.showImages ? 'true' : 'false' },
      { key: 'theme', value: settings.theme || 'light' }
    ] : [];

    // Add loyalty config as settings too for easy access in Android
    if (loyaltyConfig) {
      formattedSettings.push(
        { key: 'loyalty_multiplier', value: loyaltyConfig.pointMultiplier.toString() },
        { key: 'loyalty_multiplier_amount', value: loyaltyConfig.multiplierAmount.toString() },
        { key: 'loyalty_point_value', value: loyaltyConfig.pointValue.toString() },
        { key: 'loyalty_min_points', value: loyaltyConfig.minRedemptionPoints.toString() },
        { key: 'loyalty_active', value: loyaltyConfig.isActive ? 'true' : 'false' }
      );
    }

    console.log(`[SYNC] getMasterData → settings: ${formattedSettings.length}, categories: ${categories.length}, products: ${products.length}, users: ${users.length}, customers: ${customers.length}, suppliers: ${suppliers.length}, packages: ${packages.length}, addons: ${addons.length}`);

    res.json({
      success: true,
      data: {
        settings: formattedSettings,
        categories,
        products,
        addons,
        users,
        customers,
        suppliers,
        packages,
        package_items: packageItems,
        tables
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 2. PUSH LOCAL DATA
 * Menerima data transaksi, pengeluaran, dan shift yang dibuat secara offline di perangkat Android,
 * lalu menyimpannya secara massal ke database MySQL server.
 */
exports.pushLocalData = async (req, res) => {
  try {
    const { transactions, expenses, shifts, categories, products, customers, settings, stockReceipts, suppliers: pushSuppliers, packages: pushPackages, dineTables, addons: pushAddons } = req.body;
    let savedTransactions = 0;
    let savedExpenses = 0;
    let savedShifts = 0;
    let savedCategories = 0;
    let savedProducts = 0;
    let savedCustomers = 0;
    let savedStockReceipts = 0;
    let savedSuppliers = 0;
    let savedPackages = 0;
    let savedDineTables = 0;
    let savedAddons = 0;
    const syncWarnings = [];

    const addSyncWarning = (entity, id, error) => {
        const message = error?.message || String(error);
        console.error(`[SYNC] Gagal proses ${entity} id=${id ?? '-'}:`, message);
        syncWarnings.push({ entity, id: id ?? null, message });
    };

    const nonEmptyString = (value) => {
        if (value === null || value === undefined) return null;
        const normalized = String(value).trim();
        return normalized || null;
    };

    const finiteNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    // 0. Proses Settings dari Android → update StoreSetting & LoyaltyConfig di server
    if (settings && Array.isArray(settings) && settings.length > 0) {
        const settingsMap = {};
        for (const s of settings) {
            settingsMap[s.key] = s.value;
        }

        // Update StoreSetting — "non-empty wins" merge strategy
        // String fields: only update if Android value is non-empty (prevent overwriting website data with empty)
        // Boolean fields: always sync (false is a valid value)
        const storeSettingData = {};
        const storeName = nonEmptyString(settingsMap.storeName);
        const storeAddress = nonEmptyString(settingsMap.storeAddress);
        const storePhone = nonEmptyString(settingsMap.storePhone);
        const receiptFooter = nonEmptyString(settingsMap.receiptFooter);
        const theme = nonEmptyString(settingsMap.theme);
        if (storeName) storeSettingData.storeName = storeName;
        if (storeAddress) storeSettingData.address = storeAddress;
        if (storePhone) storeSettingData.phone = storePhone;
        if (receiptFooter) storeSettingData.receiptFooter = receiptFooter;
        if (settingsMap.enablePreOrder !== undefined) storeSettingData.enablePreOrder = settingsMap.enablePreOrder === 'true';
        if (settingsMap.enableShift !== undefined) storeSettingData.enableShift = settingsMap.enableShift === 'true';
        if (settingsMap.enableDineTable !== undefined) storeSettingData.enableDineTable = settingsMap.enableDineTable === 'true';
        if (settingsMap.enableTableOrder !== undefined) storeSettingData.enableTableOrder = settingsMap.enableTableOrder === 'true';
        if (storeSettingData.enableTableOrder === true) storeSettingData.enableDineTable = true;
        if (storeSettingData.enableTableOrder !== true && storeSettingData.enableDineTable === false) storeSettingData.enableTableOrder = false;
        if (settingsMap.allowNegativeStock !== undefined) storeSettingData.allowNegativeStock = settingsMap.allowNegativeStock === 'true';
        if (settingsMap.showImages !== undefined) storeSettingData.showImages = settingsMap.showImages === 'true';
        if (theme) storeSettingData.theme = theme;

        if (Object.keys(storeSettingData).length > 0) {
            const firstSetting = await prisma.storeSetting.findFirst();
            if (firstSetting) {
                await prisma.storeSetting.update({ where: { id: firstSetting.id }, data: storeSettingData });
            } else {
                await prisma.storeSetting.create({ data: { storeName: storeSettingData.storeName || 'LitePOS Store', ...storeSettingData } });
            }
        }

        // Update LoyaltyConfig
        if (settingsMap.loyalty_active !== undefined || settingsMap.loyalty_multiplier !== undefined) {
            const loyaltyData = {};
            const pointMultiplier = finiteNumber(settingsMap.loyalty_multiplier);
            const multiplierAmount = finiteNumber(settingsMap.loyalty_multiplier_amount);
            const pointValue = finiteNumber(settingsMap.loyalty_point_value);
            const minRedemptionPoints = finiteNumber(settingsMap.loyalty_min_points);
            if (pointMultiplier !== null) loyaltyData.pointMultiplier = pointMultiplier;
            if (multiplierAmount !== null) loyaltyData.multiplierAmount = multiplierAmount;
            if (pointValue !== null) loyaltyData.pointValue = pointValue;
            if (minRedemptionPoints !== null) loyaltyData.minRedemptionPoints = Math.trunc(minRedemptionPoints);
            if (settingsMap.loyalty_active !== undefined) loyaltyData.isActive = settingsMap.loyalty_active === 'true';

            if (Object.keys(loyaltyData).length > 0) {
                const firstLoyalty = await prisma.loyaltyConfig.findFirst();
                if (firstLoyalty) {
                    await prisma.loyaltyConfig.update({ where: { id: firstLoyalty.id }, data: loyaltyData });
                } else {
                    await prisma.loyaltyConfig.create({ data: { id: 1, ...loyaltyData } });
                }
            }
        }
    }

    // A. Proses Customers
    const customerIdMap = [];
    if (customers && Array.isArray(customers)) {
        for (const cust of customers) {
            try {
                let serverCust = await prisma.customer.findUnique({ where: { androidId: cust.id }});
                if (!serverCust) {
                    serverCust = await prisma.customer.create({
                        data: {
                            androidId: cust.id,
                            memberId: cust.memberId || `CUST-A${cust.id}-${Date.now()}`,
                            name: cust.name,
                            phone: cust.phone || null,
                            loyaltyDiscount: Number(cust.loyaltyDiscount || 0),
                            points: parseInt(cust.points || 0)
                        }
                    });
                    savedCustomers++;
                } else {
                    await prisma.customer.update({
                        where: { id: serverCust.id },
                        data: {
                            points: parseInt(cust.points || 0),
                            loyaltyDiscount: Number(cust.loyaltyDiscount || 0),
                            phone: cust.phone || serverCust.phone
                        }
                    });
                }
                customerIdMap.push({ androidId: cust.id, serverId: serverCust.id });
            } catch (error) {
                addSyncWarning('customer', cust.id, error);
            }
        }
    }

    // A. Proses Categories
    const categoryIdMap = [];
    if (categories && Array.isArray(categories)) {
        for (const cat of categories) {
            try {
                let serverCat = await prisma.category.findUnique({ where: { androidId: cat.id }});
                // Fallback: jika kategori dibuat dari web (tidak punya androidId), cari berdasarkan serverId
                if (!serverCat && cat.serverId) {
                    serverCat = await prisma.category.findUnique({ where: { id: parseInt(cat.serverId) }});
                    if (serverCat) {
                        await prisma.category.update({ where: { id: serverCat.id }, data: { androidId: cat.id } });
                    }
                }
                if (!serverCat) {
                    serverCat = await prisma.category.create({
                        data: {
                            androidId: cat.id,
                            name: cat.name,
                            displayType: 'normal'
                        }
                    });
                    savedCategories++;
                } else {
                    await prisma.category.update({
                        where: { id: serverCat.id },
                        data: { name: cat.name || serverCat.name }
                    });
                }
                categoryIdMap.push({ androidId: cat.id, serverId: serverCat.id });
            } catch (error) {
                addSyncWarning('category', cat.id, error);
            }
        }
    }

    // B. Proses Products
    const productIdMap = [];
    if (products && Array.isArray(products)) {
        for (const prod of products) {
            try {
                let serverProd = await prisma.product.findUnique({ where: { androidId: prod.id }});
                // Fallback: jika produk dibuat dari web (tidak punya androidId), cari berdasarkan serverId
                if (!serverProd && prod.serverId) {
                    serverProd = await prisma.product.findUnique({ where: { id: parseInt(prod.serverId) }});
                    if (serverProd) {
                        await prisma.product.update({ where: { id: serverProd.id }, data: { androidId: prod.id } });
                    }
                }
                if (!serverProd) {
                    const category = await prisma.category.findUnique({ where: { androidId: prod.categoryId }});
                    const categoryId = category ? category.id : prod.categoryId;

                    serverProd = await prisma.product.create({
                        data: {
                            androidId: prod.id,
                            categoryId: categoryId,
                            sku: prod.sku || `PROD-${prod.id}-${Date.now()}`,
                            name: prod.name,
                            price: Number(prod.price),
                            costPrice: Number(prod.costPrice || 0),
                            stock: Number(prod.stock || 0),
                            isActive: true,
                            isUnlimitedStock: Boolean(prod.isUnlimitedStock)
                        }
                    });
                    savedProducts++;
                } else {
                    const category = await prisma.category.findUnique({ where: { androidId: prod.categoryId }});
                    const categoryId = category ? category.id : (prod.categoryId || serverProd.categoryId);

                    await prisma.product.update({
                        where: { id: serverProd.id },
                        data: {
                            name: prod.name || serverProd.name,
                            price: Number(prod.price),
                            costPrice: Number(prod.costPrice || 0),
                            categoryId: categoryId,
                            stock: Number(prod.stock ?? serverProd.stock),
                            isUnlimitedStock: prod.isUnlimitedStock !== undefined ? Boolean(prod.isUnlimitedStock) : serverProd.isUnlimitedStock,
                            barcode: prod.barcode || serverProd.barcode,
                            minStock: prod.minStock !== undefined ? Number(prod.minStock) : serverProd.minStock
                        }
                    });
                    savedProducts++;
                }
                productIdMap.push({ androidId: prod.id, serverId: serverProd.id });
            } catch (error) {
                addSyncWarning('product', prod.id, error);
            }
        }
    }

    // A. Proses Transactions
    if (transactions && Array.isArray(transactions)) {
      for (const tx of transactions) {
        try {
        // Cek jika sudah ada (identity check menggunakan androidId)
        const exists = await prisma.transaction.findUnique({ where: { androidId: tx.id }});
        if (exists && tx.status === 'RETURNED' && exists.status !== 'RETURNED') {
          // ── UPDATE STATUS RETUR ─────────────────────────────────
          // Transaksi sudah ada di server tapi diretur dari Android
          await prisma.transaction.update({
            where: { id: exists.id },
            data: { status: 'RETURNED' }
          });

          // Kembalikan stok di server (reverse stock decrement)
          const existingItems = await prisma.transactionItem.findMany({
            where: { transactionId: exists.id }
          });
          for (const item of existingItems) {
            try {
              await prisma.product.updateMany({
                where: { id: item.productId, isUnlimitedStock: false },
                data: { stock: { increment: item.qty } }
              });
              await prisma.stockMovement.create({
                data: {
                  productId: item.productId,
                  type: 'IN',
                  qty: item.qty,
                  source: 'RETURN',
                  description: `Retur dari Android sync (INV: ${exists.invoiceNumber})`,
                  createdAt: new Date()
                }
              });
            } catch (stockErr) {
              console.error(`[SYNC] Gagal reverse stok retur productId=${item.productId}:`, stockErr.message);
            }
          }
          savedTransactions++;
        } else if (!exists) {
          // Hitung subTotal jika tidak dikirim (Android mungkin belum kirim)
          const grandTotal = Number(tx.grandTotal);
          const discountAmount = tx.discountAmount ? Number(tx.discountAmount) : 0;
          const subTotal = grandTotal + discountAmount; // Asumsi sederhana

          // Resolve customerId dari androidId ke serverId
          let resolvedCustomerId = null;
          if (tx.customerId) {
              const parsedCustId = parseInt(tx.customerId);
              if (!isNaN(parsedCustId)) {
                  const customer = await prisma.customer.findUnique({ where: { androidId: parsedCustId }});
                  resolvedCustomerId = customer ? customer.id : null;
              }
          }

          // Resolve productId untuk setiap item
          const resolvedItems = await Promise.all((tx.items || []).map(async item => {
              let serverProductId = null;
              if (item.serverProductId) {
                  serverProductId = parseInt(item.serverProductId);
              } else {
                  const parsedProdId = parseInt(item.productId);
                  if (!isNaN(parsedProdId)) {
                      const product = await prisma.product.findUnique({ where: { androidId: parsedProdId }});
                      serverProductId = product ? product.id : parsedProdId;
                  } else {
                      serverProductId = item.productId; // Fallback
                  }
              }
              return {
                  productId: serverProductId,
                  qty: parseInt(item.quantity) || 1,
                  price: Number(item.price),
                  costPrice: 0,
                  notes: item.notes || null,
              };
          }));

          // Map payment method to payment record
          const paymentType = (tx.paymentMethod || 'CASH').toUpperCase();
          const validPaymentType = ['CASH', 'QRIS', 'TRANSFER'].includes(paymentType) ? paymentType : 'CASH';

          // Buat transaction & isinya
          await prisma.transaction.create({
            data: {
              androidId: tx.id,
              invoiceNumber: tx.invoiceNumber,
              subTotal: subTotal,
              taxAmount: 0,
              grandTotal: grandTotal,
              cashAmount: tx.cashAmount ? Number(tx.cashAmount) : null,
              changeAmount: tx.changeAmount ? Number(tx.changeAmount) : null,
              status: tx.status || 'COMPLETED',
              customerId: resolvedCustomerId,
              customerName: tx.customerName || null,
              userId: req.user.id,
              orderType: tx.orderType || 'TAKE_AWAY',
              tableNumber: tx.tableName || null,
              preOrderDate: tx.preOrderDate ? new Date(tx.preOrderDate) : null,
              discountAmount: discountAmount,
              createdAt: new Date(tx.createdAt),
              
              items: {
                create: resolvedItems
              },

              payments: {
                create: [{
                    paymentType: validPaymentType,
                    amount: grandTotal
                }]
              }
            }
          });
          
          // Kurangi stok produk secara langsung dan catat log pergerakan stok
          for(const item of (tx.items || [])){
              if(item.productId){
                  try {
                      const parsedAndroidId = parseInt(item.productId);
                      let serverProductId = null;
                      if(!isNaN(parsedAndroidId)) {
                          const product = await prisma.product.findUnique({ where: { androidId: parsedAndroidId }});
                          serverProductId = product ? product.id : parsedAndroidId;
                      } else {
                          serverProductId = item.productId;
                      }
                      const qty = parseInt(item.quantity) || 1;

                      await prisma.product.updateMany({
                          where: { id: serverProductId, isUnlimitedStock: false },
                          data: { stock: { decrement: qty } }
                      });

                      await prisma.stockMovement.create({
                          data: {
                              productId: serverProductId,
                              type: 'OUT',
                              qty: qty,
                              source: 'SALE',
                              description: `Penjualan offline via sync (INV: ${tx.invoiceNumber})`,
                              createdAt: new Date(tx.createdAt || Date.now())
                          }
                      });
                  } catch(stockErr) {
                      console.error(`[SYNC] Gagal update stok untuk item productId=${item.productId}:`, stockErr.message);
                  }
              }
          }
          savedTransactions++;
        }
        } catch(txErr) {
            addSyncWarning('transaction', tx.id, txErr);
        }
      }
    }

    // B. Proses Expenses (Android id = Int lokal, bisa bentrok dg autoincrement server)
    if (expenses && Array.isArray(expenses)) {
        for (const exp of expenses) {
            try {
                // Dedup berdasarkan amount + createdAt karena id bisa bentrok
                const existsByContent = await prisma.expense.findFirst({
                    where: {
                        amount: Number(exp.amount),
                        createdAt: new Date(exp.createdAt)
                    }
                });
                if (!existsByContent) {
                    await prisma.expense.create({
                        data: {
                            description: exp.description,
                            amount: Number(exp.amount),
                            category: exp.category || "Umum",
                            createdAt: new Date(exp.createdAt)
                        }
                    });
                    savedExpenses++;
                }
            } catch(expErr) {
                addSyncWarning('expense', exp.id, expErr);
            }
        }
    }

    // C. Proses Shifts (id = UUID string, aman)
    if (shifts && Array.isArray(shifts)) {
        for (const shift of shifts) {
            try {
                const exists = await prisma.shift.findUnique({ where: { id: shift.id }});
                if (!exists) {
                    await prisma.shift.create({
                        data: {
                            id: shift.id,
                            userId: shift.userId || req.user.id,
                            userName: shift.userName || req.user.name,
                            openedAt: new Date(shift.openedAt),
                            closedAt: shift.closedAt ? new Date(shift.closedAt) : null,
                            openingCash: Number(shift.openingCash),
                            closingCash: shift.closingCash ? Number(shift.closingCash) : null,
                            status: shift.status || 'OPEN'
                        }
                    });
                } else {
                    if(shift.status === 'CLOSED' && exists.status === 'OPEN'){
                        await prisma.shift.update({
                            where: { id: shift.id },
                            data: {
                                status: 'CLOSED',
                                closedAt: new Date(shift.closedAt),
                                closingCash: Number(shift.closingCash)
                            }
                        });
                    }
                }
                savedShifts++;
            } catch(shiftErr) {
                addSyncWarning('shift', shift.id, shiftErr);
            }
        }
    }

    // D. Proses Stock Receipts
    if (stockReceipts && Array.isArray(stockReceipts)) {
        for (const receipt of stockReceipts) {
          try {
            const exists = await prisma.stockReceipt.findUnique({ where: { id: receipt.id }});
            if (!exists) {
                // Buat stock receipt header
                await prisma.stockReceipt.create({
                    data: {
                        id: receipt.id,
                        receivedAt: new Date(receipt.receivedAt),
                        notes: receipt.notes || 'Sync dari Android',
                        createdBy: receipt.createdBy || req.user.name,
                        items: {
                            create: await Promise.all((receipt.items || []).map(async item => {
                                let serverProductId = item.serverProductId ? parseInt(item.serverProductId) : null;
                                if (!serverProductId) {
                                    const parsedId = parseInt(item.productId);
                                    serverProductId = parsedId;
                                    if(!isNaN(parsedId)) {
                                        const product = await prisma.product.findUnique({ where: { androidId: parsedId }});
                                        serverProductId = product ? product.id : parsedId;
                                    }
                                }
                                return {
                                    productId: serverProductId,
                                    productName: item.productName || null,
                                    quantityBefore: parseInt(item.quantityBefore) || 0,
                                    quantityAdded: parseInt(item.quantityAdded) || 0,
                                    costPrice: Number(item.costPrice || 0)
                                };
                            }))
                        }
                    }
                });

                // Update stock and create Stock Movement
                for (const item of (receipt.items || [])) {
                    let serverProductId = item.serverProductId ? parseInt(item.serverProductId) : null;
                    if (!serverProductId) {
                        const parsedId = parseInt(item.productId);
                        serverProductId = parsedId;
                        if(!isNaN(parsedId)) {
                            const product = await prisma.product.findUnique({ where: { androidId: parsedId }});
                            serverProductId = product ? product.id : parsedId;
                        }
                    }
                    const qtyAdded = parseInt(item.quantityAdded) || 0;
                    if(qtyAdded !== 0) {
                        await prisma.product.update({
                            where: { id: serverProductId },
                            data: { stock: { increment: qtyAdded } }
                        });
                        await prisma.stockMovement.create({
                            data: {
                                productId: serverProductId,
                                type: qtyAdded > 0 ? 'IN' : 'OUT',
                                qty: Math.abs(qtyAdded),
                                source: 'ADJUSTMENT',
                                description: `Stock Opname/Receipt via Android Offline Sync`,
                                createdAt: new Date(receipt.receivedAt)
                            }
                        });
                    }
                }
                savedStockReceipts++;
            }
          } catch(receiptErr) {
              addSyncWarning('stockReceipt', receipt.id, receiptErr);
          }
        }
    }

    // E. Proses Suppliers dari Android
    const supplierIdMap = [];
    if (pushSuppliers && Array.isArray(pushSuppliers)) {
        for (const supp of pushSuppliers) {
            try {
                let serverSupp = await prisma.supplier.findUnique({ where: { androidId: supp.id }});
                if (!serverSupp) {
                    serverSupp = await prisma.supplier.create({
                        data: {
                            androidId: supp.id,
                            name: supp.name,
                            phone: supp.phone || null,
                            address: supp.address || null,
                            notes: supp.notes || null
                        }
                    });
                    savedSuppliers++;
                } else {
                    await prisma.supplier.update({
                        where: { id: serverSupp.id },
                        data: {
                            name: supp.name || serverSupp.name,
                            phone: supp.phone || serverSupp.phone,
                            address: supp.address || serverSupp.address,
                            notes: supp.notes || serverSupp.notes
                        }
                    });
                }
                supplierIdMap.push({ androidId: supp.id, serverId: serverSupp.id });
            } catch(e) { addSyncWarning('supplier', supp.id, e); }
        }
    }

    // F. Proses Packages dari Android
    const packageIdMap = [];
    if (pushPackages && Array.isArray(pushPackages)) {
        for (const pkg of pushPackages) {
            try {
                let serverPkg = await prisma.package.findUnique({ where: { androidId: pkg.id }});
                if (!serverPkg) {
                    serverPkg = await prisma.package.create({
                        data: {
                            androidId: pkg.id,
                            name: pkg.name,
                            description: pkg.description || null,
                            price: Number(pkg.price),
                            isActive: Boolean(pkg.isActive)
                        }
                    });
                    savedPackages++;
                } else {
                    await prisma.package.update({
                        where: { id: serverPkg.id },
                        data: {
                            name: pkg.name || serverPkg.name,
                            description: pkg.description || serverPkg.description,
                            price: Number(pkg.price),
                            isActive: Boolean(pkg.isActive)
                        }
                    });
                }
                // Process package items
                if (pkg.items && Array.isArray(pkg.items)) {
                    for (const item of pkg.items) {
                        let serverProductId = item.serverProductId ? parseInt(item.serverProductId) : null;
                        if (!serverProductId) {
                            const parsedProdId = parseInt(item.productId);
                            serverProductId = parsedProdId;
                            if (!isNaN(parsedProdId)) {
                                const product = await prisma.product.findUnique({ where: { androidId: parsedProdId }});
                                serverProductId = product ? product.id : parsedProdId;
                            }
                        }
                        const existingItem = await prisma.packageItem.findFirst({
                            where: { packageId: serverPkg.id, productId: serverProductId }
                        });
                        if (!existingItem) {
                            await prisma.packageItem.create({
                                data: {
                                    packageId: serverPkg.id,
                                    productId: serverProductId,
                                    qty: parseInt(item.quantity) || 1
                                }
                            });
                        } else {
                            await prisma.packageItem.update({
                                where: { id: existingItem.id },
                                data: { qty: parseInt(item.quantity) || 1 }
                            });
                        }
                    }
                }
                packageIdMap.push({ androidId: pkg.id, serverId: serverPkg.id });
            } catch(e) { addSyncWarning('package', pkg.id, e); }
        }
    }

    // G. Proses DineTables dari Android
    const dineTableIdMap = [];
    if (dineTables && Array.isArray(dineTables)) {
        for (const table of dineTables) {
            try {
                let serverTable = await prisma.dineTable.findUnique({ where: { androidId: table.id }});
                if (!serverTable) {
                    // Check if table number already exists
                    const existingByNumber = await prisma.dineTable.findUnique({ where: { number: String(table.number) }});
                    if (existingByNumber) {
                        await prisma.dineTable.update({
                            where: { id: existingByNumber.id },
                            data: { androidId: table.id, name: table.name || existingByNumber.name }
                        });
                        serverTable = existingByNumber;
                    } else {
                        serverTable = await prisma.dineTable.create({
                            data: {
                                androidId: table.id,
                                number: String(table.number),
                                name: table.name || null,
                                capacity: parseInt(table.capacity) || 4,
                                status: table.status || 'AVAILABLE'
                            }
                        });
                        savedDineTables++;
                    }
                }
                dineTableIdMap.push({ androidId: table.id, serverId: serverTable.id });
            } catch(e) { addSyncWarning('dineTable', table.id, e); }
        }
    }

    // H. Proses Product Addons dari Android
    const addonIdMap = [];
    if (pushAddons && Array.isArray(pushAddons)) {
        for (const addon of pushAddons) {
            try {
                let serverProductId = addon.serverProductId ? parseInt(addon.serverProductId) : null;
                if (!serverProductId) {
                    const parsedProdId = parseInt(addon.productId);
                    serverProductId = parsedProdId;
                    if (!isNaN(parsedProdId)) {
                        const product = await prisma.product.findUnique({ where: { androidId: parsedProdId }});
                        serverProductId = product ? product.id : parsedProdId;
                    }
                }

                let serverAddon = await prisma.productAddon.findFirst({
                    where: { androidId: addon.id }
                });
                if (!serverAddon) {
                    serverAddon = await prisma.productAddon.create({
                        data: {
                            androidId: addon.id,
                            productId: serverProductId,
                            name: addon.name,
                            price: Number(addon.price || 0)
                        }
                    });
                    savedAddons++;
                } else {
                    await prisma.productAddon.update({
                        where: { id: serverAddon.id },
                        data: {
                            name: addon.name || serverAddon.name,
                            price: Number(addon.price || 0),
                            productId: serverProductId
                        }
                    });
                }
                addonIdMap.push({ androidId: addon.id, serverId: serverAddon.id });
            } catch(e) { addSyncWarning('addon', addon.id, e); }
        }
    }

    res.json({
      success: true,
      message: `Berhasil sinkronisasi. Transaksi: ${savedTransactions}, Produk: ${savedProducts}, Kategori: ${savedCategories}, Pelanggan: ${savedCustomers}, Supplier: ${savedSuppliers}, Paket: ${savedPackages}`,
      stats: { savedTransactions, savedExpenses, savedShifts, savedCategories, savedProducts, savedCustomers, savedStockReceipts, savedSuppliers, savedPackages, savedDineTables, savedAddons },
      warnings: syncWarnings,
      idMap: {
          categories: categoryIdMap,
          products: productIdMap,
          customers: customerIdMap,
          suppliers: supplierIdMap,
          packages: packageIdMap,
          dineTables: dineTableIdMap,
          addons: addonIdMap
      }
    });

  } catch (error) {
    console.error('[SYNC] pushLocalData gagal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 3. GET TRANSACTION HISTORY
 * Mengembalikan histori transaksi 30 hari terakhir beserta items, payments,
 * expenses, dan shifts agar Android bisa menampilkan laporan lengkap.
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Ambil transaksi 30 hari terakhir beserta items dan payments
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, androidId: true, name: true } }
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format untuk Android SQLite
    const formattedTransactions = transactions.map(tx => ({
      id: tx.androidId || `server-${tx.id}`,
      serverId: tx.id,
      invoiceNumber: tx.invoiceNumber,
      grandTotal: Number(tx.grandTotal),
      discountAmount: Number(tx.discountAmount),
      paymentMethod: tx.payments.length > 0 ? tx.payments[0].paymentType : 'CASH',
      cashAmount: tx.cashAmount ? Number(tx.cashAmount) : null,
      changeAmount: tx.changeAmount ? Number(tx.changeAmount) : null,
      customerId: tx.customerId,
      customerName: tx.customerName,
      createdAt: tx.createdAt.toISOString(),
      status: tx.status,
      preOrderDate: tx.preOrderDate ? tx.preOrderDate.toISOString() : null,
      orderType: tx.orderType,
      tableName: tx.tableNumber,
      items: tx.items.map(item => ({
        productId: item.product?.androidId || item.productId,
        serverProductId: item.productId,
        productName: item.product?.name || null,
        quantity: item.qty,
        price: Number(item.price),
        notes: item.notes
      }))
    }));

    // Ambil expenses 30 hari terakhir
    const expenses = await prisma.expense.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedExpenses = expenses.map(exp => ({
      id: exp.id,
      description: exp.description,
      amount: Number(exp.amount),
      category: exp.category,
      createdAt: exp.createdAt.toISOString()
    }));

    // Ambil shifts 30 hari terakhir
    const shifts = await prisma.shift.findMany({
      where: {
        openedAt: { gte: thirtyDaysAgo }
      },
      orderBy: { openedAt: 'desc' }
    });

    const formattedShifts = shifts.map(s => ({
      id: s.id,
      userId: s.userId,
      userName: s.userName,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt ? s.closedAt.toISOString() : null,
      openingCash: Number(s.openingCash),
      closingCash: s.closingCash ? Number(s.closingCash) : null,
      status: s.status
    }));

    console.log(`[SYNC] getTransactionHistory → transactions: ${formattedTransactions.length}, expenses: ${formattedExpenses.length}, shifts: ${formattedShifts.length}`);

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        expenses: formattedExpenses,
        shifts: formattedShifts
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
