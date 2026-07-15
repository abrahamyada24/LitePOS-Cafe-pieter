import api, { isDeviceAssetUrl } from './api';
import { getDBConnection } from '../database/db';

// Keys yang hanya ada di device lokal, tidak boleh ditimpa oleh server
const LOCAL_ONLY_KEYS = ['printerAddress', 'printerType', 'apiBaseUrl', 'enableKitchenPrint'];

const getImageUploadMetadata = (uri: string) => {
    const cleanUri = uri.split('?')[0];
    const extensionMatch = cleanUri.match(/\.([a-z0-9]+)$/i);
    const extension = (extensionMatch?.[1] || 'jpg').toLowerCase();
    const mimeType = extension === 'png'
        ? 'image/png'
        : extension === 'webp'
            ? 'image/webp'
            : 'image/jpeg';

    return {
        name: `product-${Date.now()}.${extension}`,
        type: mimeType,
    };
};

const uploadProductImage = async (serverProductId: number, imageUri: string) => {
    const formData = new FormData();
    const metadata = getImageUploadMetadata(imageUri);
    formData.append('image', {
        uri: imageUri,
        name: metadata.name,
        type: metadata.type,
    } as any);

    const response = await api.put(`/products/${serverProductId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
    });

    const remoteImageUrl = response.data?.data?.imageUrl;
    if (!remoteImageUrl) {
        throw new Error('Backend tidak mengembalikan URL gambar produk.');
    }

    return remoteImageUrl as string;
};

export const syncService = {
    // 1. Ambil data master dari server
    syncMasterData: async () => {
        try {
            const res = await api.get('/sync/master');
            const data = res.data.data;
            
            const db = await getDBConnection();
            
            // Lakukan dalam satu transaksi SQLite untuk menghindari UI macet (locking)
            // Lakukan secara berurutan tanpa db.transaction() karena library 
            // react-native-sqlite-storage tidak mendukung async/await dalam transaction callback
            const tx = db;
                // Settings — "NON-EMPTY WINS" merge strategy
                // Boolean keys: selalu update (false adalah value valid)
                // String keys: hanya update jika server value non-kosong, atau lokal belum ada
                const BOOLEAN_KEYS = ['enablePreOrder', 'enableShift', 'enableDineTable', 'enableTableOrder', 'enableKitchenQueue', 'allowNegativeStock', 'showImages', 'loyalty_active'];
                const NUMERIC_KEYS = ['taxRate', 'serviceCharge', 'loyalty_multiplier', 'loyalty_multiplier_amount', 'loyalty_point_value', 'loyalty_min_points'];
                
                if (data.settings && data.settings.length > 0) {
                    for (const s of data.settings) {
                        // Skip local-only keys — jangan timpa dengan data server
                        if (LOCAL_ONLY_KEYS.includes(s.key)) continue;
                        
                        // Boolean & numeric keys: selalu update dari server
                        if (BOOLEAN_KEYS.includes(s.key) || NUMERIC_KEYS.includes(s.key)) {
                            await tx.executeSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
                            continue;
                        }
                        
                        // String keys: hanya update jika server punya value non-kosong
                        if (s.value && s.value.toString().trim() !== '') {
                            await tx.executeSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
                        } else {
                            // Server kosong — insert only if local doesn't exist yet
                            await tx.executeSql('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value || '']);
                        }
                    }
                }

                // Categories
                if (data.categories) {
                    for (const c of data.categories) {
                        // Cek apakah kategori ini sudah ada di lokal (berdasarkan serverId atau id)
                        const [checkRes] = await tx.executeSql('SELECT id FROM categories WHERE serverId = ? OR id = ?', [c.id, c.androidId]);
                        if (checkRes.rows.length > 0) {
                            const localId = checkRes.rows.item(0).id;
                            await tx.executeSql('UPDATE categories SET name = ?, serverId = ?, isSynced = 1 WHERE id = ?', [c.name, c.id, localId]);
                        } else {
                            await tx.executeSql('INSERT INTO categories (name, serverId, isSynced) VALUES (?, ?, 1)', [c.name, c.id]);
                        }
                    }
                }

                // Products
                if (data.products) {
                    for (const p of data.products) {
                        const [catCheck] = await tx.executeSql('SELECT id FROM categories WHERE serverId = ? OR id = ?', [p.categoryId, p.categoryId]);
                        const localCategoryId = catCheck.rows.length > 0 ? catCheck.rows.item(0).id : p.categoryId;

                        const [prodCheck] = await tx.executeSql(
                            'SELECT id, serverId, isSynced FROM products WHERE serverId = ? OR id = ?',
                            [p.id, p.androidId]
                        );
                        if (prodCheck.rows.length > 0) {
                            const localProduct = prodCheck.rows.item(0);
                            const localId = localProduct.id;

                            if (Number(localProduct.isSynced) === 0) {
                                // Jangan timpa perubahan/gambar lokal yang belum sempat didorong.
                                // serverId tetap boleh dipetakan agar upload file punya tujuan pasti.
                                await tx.executeSql(
                                    'UPDATE products SET serverId = COALESCE(serverId, ?) WHERE id = ?',
                                    [p.id, localId]
                                );
                            } else {
                                await tx.executeSql(
                                    'UPDATE products SET categoryId = ?, name = ?, price = ?, costPrice = ?, enableCostPrice = ?, stock = ?, imageUrl = ?, isUnlimitedStock = ?, barcode = ?, minStock = ?, discountActive = ?, discountType = ?, discountValue = ?, discountStartAt = ?, discountEndAt = ?, discountStartTime = ?, discountEndTime = ?, discountDays = ?, discountLabel = ?, serverId = ?, isSynced = 1 WHERE id = ?',
                                    [localCategoryId, p.name, p.price, p.costPrice || 0, p.enableCostPrice ? 1 : 0, p.stock || 0, p.imageUrl, p.isUnlimitedStock ? 1 : 0, p.barcode, p.minStock || 0, p.discountActive ? 1 : 0, p.discountType || null, p.discountValue || 0, p.discountStartAt || null, p.discountEndAt || null, p.discountStartTime || null, p.discountEndTime || null, p.discountDays || null, p.discountLabel || null, p.id, localId]
                                );
                            }
                        } else {
                            await tx.executeSql(
                                'INSERT INTO products (categoryId, name, price, costPrice, enableCostPrice, stock, imageUrl, isUnlimitedStock, barcode, minStock, discountActive, discountType, discountValue, discountStartAt, discountEndAt, discountStartTime, discountEndTime, discountDays, discountLabel, serverId, isSynced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
                                [localCategoryId, p.name, p.price, p.costPrice || 0, p.enableCostPrice ? 1 : 0, p.stock || 0, p.imageUrl, p.isUnlimitedStock ? 1 : 0, p.barcode, p.minStock || 0, p.discountActive ? 1 : 0, p.discountType || null, p.discountValue || 0, p.discountStartAt || null, p.discountEndAt || null, p.discountStartTime || null, p.discountEndTime || null, p.discountDays || null, p.discountLabel || null, p.id]
                            );
                        }
                    }
                }

                // Users (Tetap sama, asumsikan ID user di manage di server)
                if (data.users) {
                    const [resAll] = await tx.executeSql('SELECT id, email, pin FROM users');
                    const pinMap: any = {};
                    for (let i = 0; i < resAll.rows.length; i++) {
                        const row = resAll.rows.item(i);
                        if (row.email) pinMap[row.email] = row.pin;
                        pinMap[row.id] = row.pin;
                    }
                    await tx.executeSql('DELETE FROM users');
                    for (const u of data.users) {
                        const existPin = pinMap[u.email] || pinMap[u.id] || (u.role === 'CASHIER' ? '111111' : '123456');
                        await tx.executeSql('INSERT OR REPLACE INTO users (id, name, email, pin, role) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, u.email, existPin, u.role]);
                    }
                    
                    // Always ensure default offline users exist
                    const emails = data.users.map((u: any) => u.email);
                    if (!emails.includes('boss@litepos.com')) await tx.executeSql(`INSERT INTO users (name, email, pin, role) VALUES ('Owner', 'boss@litepos.com', '123456', 'OWNER')`);
                    if (!emails.includes('admin@litepos.com')) await tx.executeSql(`INSERT INTO users (name, email, pin, role) VALUES ('Admin Toko', 'admin@litepos.com', '123456', 'ADMIN')`);
                    if (!emails.includes('kasir@litepos.com')) await tx.executeSql(`INSERT INTO users (name, email, pin, role) VALUES ('Kasir 1', 'kasir@litepos.com', '111111', 'CASHIER')`);
                }

                // Customers
                if (data.customers) {
                    for (const c of data.customers) {
                        const [checkRes] = await tx.executeSql('SELECT id FROM customers WHERE serverId = ? OR id = ?', [c.id, c.androidId]);
                        if (checkRes.rows.length > 0) {
                            const localId = checkRes.rows.item(0).id;
                            await tx.executeSql('UPDATE customers SET name = ?, phone = ?, notes = ?, loyaltyDiscount = ?, points = ?, serverId = ?, isSynced = 1 WHERE id = ?', [c.name, c.phone, c.notes, c.loyaltyDiscount || 0, c.points || 0, c.id, localId]);
                        } else {
                            await tx.executeSql('INSERT INTO customers (name, phone, notes, loyaltyDiscount, points, serverId, isSynced) VALUES (?, ?, ?, ?, ?, ?, 1)', [c.name, c.phone, c.notes, c.loyaltyDiscount || 0, c.points || 0, c.id]);
                        }
                    }
                }

                // Suppliers — upsert by serverId
                if (data.suppliers) {
                    for (const s of data.suppliers) {
                        const [checkRes] = await tx.executeSql('SELECT id FROM suppliers WHERE serverId = ? OR id = ?', [s.id, s.id]);
                        if (checkRes.rows.length > 0) {
                            const localId = checkRes.rows.item(0).id;
                            await tx.executeSql('UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ?, serverId = ?, isSynced = 1 WHERE id = ?', [s.name, s.phone || s.contact, s.address, s.notes || '', s.id, localId]);
                        } else {
                            await tx.executeSql('INSERT INTO suppliers (name, phone, address, notes, serverId, isSynced) VALUES (?, ?, ?, ?, ?, 1)', [s.name, s.phone || s.contact, s.address, s.notes || '', s.id]);
                        }
                    }
                }

                // Packages — upsert by serverId
                if (data.packages) {
                    for (const pk of data.packages) {
                        const [checkRes] = await tx.executeSql('SELECT id, isSynced FROM packages WHERE serverId = ? OR id = ?', [pk.id, pk.androidId]);
                        if (checkRes.rows.length > 0) {
                            const localPackage = checkRes.rows.item(0);
                            if (Number(localPackage.isSynced) === 0) {
                                if (Number(pk.androidId) === Number(localPackage.id)) {
                                    await tx.executeSql('UPDATE packages SET serverId = COALESCE(serverId, ?) WHERE id = ?', [pk.id, localPackage.id]);
                                }
                            } else {
                                await tx.executeSql('UPDATE packages SET name = ?, description = ?, price = ?, isActive = ?, serverId = ?, isSynced = 1 WHERE id = ?', [pk.name, pk.description, pk.price, pk.isActive ? 1 : 0, pk.id, localPackage.id]);
                            }
                        } else {
                            await tx.executeSql('INSERT INTO packages (name, description, price, isActive, createdAt, serverId, isSynced) VALUES (?, ?, ?, ?, ?, ?, 1)', [pk.name, pk.description, pk.price, pk.isActive ? 1 : 0, new Date().toISOString(), pk.id]);
                        }
                    }
                }

                // Package Items — rebuild per synced package (safe because items reference packageId)
                if (data.package_items) {
                    for (const pki of data.package_items) {
                        // Resolve packageId and productId to local IDs
                        const [pkCheck] = await tx.executeSql('SELECT id, isSynced FROM packages WHERE serverId = ?', [pki.packageId]);
                        if (pkCheck.rows.length > 0 && Number(pkCheck.rows.item(0).isSynced) === 0) continue;
                        const localPackageId = pkCheck.rows.length > 0 ? pkCheck.rows.item(0).id : pki.packageId;
                        const [prodCheck] = await tx.executeSql('SELECT id FROM products WHERE serverId = ? OR id = ?', [pki.productId, pki.productId]);
                        const localProductId = prodCheck.rows.length > 0 ? prodCheck.rows.item(0).id : pki.productId;

                        const [existCheck] = await tx.executeSql('SELECT id FROM package_items WHERE packageId = ? AND productId = ?', [localPackageId, localProductId]);
                        if (existCheck.rows.length > 0) {
                            await tx.executeSql('UPDATE package_items SET quantity = ? WHERE packageId = ? AND productId = ?', [pki.quantity || pki.qty || 1, localPackageId, localProductId]);
                        } else {
                            await tx.executeSql('INSERT INTO package_items (packageId, productId, quantity) VALUES (?, ?, ?)', [localPackageId, localProductId, pki.quantity || pki.qty || 1]);
                        }
                    }
                }

                // Dine-in Tables — upsert by serverId
                if (data.tables) {
                    for (const tb of data.tables) {
                        const [checkRes] = await tx.executeSql('SELECT id FROM dine_tables WHERE serverId = ? OR id = ?', [tb.id, tb.id]);
                        if (checkRes.rows.length > 0) {
                            const localId = checkRes.rows.item(0).id;
                            await tx.executeSql('UPDATE dine_tables SET number = ?, name = ?, capacity = ?, status = ?, serverId = ?, isSynced = 1 WHERE id = ?', [tb.number, tb.name, tb.capacity || 4, tb.status || 'AVAILABLE', tb.id, localId]);
                        } else {
                            await tx.executeSql('INSERT INTO dine_tables (number, name, capacity, status, serverId, isSynced) VALUES (?, ?, ?, ?, ?, 1)', [tb.number, tb.name, tb.capacity || 4, tb.status || 'AVAILABLE', tb.id]);
                        }
                    }
                }

                // Product Addons — upsert by serverId
                if (data.addons) {
                    for (const ad of data.addons) {
                        // Resolve productId to local
                        const [prodCheck] = await tx.executeSql('SELECT id FROM products WHERE serverId = ? OR id = ?', [ad.productId, ad.productId]);
                        const localProductId = prodCheck.rows.length > 0 ? prodCheck.rows.item(0).id : ad.productId;

                        const [checkRes] = await tx.executeSql('SELECT id FROM product_addons WHERE serverId = ? OR (productId = ? AND name = ?)', [ad.id, localProductId, ad.name]);
                        if (checkRes.rows.length > 0) {
                            const localId = checkRes.rows.item(0).id;
                            await tx.executeSql('UPDATE product_addons SET productId = ?, name = ?, price = ?, serverId = ?, isSynced = 1 WHERE id = ?', [localProductId, ad.name, ad.price, ad.id, localId]);
                        } else {
                            await tx.executeSql('INSERT INTO product_addons (productId, name, price, serverId, isSynced) VALUES (?, ?, ?, ?, 1)', [localProductId, ad.name, ad.price, ad.id]);
                        }
                    }
                }

                // ── CLEANUP: Hapus item lokal yang sudah dihapus di server ──
                // Hanya hapus item yang punya serverId (artinya pernah sync dari server)
                // tapi serverId-nya sudah tidak ada di data server terbaru

                // Cleanup Categories
                if (data.categories) {
                    const serverCatIds = data.categories.map((c: any) => c.id);
                    if (serverCatIds.length > 0) {
                        const placeholders = serverCatIds.map(() => '?').join(',');
                        await tx.executeSql(
                            `DELETE FROM categories WHERE serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
                            serverCatIds
                        );
                    }
                }

                // Cleanup Products (and their addons)
                if (data.products) {
                    const serverProdIds = data.products.map((p: any) => p.id);
                    if (serverProdIds.length > 0) {
                        const placeholders = serverProdIds.map(() => '?').join(',');
                        // First delete addons of products that will be deleted
                        await tx.executeSql(
                            `DELETE FROM product_addons WHERE productId IN (SELECT id FROM products WHERE serverId IS NOT NULL AND serverId NOT IN (${placeholders}))`,
                            serverProdIds
                        );
                        // Then delete the products
                        await tx.executeSql(
                            `DELETE FROM products WHERE serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
                            serverProdIds
                        );
                    }
                }

                // Cleanup Product Addons
                if (data.addons) {
                    const serverAddonIds = data.addons.map((a: any) => a.id);
                    if (serverAddonIds.length > 0) {
                        const placeholders = serverAddonIds.map(() => '?').join(',');
                        await tx.executeSql(
                            `DELETE FROM product_addons WHERE serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
                            serverAddonIds
                        );
                    }
                }

                // Cleanup Suppliers
                if (data.suppliers) {
                    const serverSuppIds = data.suppliers.map((s: any) => s.id);
                    if (serverSuppIds.length > 0) {
                        const placeholders = serverSuppIds.map(() => '?').join(',');
                        await tx.executeSql(
                            `DELETE FROM suppliers WHERE serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
                            serverSuppIds
                        );
                    }
                }

                // Cleanup Packages (and their items)
                if (data.packages) {
                    const serverPkgIds = data.packages.map((p: any) => p.id);
                    if (serverPkgIds.length > 0) {
                        const placeholders = serverPkgIds.map(() => '?').join(',');
                        await tx.executeSql(
                            `DELETE FROM package_items WHERE packageId IN (SELECT id FROM packages WHERE serverId IS NOT NULL AND serverId NOT IN (${placeholders}))`,
                            serverPkgIds
                        );
                        await tx.executeSql(
                            `DELETE FROM packages WHERE serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
                            serverPkgIds
                        );
                    }
                }

                // Cleanup Dine Tables
                if (data.tables) {
                    const serverTableIds = data.tables.map((t: any) => t.id);
                    if (serverTableIds.length > 0) {
                        const placeholders = serverTableIds.map(() => '?').join(',');
                        await tx.executeSql(
                            `DELETE FROM dine_tables WHERE serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
                            serverTableIds
                        );
                    }
                }
            // End of sequential db execution

            return { success: true, message: 'Master data synced to SQLite successfully' };

        } catch (error: any) {
            console.error('Sync Master Error:', error);
            const status = error?.response?.status;
            let errMsg = error?.response?.data?.message || error?.response?.data?.error || 'Unknown error';
            if (errMsg === 'Unknown error' && error && error.message) errMsg = error.message;
            else if (typeof error === 'string') errMsg = error;
            return { success: false, error: errMsg, status };
        }
    },

    // 2. Kirim transaksi offline ke server
    pushLocalData: async () => {
        try {
            const db = await getDBConnection();
            
            // Ambil transactions (dan items-nya)
            let transactions: any[] = [];
            try {
                const [trxRes] = await db.executeSql(`
                    SELECT t.*, c.serverId as custServerId 
                    FROM transactions t 
                    LEFT JOIN customers c ON t.customerId = c.id
                    WHERE t.isSynced = 0
                `);
                for (let i = 0; i < trxRes.rows.length; i++) {
                    const tx = trxRes.rows.item(i);
                    const txToSend = { ...tx };
                    if (tx.custServerId) txToSend.customerId = tx.custServerId;
                    delete txToSend.custServerId;

                    const [itemsRes] = await db.executeSql(`
                        SELECT ti.*, p.serverId as prodServerId
                        FROM transaction_items ti
                        LEFT JOIN products p ON ti.productId = p.id
                        WHERE ti.transactionId = ?
                    `, [tx.id]);
                    const items: any[] = [];
                    for (let j = 0; j < itemsRes.rows.length; j++) {
                        const item = itemsRes.rows.item(j);
                        const itemToSend = { ...item };
                        if (item.prodServerId) {
                            itemToSend.serverProductId = item.prodServerId;
                        }
                        delete itemToSend.prodServerId;
                        items.push(itemToSend);
                    }
                    transactions.push({ ...txToSend, items });
                }
            } catch(e) { console.warn('Push: gagal ambil transactions:', e); }

            // Ambil expenses
            let expenses: any[] = [];
            try {
                const [expRes] = await db.executeSql('SELECT * FROM expenses WHERE isSynced = 0');
                for (let i = 0; i < expRes.rows.length; i++) {
                    expenses.push(expRes.rows.item(i));
                }
            } catch(e) { console.warn('Push: gagal ambil expenses:', e); }

            // Ambil shifts
            let shifts: any[] = [];
            try {
                const [shiftRes] = await db.executeSql('SELECT * FROM shifts WHERE isSynced = 0');
                for (let i = 0; i < shiftRes.rows.length; i++) {
                    shifts.push(shiftRes.rows.item(i));
                }
            } catch(e) { console.warn('Push: gagal ambil shifts:', e); }

            // Ambil categories
            let categories: any[] = [];
            try {
                const [catRes] = await db.executeSql('SELECT * FROM categories WHERE isSynced = 0');
                for (let i = 0; i < catRes.rows.length; i++) {
                    categories.push(catRes.rows.item(i));
                }
            } catch(e) { console.warn('Push: gagal ambil categories:', e); }

            // Ambil products
            let products: any[] = [];
            try {
                const [prodRes] = await db.executeSql(`
                    SELECT p.*, c.serverId as catServerId 
                    FROM products p
                    LEFT JOIN categories c ON p.categoryId = c.id
                    WHERE p.isSynced = 0
                `);
                for (let i = 0; i < prodRes.rows.length; i++) {
                    const prod = prodRes.rows.item(i);
                    const prodToSend = { ...prod };
                    if (prod.catServerId) prodToSend.categoryId = prod.catServerId;
                    delete prodToSend.catServerId;
                    products.push(prodToSend);
                }
            } catch(e) { console.warn('Push: gagal ambil products:', e); }

            // Ambil customers
            let customers: any[] = [];
            try {
                const [custRes] = await db.executeSql('SELECT * FROM customers WHERE isSynced = 0 OR points > 0');
                for (let i = 0; i < custRes.rows.length; i++) {
                    customers.push(custRes.rows.item(i));
                }
            } catch(e) { console.warn('Push: gagal ambil customers:', e); }

            // Ambil stock receipts (try-catch karena kolom isSynced mungkin belum ada di DB lama)
            let stockReceipts: any[] = [];
            try {
                const [receiptRes] = await db.executeSql('SELECT * FROM stock_receipts WHERE isSynced = 0');
                for (let i = 0; i < receiptRes.rows.length; i++) {
                    const receipt = receiptRes.rows.item(i);
                    // Ambil items untuk receipt ini
                    const [receiptItemsRes] = await db.executeSql(`
                        SELECT sri.*, p.serverId as prodServerId
                        FROM stock_receipt_items sri
                        LEFT JOIN products p ON sri.productId = p.id
                        WHERE sri.receiptId = ?
                    `, [receipt.id]);
                    const receiptItems: any[] = [];
                    for (let j = 0; j < receiptItemsRes.rows.length; j++) {
                        const item = receiptItemsRes.rows.item(j);
                        const itemToSend = { ...item };
                        if (item.prodServerId) itemToSend.serverProductId = item.prodServerId;
                        delete itemToSend.prodServerId;
                        receiptItems.push(itemToSend);
                    }
                    stockReceipts.push({ ...receipt, items: receiptItems });
                }
            } catch(e) {
                console.warn('stock_receipts isSynced query failed (column may not exist yet):', e);
                stockReceipts = [];
            }

            // Ambil suppliers
            let suppliers: any[] = [];
            try {
                const [suppRes] = await db.executeSql('SELECT * FROM suppliers WHERE isSynced = 0');
                for (let i = 0; i < suppRes.rows.length; i++) {
                    suppliers.push(suppRes.rows.item(i));
                }
            } catch(e) { console.warn('Push: gagal ambil suppliers:', e); }

            // Ambil packages + items
            let packages: any[] = [];
            try {
                const [pkgRes] = await db.executeSql('SELECT * FROM packages');
                for (let i = 0; i < pkgRes.rows.length; i++) {
                    const pkg = pkgRes.rows.item(i);
                    const [itemsRes] = await db.executeSql(`
                        SELECT pi.*, p.serverId as prodServerId
                        FROM package_items pi
                        LEFT JOIN products p ON pi.productId = p.id
                        WHERE pi.packageId = ?
                    `, [pkg.id]);
                    const items: any[] = [];
                    for (let j = 0; j < itemsRes.rows.length; j++) {
                        const item = itemsRes.rows.item(j);
                        const itemToSend = { ...item };
                        if (item.prodServerId) itemToSend.serverProductId = item.prodServerId;
                        delete itemToSend.prodServerId;
                        items.push(itemToSend);
                    }
                    packages.push({ ...pkg, items });
                }
            } catch(e) { console.warn('Push: gagal ambil packages:', e); }

            // Ambil dine tables
            let dineTables: any[] = [];
            try {
                const [tableRes] = await db.executeSql('SELECT * FROM dine_tables WHERE isSynced = 0');
                for (let i = 0; i < tableRes.rows.length; i++) {
                    dineTables.push(tableRes.rows.item(i));
                }
            } catch(e) { console.warn('Push: gagal ambil dine_tables:', e); }

            // Ambil product addons
            let addons: any[] = [];
            try {
                const [addonRes] = await db.executeSql(`
                    SELECT pa.*, p.serverId as prodServerId
                    FROM product_addons pa
                    LEFT JOIN products p ON pa.productId = p.id
                    WHERE pa.isSynced = 0
                `);
                for (let i = 0; i < addonRes.rows.length; i++) {
                    const addon = addonRes.rows.item(i);
                    const addonToSend = { ...addon };
                    if (addon.prodServerId) addonToSend.serverProductId = addon.prodServerId;
                    delete addonToSend.prodServerId;
                    addons.push(addonToSend);
                }
            } catch(e) { console.warn('Push: gagal ambil product_addons:', e); }

            // Ambil settings lokal untuk di-push ke server
            const [settingsRes] = await db.executeSql('SELECT * FROM settings');
            const settings: any[] = [];
            for (let i = 0; i < settingsRes.rows.length; i++) {
                const row = settingsRes.rows.item(i);
                if (!LOCAL_ONLY_KEYS.includes(row.key)) {
                    settings.push({ key: row.key, value: row.value });
                }
            }

            // Jika tidak ada data yang perlu disinkronkan, lewati
            const hasData = transactions.length > 0 || expenses.length > 0 || shifts.length > 0 || 
                categories.length > 0 || products.length > 0 || customers.length > 0 || 
                settings.length > 0 || stockReceipts.length > 0 ||
                suppliers.length > 0 || packages.length > 0 || dineTables.length > 0 || addons.length > 0;
            if (!hasData) {
                return { success: true, message: 'No local data to sync' };
            }

            // Kirim ke server
            const productsForPush = products.map((product) => {
                if (!isDeviceAssetUrl(product.imageUrl)) return product;

                const productWithoutLocalImage = { ...product };
                delete productWithoutLocalImage.imageUrl;
                return productWithoutLocalImage;
            });
            const payload = { transactions, expenses, shifts, categories, products: productsForPush, customers, settings, stockReceipts, suppliers, packages, dineTables, addons };
            const res = await api.post('/sync/push', payload, {
                headers: { 'X-LitePOS-Sync-Version': '2' },
            });
            
            if (res.data.success) {
                const idMap = res.data.idMap || {};

                // File galeri hanya ada di perangkat. Upload setelah serverId produk tersedia,
                // lalu simpan kembali path relatif backend agar tetap mengikuti apiBaseUrl aktif.
                const productServerIds = new Map<string, number>(
                    (idMap.products || []).map(
                        (item: any) => [String(item.androidId), Number(item.serverId)] as [string, number]
                    )
                );
                for (const product of products.filter((item) => isDeviceAssetUrl(item.imageUrl))) {
                    const serverProductId = Number(
                        product.serverId || productServerIds.get(String(product.id)) || 0
                    );
                    if (!serverProductId) {
                        throw new Error(`Server ID untuk gambar produk ${product.name} tidak ditemukan.`);
                    }

                    const remoteImageUrl = await uploadProductImage(serverProductId, product.imageUrl);
                    await db.executeSql(
                        'UPDATE products SET imageUrl = ? WHERE id = ?',
                        [remoteImageUrl, product.id]
                    );
                }
                
                // react-native-sqlite-storage tidak menunggu callback transaction yang async.
                // Jalankan pembaruan berurutan agar status sinkron selalu selesai sebelum return.
                if (idMap.categories) {
                    for (const item of idMap.categories) {
                        await db.executeSql('UPDATE categories SET serverId = ?, isSynced = 1 WHERE id = ?', [item.serverId, item.androidId]);
                    }
                }

                if (idMap.products) {
                    for (const item of idMap.products) {
                        await db.executeSql('UPDATE products SET serverId = ?, isSynced = 1 WHERE id = ?', [item.serverId, item.androidId]);
                    }
                }

                if (idMap.customers) {
                    for (const item of idMap.customers) {
                        await db.executeSql('UPDATE customers SET serverId = ?, isSynced = 1 WHERE id = ?', [item.serverId, item.androidId]);
                    }
                }

                if (transactions.length > 0) {
                    const txIds = transactions.map(t => `'${t.id}'`).join(',');
                    await db.executeSql(`UPDATE transactions SET isSynced = 1 WHERE id IN (${txIds})`);
                }
                if (expenses.length > 0) {
                    const expIds = expenses.map(e => e.id).join(',');
                    await db.executeSql(`UPDATE expenses SET isSynced = 1 WHERE id IN (${expIds})`);
                }
                if (shifts.length > 0) {
                    const shiftIds = shifts.map(s => `'${s.id}'`).join(',');
                    await db.executeSql(`UPDATE shifts SET isSynced = 1 WHERE id IN (${shiftIds})`);
                }
                if (stockReceipts.length > 0) {
                    const receiptIds = stockReceipts.map(r => `'${r.id}'`).join(',');
                    await db.executeSql(`UPDATE stock_receipts SET isSynced = 1 WHERE id IN (${receiptIds})`);
                }

                if (idMap.suppliers) {
                    for (const item of idMap.suppliers) {
                        await db.executeSql('UPDATE suppliers SET serverId = ?, isSynced = 1 WHERE id = ?', [item.serverId, item.androidId]);
                    }
                }

                if (idMap.packages) {
                    for (const item of idMap.packages) {
                        await db.executeSql('UPDATE packages SET serverId = ?, isSynced = 1 WHERE id = ?', [item.serverId, item.androidId]);
                    }
                }

                if (idMap.dineTables) {
                    for (const item of idMap.dineTables) {
                        await db.executeSql('UPDATE dine_tables SET serverId = ?, isSynced = 1 WHERE id = ?', [item.serverId, item.androidId]);
                    }
                }

                if (idMap.addons) {
                    for (const item of idMap.addons) {
                        await db.executeSql('UPDATE product_addons SET serverId = ?, isSynced = 1 WHERE id = ?', [item.serverId, item.androidId]);
                    }
                }

                return {
                    success: true,
                    message: 'Local data pushed to server and IDs mapped successfully',
                    warnings: Array.isArray(res.data.warnings) ? res.data.warnings : [],
                };
            }

            return { success: false, error: 'Server returned failure' };

        } catch (error: any) {
            console.error('Push Local Data Error:', error);
            return {
                success: false,
                status: error?.response?.status,
                error:
                    error?.response?.data?.message ||
                    error?.response?.data?.error ||
                    error?.message ||
                    'Push data lokal gagal.',
            };
        }
    },

    // 3. Ambil histori transaksi dari server (30 hari terakhir)
    // Agar laporan dan dashboard di Android menampilkan semua transaksi antar perangkat
    syncTransactionHistory: async () => {
        try {
            const res = await api.get('/sync/history');
            const data = res.data.data;

            const db = await getDBConnection();

            // ── Upsert Transactions ──────────────────────────────────────
            if (data.transactions && Array.isArray(data.transactions)) {
                for (const tx of data.transactions) {
                    try {
                        // Dedup berdasarkan invoiceNumber (unique)
                        const [checkRes] = await db.executeSql(
                            'SELECT id FROM transactions WHERE invoiceNumber = ?',
                            [tx.invoiceNumber]
                        );

                        if (checkRes.rows.length === 0) {
                            // Resolve customerId ke local
                            let localCustomerId = null;
                            if (tx.customerId) {
                                const [custCheck] = await db.executeSql(
                                    'SELECT id FROM customers WHERE serverId = ?',
                                    [tx.customerId]
                                );
                                if (custCheck.rows.length > 0) {
                                    localCustomerId = custCheck.rows.item(0).id;
                                }
                            }

                            // Insert transaction
                            await db.executeSql(
                                `INSERT INTO transactions (id, invoiceNumber, grandTotal, discountAmount, paymentMethod, cashAmount, changeAmount, customerId, customerName, createdAt, status, preOrderDate, paymentStatus, paidAmount, remainingAmount, paidAt, orderType, tableName, isSynced)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                                [
                                    tx.id,
                                    tx.invoiceNumber,
                                    tx.grandTotal,
                                    tx.discountAmount || 0,
                                    tx.paymentMethod || 'CASH',
                                    tx.cashAmount,
                                    tx.changeAmount,
                                    localCustomerId,
                                    tx.customerName,
                                    tx.createdAt,
                                    tx.status || 'COMPLETED',
                                    tx.preOrderDate,
                                    tx.paymentStatus || 'PAID',
                                    tx.paymentStatus === 'UNPAID' ? 0 : (tx.paidAmount || tx.grandTotal || 0),
                                    tx.remainingAmount || 0,
                                    tx.paymentStatus === 'UNPAID' ? null : (tx.paidAt || tx.createdAt),
                                    tx.orderType || 'TAKE_AWAY',
                                    tx.tableName,
                                ]
                            );

                            // Insert transaction items
                            if (tx.items && Array.isArray(tx.items)) {
                                for (const item of tx.items) {
                                    // Resolve productId: cari di local berdasarkan serverId
                                    let localProductId = item.productId;
                                    if (item.serverProductId) {
                                        const [prodCheck] = await db.executeSql(
                                            'SELECT id FROM products WHERE serverId = ?',
                                            [item.serverProductId]
                                        );
                                        if (prodCheck.rows.length > 0) {
                                            localProductId = prodCheck.rows.item(0).id;
                                        }
                                    }

                                    await db.executeSql(
                                        `INSERT INTO transaction_items (transactionId, productId, quantity, price, notes)
                                         VALUES (?, ?, ?, ?, ?)`,
                                        [
                                            tx.id,
                                            localProductId,
                                            item.quantity || 1,
                                            item.price,
                                            item.notes || null,
                                        ]
                                    );
                                }
                            }
                        } else {
                            // Transaksi sudah ada — update status jika berubah (misal RETURNED)
                            const existingId = checkRes.rows.item(0).id;
                            await db.executeSql(
                                'UPDATE transactions SET status = ?, isSynced = 1 WHERE id = ?',
                                [tx.status || 'COMPLETED', existingId]
                            );
                        }
                    } catch (txErr: any) {
                        console.warn(`[SYNC-HISTORY] Gagal upsert transaksi ${tx.invoiceNumber}:`, txErr?.message);
                    }
                }
            }

            // ── Upsert Expenses ──────────────────────────────────────────
            if (data.expenses && Array.isArray(data.expenses)) {
                for (const exp of data.expenses) {
                    try {
                        // Dedup berdasarkan amount + createdAt (same as pushLocalData server logic)
                        const [checkRes] = await db.executeSql(
                            'SELECT id FROM expenses WHERE amount = ? AND createdAt = ?',
                            [exp.amount, exp.createdAt]
                        );
                        if (checkRes.rows.length === 0) {
                            await db.executeSql(
                                `INSERT INTO expenses (description, amount, category, type, createdAt, isSynced)
                                 VALUES (?, ?, ?, 'EXPENSE', ?, 1)`,
                                [exp.description, exp.amount, exp.category || 'Umum', exp.createdAt]
                            );
                        }
                    } catch (expErr: any) {
                        console.warn('[SYNC-HISTORY] Gagal upsert expense:', expErr?.message);
                    }
                }
            }

            // ── Upsert Shifts ────────────────────────────────────────────
            if (data.shifts && Array.isArray(data.shifts)) {
                for (const shift of data.shifts) {
                    try {
                        const [checkRes] = await db.executeSql(
                            'SELECT id FROM shifts WHERE id = ?',
                            [shift.id]
                        );
                        if (checkRes.rows.length === 0) {
                            await db.executeSql(
                                `INSERT INTO shifts (id, userId, userName, openedAt, closedAt, openingCash, closingCash, status, isSynced)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                                [
                                    shift.id,
                                    shift.userId,
                                    shift.userName,
                                    shift.openedAt,
                                    shift.closedAt,
                                    shift.openingCash,
                                    shift.closingCash,
                                    shift.status || 'OPEN',
                                ]
                            );
                        } else {
                            // Update status jika shift ditutup
                            if (shift.status === 'CLOSED') {
                                await db.executeSql(
                                    'UPDATE shifts SET status = ?, closedAt = ?, closingCash = ?, isSynced = 1 WHERE id = ? AND status = ?',
                                    [shift.status, shift.closedAt, shift.closingCash, shift.id, 'OPEN']
                                );
                            }
                        }
                    } catch (shiftErr: any) {
                        console.warn('[SYNC-HISTORY] Gagal upsert shift:', shiftErr?.message);
                    }
                }
            }

            return { success: true, message: 'Transaction history synced successfully' };
        } catch (error: any) {
            console.error('Sync History Error:', error);
            let errMsg = 'Unknown error';
            if (error && error.message) errMsg = error.message;
            else if (typeof error === 'string') errMsg = error;
            else errMsg = JSON.stringify(error);
            return { success: false, error: errMsg };
        }
    }
};
