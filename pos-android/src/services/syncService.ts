import api, { isDeviceAssetUrl } from './api';
import { getDBConnection } from '../database/db';

// Keys yang hanya ada di device lokal, tidak boleh ditimpa oleh server
const LOCAL_ONLY_KEYS = [
    'printerAddress', 'printerType', 'apiBaseUrl', 'enableKitchenPrint', 'theme', 'settings_sync_pending', 'sync_initialized',
    'store_id', 'license_number', 'license_status', 'license_expire_date', 'license_type', 'license_offline',
    'dataResetVersion', 'dataResetAt', 'dataResetType',
];

const OPERATIONAL_LOCAL_TABLES = [
    'transaction_items',
    'transactions',
    'expenses',
    'stock_receipt_items',
    'stock_receipts',
    'shifts',
    'saved_transactions',
    'package_items',
    'packages',
    'product_addons',
    'products',
    'categories',
    'customers',
    'suppliers',
    'dine_tables',
];

export type DataResetScope = 'STOCK' | 'TRANSACTIONS' | 'ALL';
export type TransactionResetRange = { startAt: string; endAt: string };
export type DataResetDetails = {
    transactionRanges?: TransactionResetRange[];
    transactionResetAll?: boolean;
};

const normalizeResetScopes = (scopes?: DataResetScope | DataResetScope[] | null): DataResetScope[] => {
    const values = Array.isArray(scopes) ? scopes : scopes ? [scopes] : ['ALL'];
    if (values.includes('ALL')) return ['ALL'];
    const normalized = Array.from(new Set(values.filter(
        (scope): scope is DataResetScope => scope === 'STOCK' || scope === 'TRANSACTIONS'
    )));
    return normalized.length > 0 ? normalized : ['ALL'];
};

export const clearOperationalLocalData = async (
    version: number,
    resetAt?: string | null,
    scopes?: DataResetScope | DataResetScope[] | null,
    details: DataResetDetails = {}
) => {
    const db = await getDBConnection();
    const normalizedScopes = normalizeResetScopes(scopes);

    if (normalizedScopes.includes('ALL')) {
        for (const table of OPERATIONAL_LOCAL_TABLES) {
            await db.executeSql(`DELETE FROM ${table}`);
        }
    } else {
        if (normalizedScopes.includes('TRANSACTIONS')) {
            const ranges = Array.isArray(details.transactionRanges)
                ? details.transactionRanges.filter((range) => range?.startAt && range?.endAt)
                : [];
            const resetAllTransactions = details.transactionResetAll !== false || ranges.length === 0;

            if (resetAllTransactions) {
                for (const table of ['transaction_items', 'transactions', 'saved_transactions']) {
                    await db.executeSql(`DELETE FROM ${table}`);
                }
                await db.executeSql(`UPDATE dine_tables SET status = 'AVAILABLE'`);
            } else {
                for (const range of ranges) {
                    const dateWhere = 'datetime(createdAt) >= datetime(?) AND datetime(createdAt) <= datetime(?)';
                    const dateParams = [range.startAt, range.endAt];
                    const [tableResult] = await db.executeSql(
                        `SELECT DISTINCT tableName FROM transactions WHERE ${dateWhere} AND tableName IS NOT NULL AND tableName != ''`,
                        dateParams
                    );
                    const tableNames: string[] = [];
                    for (let index = 0; index < tableResult.rows.length; index++) {
                        tableNames.push(String(tableResult.rows.item(index).tableName));
                    }

                    await db.executeSql(
                        `DELETE FROM transaction_items WHERE transactionId IN (SELECT id FROM transactions WHERE ${dateWhere})`,
                        dateParams
                    );
                    await db.executeSql(
                        `DELETE FROM transactions WHERE ${dateWhere}`,
                        dateParams
                    );

                    if (tableNames.length > 0) {
                        const placeholders = tableNames.map(() => '?').join(',');
                        await db.executeSql(
                            `UPDATE dine_tables SET status = 'AVAILABLE' WHERE number IN (${placeholders})`,
                            tableNames
                        );
                    }
                }
            }
        }

        if (normalizedScopes.includes('STOCK')) {
            await db.executeSql('DELETE FROM stock_receipt_items');
            await db.executeSql('DELETE FROM stock_receipts');
            await db.executeSql('UPDATE products SET stock = 0');
        }
    }
    await db.executeSql(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('dataResetVersion', ?)`,
        [String(version)]
    );
    await db.executeSql(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('dataResetAt', ?)`,
        [resetAt || new Date().toISOString()]
    );
    await db.executeSql(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('dataResetType', ?)`,
        [normalizedScopes.join(',')]
    );
    if (normalizedScopes.includes('ALL')) {
        await db.executeSql(
            `INSERT OR REPLACE INTO settings (key, value) VALUES ('settings_sync_pending', 'false')`
        );
    }
};

const markRowsSynced = async (db: any, table: string, ids: Array<string | number>) => {
    if (ids.length === 0) return;
    const allowedTables = new Set(['transactions', 'expenses', 'shifts', 'stock_receipts']);
    if (!allowedTables.has(table)) throw new Error(`Tabel sinkronisasi tidak dikenal: ${table}`);
    const placeholders = ids.map(() => '?').join(',');
    await db.executeSql(
        `UPDATE ${table} SET isSynced = 1 WHERE id IN (${placeholders})`,
        ids
    );
};

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

const uploadCustomerImage = async (serverCustomerId: number, imageUri: string) => {
    const formData = new FormData();
    const metadata = getImageUploadMetadata(imageUri);
    formData.append('image', {
        uri: imageUri,
        name: metadata.name.replace('product-', 'customer-'),
        type: metadata.type,
    } as any);

    const response = await api.put(`/customers/${serverCustomerId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
    });
    const remoteImageUrl = response.data?.data?.imageUrl;
    if (!remoteImageUrl) throw new Error('Backend tidak mengembalikan URL foto pelanggan.');
    return remoteImageUrl as string;
};

export const syncService = {
    reconcileResetState: async () => {
        try {
            const db = await getDBConnection();
            const [result] = await db.executeSql(
                `SELECT value FROM settings WHERE key = 'dataResetVersion'`
            );
            const parsedLocalVersion = result.rows.length > 0
                ? Number(result.rows.item(0).value || 0)
                : 0;
            const localVersion = Number.isInteger(parsedLocalVersion) && parsedLocalVersion >= 0
                ? parsedLocalVersion
                : 0;
            const response = await api.get('/license/reset-state', {
                timeout: 15000,
                params: { sinceVersion: localVersion },
            });
            const serverState = response.data?.data || {};
            const serverVersion = Number(serverState.version || 0);
            if (serverState.inProgress) {
                throw new Error('Reset data outlet sedang berlangsung. Sinkronisasi ditunda.');
            }
            if (!Number.isInteger(serverVersion) || serverVersion < 0) {
                throw new Error('Versi reset server tidak valid.');
            }

            if (serverVersion > localVersion) {
                const allResetVersion = Number(serverState.allResetVersion || 0);
                const stockResetVersion = Number(serverState.stockResetVersion || 0);
                const transactionResetVersion = Number(serverState.transactionResetVersion || 0);
                let scopes: DataResetScope[] = [];
                const details: DataResetDetails = {};
                const resetEvents = Array.isArray(serverState.events)
                    ? serverState.events.filter((event: any) => Number(event?.version) > localVersion)
                    : [];

                if (allResetVersion > localVersion) {
                    scopes = ['ALL'];
                } else {
                    if (stockResetVersion > localVersion) scopes.push('STOCK');
                    if (transactionResetVersion > localVersion) {
                        scopes.push('TRANSACTIONS');
                        const transactionEvents = resetEvents.filter(
                            (event: any) => String(event?.scope).toUpperCase() === 'TRANSACTIONS'
                        );
                        const hasFullTransactionReset = transactionEvents.some(
                            (event: any) => !event?.transactionRange?.startAt || !event?.transactionRange?.endAt
                        );
                        if (hasFullTransactionReset || transactionEvents.length === 0) {
                            details.transactionResetAll = true;
                        } else {
                            details.transactionResetAll = false;
                            details.transactionRanges = transactionEvents.map((event: any) => ({
                                startAt: String(event.transactionRange.startAt),
                                endAt: String(event.transactionRange.endAt),
                            }));
                        }
                    }
                }

                // Kompatibilitas dengan server yang belum memiliki versi per cakupan.
                if (scopes.length === 0) {
                    const fallbackScope = String(serverState.scope || '').toUpperCase();
                    scopes = fallbackScope === 'STOCK' || fallbackScope === 'TRANSACTIONS'
                        ? [fallbackScope as DataResetScope]
                        : ['ALL'];
                }

                await clearOperationalLocalData(serverVersion, serverState.resetAt, scopes, details);
                return {
                    success: true,
                    resetApplied: true,
                    version: serverVersion,
                    resetAt: serverState.resetAt || null,
                    scopes,
                    transactionRanges: details.transactionRanges || [],
                };
            }

            return {
                success: true,
                resetApplied: false,
                version: serverVersion,
                resetAt: serverState.resetAt || null,
                scopes: [],
            };
        } catch (error: any) {
            return {
                success: false,
                resetApplied: false,
                status: error?.response?.status,
                error: error?.response?.data?.message || error?.message || 'Status reset outlet gagal diperiksa.',
            };
        }
    },

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
                const BOOLEAN_KEYS = ['enablePreOrder', 'enableShift', 'enableShiftReminder', 'enableDineTable', 'enableTableOrder', 'enableKitchenQueue', 'allowNegativeStock', 'showImages', 'loyalty_active'];
                const NUMERIC_KEYS = ['taxRate', 'serviceCharge', 'shiftDurationMinutes', 'shiftReminderMinutes', 'loyalty_multiplier', 'loyalty_multiplier_amount', 'loyalty_point_value', 'loyalty_min_points'];
                
                if (data.settings && data.settings.length > 0) {
                    const [pendingSettingsResult] = await tx.executeSql(
                        `SELECT value FROM settings WHERE key = 'settings_sync_pending'`
                    );
                    const hasPendingLocalSettings = pendingSettingsResult.rows.length > 0 &&
                        pendingSettingsResult.rows.item(0).value === 'true';
                    for (const s of data.settings) {
                        // Skip local-only keys — jangan timpa dengan data server
                        if (LOCAL_ONLY_KEYS.includes(s.key)) continue;
                        if (hasPendingLocalSettings) continue;
                        
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
                        const [checkRes] = await tx.executeSql('SELECT id, isSynced FROM categories WHERE serverId = ? OR id = ?', [c.id, c.androidId]);
                        if (checkRes.rows.length > 0) {
                            const localCategory = checkRes.rows.item(0);
                            if (Number(localCategory.isSynced) === 0) {
                                await tx.executeSql('UPDATE categories SET serverId = COALESCE(serverId, ?) WHERE id = ?', [c.id, localCategory.id]);
                            } else {
                                await tx.executeSql('UPDATE categories SET name = ?, serverId = ?, isSynced = 1 WHERE id = ?', [c.name, c.id, localCategory.id]);
                            }
                        } else {
                            await tx.executeSql('INSERT INTO categories (name, serverId, isSynced) VALUES (?, ?, 1)', [c.name, c.id]);
                        }
                    }
                }

                // Products
                if (data.products) {
                    // === CLEANUP: Hapus duplikat produk yang sudah terlanjur ada ===
                    // 1. Duplikat serverId: simpan yang paling lama (id terkecil), hapus sisanya
                    const [dupServerIdRes] = await tx.executeSql(`
                        SELECT serverId, MIN(id) as keepId FROM products
                        WHERE serverId IS NOT NULL
                        GROUP BY serverId HAVING COUNT(*) > 1
                    `);
                    for (let i = 0; i < dupServerIdRes.rows.length; i++) {
                        const row = dupServerIdRes.rows.item(i);
                        await tx.executeSql(
                            'DELETE FROM products WHERE serverId = ? AND id != ?',
                            [row.serverId, row.keepId]
                        );
                        console.log(`[SYNC CLEANUP] Hapus duplikat serverId=${row.serverId}, keep id=${row.keepId}`);
                    }

                    // 2. Duplikat nama: jika ada produk tanpa serverId yang namanya sama
                    //    dengan produk yang sudah punya serverId, hapus yang tanpa serverId
                    const [dupNameRes] = await tx.executeSql(`
                        SELECT orphan.id as orphanId, orphan.name
                        FROM products orphan
                        INNER JOIN products synced
                            ON LOWER(orphan.name) = LOWER(synced.name)
                            AND synced.serverId IS NOT NULL
                            AND orphan.serverId IS NULL
                            AND orphan.id != synced.id
                    `);
                    for (let i = 0; i < dupNameRes.rows.length; i++) {
                        const row = dupNameRes.rows.item(i);
                        await tx.executeSql('DELETE FROM products WHERE id = ?', [row.orphanId]);
                        console.log(`[SYNC CLEANUP] Hapus orphan "${row.name}" id=${row.orphanId}`);
                    }

                    for (const p of data.products) {
                        const [catCheck] = await tx.executeSql('SELECT id FROM categories WHERE serverId = ? OR id = ?', [p.categoryId, p.categoryId]);
                        const localCategoryId = catCheck.rows.length > 0 ? catCheck.rows.item(0).id : p.categoryId;

                        // Multi-step matching: serverId first, then androidId, then
                        // deduplicate by name+category+price for products created on
                        // different platforms (Web vs Android) that lack cross-IDs.
                        let prodCheck;
                        [prodCheck] = await tx.executeSql(
                            'SELECT id, serverId, isSynced FROM products WHERE serverId = ?',
                            [p.id]
                        );
                        if (prodCheck.rows.length === 0 && p.androidId != null) {
                            [prodCheck] = await tx.executeSql(
                                'SELECT id, serverId, isSynced FROM products WHERE id = ?',
                                [p.androidId]
                            );
                        }
                        // Fallback: match unsynced local product by name + category +
                        // price to prevent duplicate inserts when a product was created
                        // on Web (androidId=NULL) while a matching one exists locally.
                        if (prodCheck.rows.length === 0) {
                            [prodCheck] = await tx.executeSql(
                                'SELECT id, serverId, isSynced FROM products WHERE serverId IS NULL AND name = ? AND categoryId = ? AND price = ?',
                                [p.name, localCategoryId, p.price]
                            );
                        }

                        const isActive = p.isActive === false || p.isActive === 0 ? 0 : 1;

                        if (prodCheck.rows.length > 0) {
                            const localProduct = prodCheck.rows.item(0);
                            const localId = localProduct.id;

                            if (Number(localProduct.isSynced) === 0) {
                                // Jangan timpa perubahan/gambar lokal yang belum sempat didorong.
                                // serverId tetap boleh dipetakan agar upload file punya tujuan pasti.
                                await tx.executeSql(
                                    'UPDATE products SET serverId = COALESCE(serverId, ?), isActive = ? WHERE id = ?',
                                    [p.id, isActive, localId]
                                );
                            } else {
                                await tx.executeSql(
                                    'UPDATE products SET categoryId = ?, name = ?, price = ?, costPrice = ?, enableCostPrice = ?, stock = ?, imageUrl = ?, isUnlimitedStock = ?, barcode = ?, minStock = ?, discountActive = ?, discountType = ?, discountValue = ?, discountStartAt = ?, discountEndAt = ?, discountStartTime = ?, discountEndTime = ?, discountDays = ?, discountLabel = ?, isActive = ?, serverId = ?, isSynced = 1 WHERE id = ?',
                                    [localCategoryId, p.name, p.price, p.costPrice || 0, p.enableCostPrice ? 1 : 0, p.stock || 0, p.imageUrl, p.isUnlimitedStock ? 1 : 0, p.barcode, p.minStock || 0, p.discountActive ? 1 : 0, p.discountType || null, p.discountValue || 0, p.discountStartAt || null, p.discountEndAt || null, p.discountStartTime || null, p.discountEndTime || null, p.discountDays || null, p.discountLabel || null, isActive, p.id, localId]
                                );
                            }
                        } else {
                            await tx.executeSql(
                                'INSERT INTO products (categoryId, name, price, costPrice, enableCostPrice, stock, imageUrl, isUnlimitedStock, barcode, minStock, discountActive, discountType, discountValue, discountStartAt, discountEndAt, discountStartTime, discountEndTime, discountDays, discountLabel, isActive, serverId, isSynced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
                                [localCategoryId, p.name, p.price, p.costPrice || 0, p.enableCostPrice ? 1 : 0, p.stock || 0, p.imageUrl, p.isUnlimitedStock ? 1 : 0, p.barcode, p.minStock || 0, p.discountActive ? 1 : 0, p.discountType || null, p.discountValue || 0, p.discountStartAt || null, p.discountEndAt || null, p.discountStartTime || null, p.discountEndTime || null, p.discountDays || null, p.discountLabel || null, isActive, p.id]
                            );
                        }
                    }
                }

                // User server boleh disinkronkan, tetapi kredensial offline hanya
                // dipertahankan jika sudah berupa hash bcrypt dari login sah.
                if (data.users) {
                    const [resAll] = await tx.executeSql('SELECT id, email, username, pin FROM users');
                    const pinMap: any = {};
                    for (let i = 0; i < resAll.rows.length; i++) {
                        const row = resAll.rows.item(i);
                        const safePin = typeof row.pin === 'string' && row.pin.startsWith('$2') ? row.pin : '';
                        if (row.email) pinMap[`email:${String(row.email).toLowerCase()}`] = safePin;
                        if (row.username) pinMap[`username:${String(row.username).toLowerCase()}`] = safePin;
                        pinMap[`id:${row.id}`] = safePin;
                    }
                    await tx.executeSql('DELETE FROM users');
                    for (const u of data.users) {
                        const existPin = pinMap[`id:${u.id}`]
                            || pinMap[`email:${String(u.email || '').toLowerCase()}`]
                            || pinMap[`username:${String(u.username || '').toLowerCase()}`]
                            || '';
                        await tx.executeSql(
                            'INSERT OR REPLACE INTO users (id, name, email, username, pin, role) VALUES (?, ?, ?, ?, ?, ?)',
                            [u.id, u.name, u.email, u.username || null, existPin, u.role]
                        );
                    }
                }

                // Customers
                if (data.customers) {
                    for (const c of data.customers) {
                        const [checkRes] = await tx.executeSql('SELECT id, isSynced FROM customers WHERE serverId = ? OR id = ?', [c.id, c.androidId]);
                        if (checkRes.rows.length > 0) {
                            const localCustomer = checkRes.rows.item(0);
                            if (Number(localCustomer.isSynced) === 0) {
                                await tx.executeSql('UPDATE customers SET serverId = COALESCE(serverId, ?) WHERE id = ?', [c.id, localCustomer.id]);
                            } else {
                                await tx.executeSql('UPDATE customers SET name = ?, phone = ?, email = ?, notes = ?, imageUrl = ?, displayType = ?, memberId = ?, loyaltyDiscount = ?, points = ?, serverId = ?, isSynced = 1 WHERE id = ?', [c.name, c.phone, c.email || null, c.notes || null, c.imageUrl || null, c.displayType || 'normal', c.memberId || null, c.loyaltyDiscount || 0, c.points || 0, c.id, localCustomer.id]);
                            }
                        } else {
                            await tx.executeSql('INSERT INTO customers (name, phone, email, notes, imageUrl, displayType, memberId, loyaltyDiscount, points, serverId, isSynced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)', [c.name, c.phone, c.email || null, c.notes || null, c.imageUrl || null, c.displayType || 'normal', c.memberId || null, c.loyaltyDiscount || 0, c.points || 0, c.id]);
                        }
                    }
                }

                // Suppliers — upsert by serverId
                if (data.suppliers) {
                    for (const s of data.suppliers) {
                        const [checkRes] = await tx.executeSql('SELECT id, isSynced FROM suppliers WHERE serverId = ? OR id = ?', [s.id, s.id]);
                        if (checkRes.rows.length > 0) {
                            const localSupplier = checkRes.rows.item(0);
                            if (Number(localSupplier.isSynced) === 0) {
                                await tx.executeSql('UPDATE suppliers SET serverId = COALESCE(serverId, ?) WHERE id = ?', [s.id, localSupplier.id]);
                            } else {
                                await tx.executeSql('UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ?, serverId = ?, isSynced = 1 WHERE id = ?', [s.name, s.phone || s.contact, s.address, s.notes || '', s.id, localSupplier.id]);
                            }
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
                                await tx.executeSql('UPDATE packages SET name = ?, description = ?, price = ?, imageUrl = ?, isActive = ?, serverId = ?, isSynced = 1 WHERE id = ?', [pk.name, pk.description, pk.price, pk.imageUrl || null, pk.isActive ? 1 : 0, pk.id, localPackage.id]);
                            }
                        } else {
                            await tx.executeSql('INSERT INTO packages (name, description, price, imageUrl, isActive, createdAt, serverId, isSynced) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', [pk.name, pk.description, pk.price, pk.imageUrl || null, pk.isActive ? 1 : 0, new Date().toISOString(), pk.id]);
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
                        const [checkRes] = await tx.executeSql('SELECT id, isSynced FROM dine_tables WHERE serverId = ? OR id = ?', [tb.id, tb.id]);
                        if (checkRes.rows.length > 0) {
                            const localTable = checkRes.rows.item(0);
                            if (Number(localTable.isSynced) === 0) {
                                await tx.executeSql('UPDATE dine_tables SET serverId = COALESCE(serverId, ?) WHERE id = ?', [tb.id, localTable.id]);
                            } else {
                                await tx.executeSql('UPDATE dine_tables SET number = ?, name = ?, capacity = ?, status = ?, serverId = ?, isSynced = 1 WHERE id = ?', [tb.number, tb.name, tb.capacity || 4, tb.status || 'AVAILABLE', tb.id, localTable.id]);
                            }
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

                        const [checkRes] = await tx.executeSql('SELECT id, isSynced FROM product_addons WHERE serverId = ? OR (productId = ? AND name = ?)', [ad.id, localProductId, ad.name]);
                        if (checkRes.rows.length > 0) {
                            const localAddon = checkRes.rows.item(0);
                            if (Number(localAddon.isSynced) === 0) {
                                await tx.executeSql('UPDATE product_addons SET serverId = COALESCE(serverId, ?) WHERE id = ?', [ad.id, localAddon.id]);
                            } else {
                                await tx.executeSql('UPDATE product_addons SET productId = ?, name = ?, price = ?, serverId = ?, isSynced = 1 WHERE id = ?', [localProductId, ad.name, ad.price, ad.id, localAddon.id]);
                            }
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
                            `DELETE FROM categories WHERE isSynced = 1 AND serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
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
                            `DELETE FROM product_addons WHERE isSynced = 1 AND productId IN (SELECT id FROM products WHERE isSynced = 1 AND serverId IS NOT NULL AND serverId NOT IN (${placeholders}))`,
                            serverProdIds
                        );
                        // Then delete the products
                        await tx.executeSql(
                            `DELETE FROM products WHERE isSynced = 1 AND serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
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
                            `DELETE FROM product_addons WHERE isSynced = 1 AND serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
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
                            `DELETE FROM suppliers WHERE isSynced = 1 AND serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
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
                            `DELETE FROM package_items WHERE packageId IN (SELECT id FROM packages WHERE isSynced = 1 AND serverId IS NOT NULL AND serverId NOT IN (${placeholders}))`,
                            serverPkgIds
                        );
                        await tx.executeSql(
                            `DELETE FROM packages WHERE isSynced = 1 AND serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
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
                            `DELETE FROM dine_tables WHERE isSynced = 1 AND serverId IS NOT NULL AND serverId NOT IN (${placeholders})`,
                            serverTableIds
                        );
                    }
                }
            // End of sequential db execution

            await db.executeSql(
                `INSERT OR REPLACE INTO settings (key, value) VALUES ('sync_initialized', 'true')`
            );
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
            const [resetVersionResult] = await db.executeSql(
                `SELECT value FROM settings WHERE key = 'dataResetVersion'`
            );
            const dataResetVersion = resetVersionResult.rows.length > 0
                ? Number(resetVersionResult.rows.item(0).value || 0)
                : 0;
            const [initialSyncResult] = await db.executeSql(
                `SELECT value FROM settings WHERE key = 'sync_initialized'`
            );
            if (initialSyncResult.rows.length === 0 || initialSyncResult.rows.item(0).value !== 'true') {
                return {
                    success: true,
                    message: 'Initial master sync required',
                    requiresMasterSync: true,
                };
            }
            
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
                    if (tx.custServerId) txToSend.customerServerId = tx.custServerId;
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
                const [custRes] = await db.executeSql('SELECT * FROM customers WHERE isSynced = 0');
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
                const [pkgRes] = await db.executeSql('SELECT * FROM packages WHERE isSynced = 0');
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
            const settings: any[] = [];
            const [settingsPendingResult] = await db.executeSql(
                `SELECT value FROM settings WHERE key = 'settings_sync_pending'`
            );
            const settingsArePending = settingsPendingResult.rows.length > 0 &&
                settingsPendingResult.rows.item(0).value === 'true';
            if (settingsArePending) {
                const [settingsRes] = await db.executeSql('SELECT * FROM settings');
                for (let i = 0; i < settingsRes.rows.length; i++) {
                    const row = settingsRes.rows.item(i);
                    if (!LOCAL_ONLY_KEYS.includes(row.key)) {
                        settings.push({ key: row.key, value: row.value });
                    }
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
            const customersForPush = customers.map((customer) => {
                if (!isDeviceAssetUrl(customer.imageUrl)) return customer;
                const customerWithoutLocalImage = { ...customer };
                delete customerWithoutLocalImage.imageUrl;
                return customerWithoutLocalImage;
            });
            const payload = { transactions, expenses, shifts, categories, products: productsForPush, customers: customersForPush, settings, stockReceipts, suppliers, packages, dineTables, addons, dataResetVersion };
            const res = await api.post('/sync/push', payload, {
                headers: { 'X-LitePOS-Sync-Version': '2' },
            });
            
            if (res.data.success) {
                const idMap = res.data.idMap || {};
                const syncedIds = res.data.syncedIds || {};
                const warnings = Array.isArray(res.data.warnings) ? res.data.warnings : [];
                const acknowledgedIds = (
                    key: string,
                    rows: any[],
                    warningEntity: string
                ): Array<string | number> => {
                    if (Array.isArray(syncedIds[key])) return syncedIds[key];
                    const rejected = new Set(
                        warnings
                            .filter((warning: any) => warning.entity === warningEntity)
                            .map((warning: any) => String(warning.id))
                    );
                    return rows
                        .map((row) => row.id)
                        .filter((id) => !rejected.has(String(id)));
                };

                // react-native-sqlite-storage tidak menunggu callback transaction yang async.
                // Jalankan pembaruan berurutan agar status sinkron selalu selesai sebelum return.
                // PENTING: Mapping serverId HARUS dilakukan SEBELUM upload gambar agar
                // meskipun upload gagal, serverId sudah tercatat dan sync berikutnya tidak duplikat.
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

                await markRowsSynced(db, 'transactions', acknowledgedIds('transactions', transactions, 'transaction'));
                await markRowsSynced(db, 'expenses', acknowledgedIds('expenses', expenses, 'expense'));
                await markRowsSynced(db, 'shifts', acknowledgedIds('shifts', shifts, 'shift'));
                await markRowsSynced(db, 'stock_receipts', acknowledgedIds('stockReceipts', stockReceipts, 'stockReceipt'));
                if (settings.length > 0) {
                    await db.executeSql(
                        `INSERT OR REPLACE INTO settings (key, value) VALUES ('settings_sync_pending', 'false')`
                    );
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

                // File galeri hanya ada di perangkat. Upload setelah serverId dipetakan,
                // lalu simpan kembali path relatif backend agar tetap mengikuti apiBaseUrl aktif.
                // Wrap per-item dalam try-catch agar satu kegagalan tidak membatalkan seluruh sync.
                const productServerIds = new Map<string, number>(
                    (idMap.products || []).map(
                        (item: any) => [String(item.androidId), Number(item.serverId)] as [string, number]
                    )
                );
                for (const product of products.filter((item) => isDeviceAssetUrl(item.imageUrl))) {
                    try {
                        const serverProductId = Number(
                            product.serverId || productServerIds.get(String(product.id)) || 0
                        );
                        if (!serverProductId) {
                            console.warn(`Server ID untuk gambar produk ${product.name} tidak ditemukan, lewati upload.`);
                            continue;
                        }

                        const remoteImageUrl = await uploadProductImage(serverProductId, product.imageUrl);
                        await db.executeSql(
                            'UPDATE products SET imageUrl = ? WHERE id = ?',
                            [remoteImageUrl, product.id]
                        );
                    } catch (imgErr) {
                        console.warn(`Gagal upload gambar produk ${product.name}:`, imgErr);
                    }
                }

                const customerServerIds = new Map<string, number>(
                    (idMap.customers || []).map(
                        (item: any) => [String(item.androidId), Number(item.serverId)] as [string, number]
                    )
                );
                for (const customer of customers.filter((item) => isDeviceAssetUrl(item.imageUrl))) {
                    try {
                        const serverCustomerId = Number(
                            customer.serverId || customerServerIds.get(String(customer.id)) || 0
                        );
                        if (!serverCustomerId) {
                            console.warn(`Server ID untuk foto pelanggan ${customer.name} tidak ditemukan, lewati upload.`);
                            continue;
                        }
                        const remoteImageUrl = await uploadCustomerImage(serverCustomerId, customer.imageUrl);
                        await db.executeSql('UPDATE customers SET imageUrl = ? WHERE id = ?', [remoteImageUrl, customer.id]);
                    } catch (imgErr) {
                        console.warn(`Gagal upload foto pelanggan ${customer.name}:`, imgErr);
                    }
                }

                return {
                    success: true,
                    message: 'Local data pushed to server and IDs mapped successfully',
                    warnings,
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
                            'SELECT id, preOrderConfirmed, isSynced FROM transactions WHERE invoiceNumber = ?',
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
                                `INSERT INTO transactions (id, invoiceNumber, grandTotal, discountAmount, taxAmount, paymentMethod, cashAmount, changeAmount, customerId, customerName, createdAt, status, preOrderDate, paymentStatus, paidAmount, remainingAmount, paidAt, orderType, tableName, preOrderConfirmed, isSynced)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                                [
                                    tx.id,
                                    tx.invoiceNumber,
                                    tx.grandTotal,
                                    tx.discountAmount || 0,
                                    tx.taxAmount || 0,
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
                                    tx.preOrderConfirmed === true || Number(tx.preOrderConfirmed) === 1 ? 1 : 0,
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
                                        `INSERT INTO transaction_items (transactionId, productId, quantity, price, originalPrice, discountAmount, notes)
                                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                        [
                                            tx.id,
                                            localProductId,
                                            item.quantity || 1,
                                            item.price,
                                            item.originalPrice || item.price,
                                            item.discountAmount || 0,
                                            item.notes || null,
                                        ]
                                    );
                                }
                            }
                        } else {
                            // Transaksi sudah ada — update status jika berubah (misal RETURNED)
                            const existing = checkRes.rows.item(0);
                            const localConfirmed = Number(existing.preOrderConfirmed) === 1;
                            const serverConfirmed = tx.preOrderConfirmed === true || Number(tx.preOrderConfirmed) === 1;
                            const mergedConfirmed = localConfirmed || serverConfirmed ? 1 : 0;
                            const hasPendingLocalChanges = Number(existing.isSynced) === 0;
                            if (hasPendingLocalChanges) {
                                // Jangan timpa pembayaran/konfirmasi lokal yang belum berhasil dikirim.
                                // Konfirmasi dari server tetap boleh bergerak satu arah false -> true.
                                await db.executeSql(
                                    'UPDATE transactions SET preOrderConfirmed = ? WHERE id = ?',
                                    [mergedConfirmed, existing.id]
                                );
                            } else {
                                const paymentStatus = tx.paymentStatus || 'PAID';
                                const paidAmount = tx.paidAmount ?? (paymentStatus === 'PAID' ? tx.grandTotal : 0);
                                const remainingAmount = tx.remainingAmount ?? Math.max(0, Number(tx.grandTotal || 0) - Number(paidAmount || 0));
                                await db.executeSql(
                                    `UPDATE transactions
                                     SET status = ?, preOrderConfirmed = ?, paymentMethod = ?, cashAmount = ?,
                                         changeAmount = ?, paymentStatus = ?, paidAmount = ?, remainingAmount = ?,
                                         paidAt = ?, isSynced = 1
                                     WHERE id = ?`,
                                    [
                                        tx.status || 'COMPLETED', mergedConfirmed, tx.paymentMethod || 'CASH',
                                        tx.cashAmount, tx.changeAmount, paymentStatus, paidAmount,
                                        remainingAmount, tx.paidAt, existing.id,
                                    ]
                                );
                            }
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
                                 VALUES (?, ?, ?, ?, ?, 1)`,
                                [exp.description, exp.amount, exp.category || 'Umum', exp.type === 'PURCHASE' ? 'PURCHASE' : 'EXPENSE', exp.createdAt]
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
                                `INSERT INTO shifts (id, userId, userName, openedAt, expectedCloseAt, closedAt, openingCash, closingCash, status, isSynced)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                                [
                                    shift.id,
                                    shift.userId,
                                    shift.userName,
                                    shift.openedAt,
                                    shift.expectedCloseAt || null,
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
                                    'UPDATE shifts SET status = ?, expectedCloseAt = COALESCE(expectedCloseAt, ?), closedAt = ?, closingCash = ?, isSynced = 1 WHERE id = ? AND status = ?',
                                    [shift.status, shift.expectedCloseAt || null, shift.closedAt, shift.closingCash, shift.id, 'OPEN']
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
