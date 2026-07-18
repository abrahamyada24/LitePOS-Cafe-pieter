import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

export const getDBConnection = async () => {
  return SQLite.openDatabase({ name: 'pos.db', location: 'default' });
};

export const createTables = async (db: any) => {
  const queryUsers = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      pin TEXT NOT NULL,
      role TEXT DEFAULT 'CASHIER'
    );
  `;
  const queryCategories = `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `;
  const queryProducts = `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoryId INTEGER,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      costPrice REAL DEFAULT 0,
      enableCostPrice INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 0,
      imageUrl TEXT,
      isUnlimitedStock INTEGER DEFAULT 0,
      barcode TEXT,
      minStock INTEGER DEFAULT 0,
      discountActive INTEGER DEFAULT 0,
      discountType TEXT,
      discountValue REAL DEFAULT 0,
      discountStartAt TEXT,
      discountEndAt TEXT,
      discountStartTime TEXT,
      discountEndTime TEXT,
      discountDays TEXT,
      discountLabel TEXT,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
  `;
  const queryTransactions = `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT NOT NULL,
      grandTotal REAL NOT NULL,
      discountAmount REAL DEFAULT 0,
      paymentMethod TEXT NOT NULL,
      cashAmount REAL,
      changeAmount REAL,
      customerId INTEGER,
      customerName TEXT,
      createdAt TEXT NOT NULL,
      status TEXT DEFAULT 'COMPLETED',
      preOrderDate TEXT,
      paymentStatus TEXT DEFAULT 'PAID',
      paidAmount REAL DEFAULT 0,
      remainingAmount REAL DEFAULT 0,
      paidAt TEXT,
      orderType TEXT DEFAULT 'TAKE_AWAY',
      tableName TEXT
    );
  `;
  const queryTransactionItems = `
    CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transactionId TEXT,
        productId INTEGER,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        originalPrice REAL DEFAULT 0,
        discountAmount REAL DEFAULT 0,
        costPrice REAL DEFAULT 0,
        notes TEXT,
      FOREIGN KEY (transactionId) REFERENCES transactions(id),
      FOREIGN KEY (productId) REFERENCES products(id)
    );
  `;
  const querySettings = `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;
  const queryCustomers = `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      loyaltyDiscount REAL DEFAULT 0,
      points INTEGER DEFAULT 0
    );
  `;
  const queryExpenses = `
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT DEFAULT 'Umum',
      type TEXT DEFAULT 'EXPENSE',
      createdAt TEXT NOT NULL
    );
  `;
  // Migration untuk expenses dipindah ke bawah bersama migration lainnya
  const querySavedTransactions = `
    CREATE TABLE IF NOT EXISTS saved_transactions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cartData TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `;
  const queryStockReceipts = `
    CREATE TABLE IF NOT EXISTS stock_receipts (
      id TEXT PRIMARY KEY,
      receivedAt TEXT NOT NULL,
      notes TEXT,
      createdBy TEXT,
      isSynced INTEGER DEFAULT 0
    );
  `;
  const queryStockReceiptItems = `
    CREATE TABLE IF NOT EXISTS stock_receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receiptId TEXT NOT NULL,
      productId INTEGER NOT NULL,
      productName TEXT,
      quantityBefore INTEGER DEFAULT 0,
      quantityAdded INTEGER NOT NULL,
      costPrice REAL DEFAULT 0
    );
  `;
  const queryShifts = `
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      userId INTEGER,
      userName TEXT,
      openedAt TEXT NOT NULL,
      closedAt TEXT,
      openingCash REAL DEFAULT 0,
      closingCash REAL,
      status TEXT DEFAULT 'OPEN'
    );
  `;
  const queryProductAddons = `
    CREATE TABLE IF NOT EXISTS product_addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      FOREIGN KEY (productId) REFERENCES products(id)
    );
  `;
  const queryDineTables = `
    CREATE TABLE IF NOT EXISTS dine_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      name TEXT,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'AVAILABLE'
    );
  `;
  const queryPackages = `
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      imageUrl TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL
    );
  `;
  const queryPackageItems = `
    CREATE TABLE IF NOT EXISTS package_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packageId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (packageId) REFERENCES packages(id),
      FOREIGN KEY (productId) REFERENCES products(id)
    );
  `;
  const querySuppliers = `
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT
    );
  `;

  await db.executeSql(queryUsers);
  await db.executeSql(queryCategories);
  await db.executeSql(queryProducts);
  await db.executeSql(queryTransactions);
  await db.executeSql(queryTransactionItems);
  await db.executeSql(querySettings);
  await db.executeSql(queryCustomers);
  await db.executeSql(queryExpenses);
  await db.executeSql(querySavedTransactions);
  await db.executeSql(queryStockReceipts);
  await db.executeSql(queryStockReceiptItems);
  await db.executeSql(queryShifts);
  await db.executeSql(queryProductAddons);
  await db.executeSql(queryDineTables);
  await db.executeSql(queryPackages);
  await db.executeSql(queryPackageItems);
  await db.executeSql(querySuppliers);

  // Performance Indexes
  try {
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_createdAt ON transactions(createdAt)');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transaction_items_txId ON transaction_items(transactionId)');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_expenses_createdAt ON expenses(createdAt)');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_shifts_openedAt ON shifts(openedAt)');
  } catch (e) {
    console.log('Failed to create indexes', e);
  }

  // Migrations for existing tables safely using PRAGMA
  const migrations = [
    { table: 'products', column: 'isUnlimitedStock', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'costPrice', def: 'REAL DEFAULT 0' },
    { table: 'products', column: 'enableCostPrice', def: 'INTEGER DEFAULT 0' },
    { table: 'transaction_items', column: 'notes', def: 'TEXT' },
    { table: 'transaction_items', column: 'costPrice', def: 'REAL DEFAULT 0' },
    { table: 'transactions', column: 'status', def: "TEXT DEFAULT 'COMPLETED'" },
    { table: 'transactions', column: 'discountAmount', def: 'REAL DEFAULT 0' },
    { table: 'transactions', column: 'customerId', def: 'INTEGER' },
    { table: 'transactions', column: 'customerName', def: 'TEXT' },
    { table: 'transactions', column: 'preOrderDate', def: 'TEXT' },
    { table: 'transactions', column: 'paymentStatus', def: "TEXT DEFAULT 'PAID'" },
    { table: 'transactions', column: 'paidAmount', def: 'REAL DEFAULT 0' },
    { table: 'transactions', column: 'remainingAmount', def: 'REAL DEFAULT 0' },
    { table: 'transactions', column: 'paidAt', def: 'TEXT' },
    { table: 'transactions', column: 'orderType', def: "TEXT DEFAULT 'TAKE_AWAY'" },
    { table: 'transactions', column: 'tableName', def: 'TEXT' },
    { table: 'customers', column: 'loyaltyDiscount', def: 'REAL DEFAULT 0' },
    { table: 'transactions', column: 'preOrderConfirmed', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'barcode', def: 'TEXT' },
    { table: 'products', column: 'minStock', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'discountActive', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'discountType', def: 'TEXT' },
    { table: 'products', column: 'discountValue', def: 'REAL DEFAULT 0' },
    { table: 'products', column: 'discountStartAt', def: 'TEXT' },
    { table: 'products', column: 'discountEndAt', def: 'TEXT' },
    { table: 'products', column: 'discountStartTime', def: 'TEXT' },
    { table: 'products', column: 'discountEndTime', def: 'TEXT' },
    { table: 'products', column: 'discountDays', def: 'TEXT' },
    { table: 'products', column: 'discountLabel', def: 'TEXT' },
    { table: 'transaction_items', column: 'originalPrice', def: 'REAL DEFAULT 0' },
    { table: 'transaction_items', column: 'discountAmount', def: 'REAL DEFAULT 0' },
    { table: 'expenses', column: 'type', def: "TEXT DEFAULT 'EXPENSE'" },
    // Offline Sync Migrations
    { table: 'transactions', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'expenses', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'shifts', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'users', column: 'email', def: 'TEXT' },
    { table: 'categories', column: 'serverId', def: 'INTEGER' },
    { table: 'categories', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'products', column: 'serverId', def: 'INTEGER' },
    { table: 'products', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'customers', column: 'serverId', def: 'INTEGER' },
    { table: 'customers', column: 'points', def: 'INTEGER DEFAULT 0' },
    { table: 'customers', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'stock_receipts', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    // Bidirectional sync for Suppliers, Packages, DineTables, ProductAddons
    { table: 'suppliers', column: 'serverId', def: 'INTEGER' },
    { table: 'suppliers', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'packages', column: 'serverId', def: 'INTEGER' },
    { table: 'packages', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'packages', column: 'imageUrl', def: 'TEXT' },
    { table: 'dine_tables', column: 'serverId', def: 'INTEGER' },
    { table: 'dine_tables', column: 'isSynced', def: 'INTEGER DEFAULT 0' },
    { table: 'product_addons', column: 'serverId', def: 'INTEGER' },
    { table: 'product_addons', column: 'isSynced', def: 'INTEGER DEFAULT 0' }
  ];

  for (const migration of migrations) {
    try {
      const [res] = await db.executeSql(`PRAGMA table_info(${migration.table})`);
      let hasColumn = false;
      for (let i = 0; i < res.rows.length; i++) {
        if (res.rows.item(i).name === migration.column) {
          hasColumn = true;
          break;
        }
      }
      if (!hasColumn) {
        await db.executeSql(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.def}`);
      }
    } catch (e) {
      console.log(`Failed migration for ${migration.table}.${migration.column}`, e);
    }
  }
};

export const getStoreSummary = async (db: any) => {
  const today = new Date().toISOString().split('T')[0];
  const [revenueRes] = await db.executeSql(
    `SELECT SUM(
       CASE
         WHEN COALESCE(paidAmount, 0) > 0 THEN paidAmount
         ELSE grandTotal
       END
     ) as total
     FROM transactions
     WHERE COALESCE(paidAt, createdAt) LIKE '${today}%'
       AND status != 'RETURNED'
       AND COALESCE(paymentStatus, 'PAID') = 'PAID'`
  );
  const [countRes] = await db.executeSql(
    `SELECT COUNT(*) as count
     FROM transactions
     WHERE COALESCE(paidAt, createdAt) LIKE '${today}%'
       AND status != 'RETURNED'
       AND COALESCE(paymentStatus, 'PAID') = 'PAID'`
  );
  const [returnRes] = await db.executeSql(
    `SELECT COUNT(*) as count FROM transactions WHERE createdAt LIKE '${today}%' AND status = 'RETURNED'`
  );

  return {
    todayRevenue: revenueRes.rows.item(0).total || 0,
    todayCount: countRes.rows.item(0).count || 0,
    todayReturns: returnRes.rows.item(0).count || 0,
  };
};

export const seedInitialData = async (db: any) => {
  const [results] = await db.executeSql('SELECT count(*) as count FROM users');
  if (results.rows.item(0).count === 0) {
    await db.executeSql(`INSERT INTO users (name, email, pin, role) VALUES ('Owner', 'boss@litepos.com', '123456', 'OWNER')`);
    await db.executeSql(`INSERT INTO users (name, email, pin, role) VALUES ('Admin Toko', 'admin@litepos.com', '123456', 'ADMIN')`);
    await db.executeSql(`INSERT INTO users (name, email, pin, role) VALUES ('Kasir 1', 'kasir@litepos.com', '111111', 'CASHIER')`);
  } else {
    // Ensure OWNER exists and update credentials
    const [ownerRes] = await db.executeSql("SELECT count(*) as count FROM users WHERE role = 'OWNER'");
    if (ownerRes.rows.item(0).count === 0) {
      await db.executeSql(`INSERT INTO users (name, email, pin, role) VALUES ('Owner', 'boss@litepos.com', '123456', 'OWNER')`);
    } else {
      // Update existing OWNER with correct email and pin
      await db.executeSql(`UPDATE users SET email = 'boss@litepos.com', pin = '123456' WHERE role = 'OWNER' AND (email IS NULL OR email = '')`);
    }
    // Update ADMIN credentials
    const [adminRes] = await db.executeSql("SELECT count(*) as count FROM users WHERE role = 'ADMIN'");
    if (adminRes.rows.item(0).count > 0) {
      await db.executeSql(`UPDATE users SET email = 'admin@litepos.com', pin = '123456' WHERE role = 'ADMIN' AND (email IS NULL OR email = '')`);
    }
    // Update CASHIER credentials
    const [cashierRes] = await db.executeSql("SELECT count(*) as count FROM users WHERE role = 'CASHIER'");
    if (cashierRes.rows.item(0).count > 0) {
      await db.executeSql(`UPDATE users SET email = 'kasir@litepos.com', pin = '111111' WHERE role = 'CASHIER' AND (email IS NULL OR email = '')`);
    }
  }

  const [catResults] = await db.executeSql('SELECT count(*) as count FROM categories');
  if (catResults.rows.item(0).count === 0) {
    // Default categories and products removed. Only user accounts are seeded by default.
  }

  const [setResults] = await db.executeSql('SELECT count(*) as count FROM settings');
  if (setResults.rows.item(0).count === 0) {
    await db.executeSql(`INSERT INTO settings (key, value) VALUES ('storeName', 'LitePOS')`);
    await db.executeSql(`INSERT INTO settings (key, value) VALUES ('storeAddress', '')`);
    await db.executeSql(`INSERT INTO settings (key, value) VALUES ('storePhone', '')`);
    await db.executeSql(`INSERT INTO settings (key, value) VALUES ('showImages', 'true')`);
    await db.executeSql(`INSERT INTO settings (key, value) VALUES ('enableTableOrder', 'false')`);
    await db.executeSql(`INSERT INTO settings (key, value) VALUES ('enableKitchenPrint', 'false')`);
    await db.executeSql(`INSERT INTO settings (key, value) VALUES ('theme', 'light')`);
  } else {
    // Ensure new settings keys exist
    const settingKeys = [
      'storeAddress', 'storePhone', 'enablePreOrder', 'enableTableOrder', 'allowNegativeStock', 'receiptFooter', 'enableKitchenPrint',
      'loyalty_active', 'loyalty_multiplier', 'loyalty_multiplier_amount', 'loyalty_point_value', 'loyalty_min_points',
      'store_id', 'license_expire_date', 'license_type', 'google_sheet_url', 'apiBaseUrl'
    ];
    for (const key of settingKeys) {
      let defaultVal = '';
      if (key === 'enablePreOrder' || key === 'enableTableOrder' || key === 'allowNegativeStock' || key === 'loyalty_active' || key === 'enableKitchenPrint') {
        defaultVal = 'false';
      } else if (key === 'loyalty_multiplier' || key === 'loyalty_multiplier_amount' || key === 'loyalty_point_value' || key === 'loyalty_min_points') {
        defaultVal = key === 'loyalty_multiplier_amount' ? '1000' : (key === 'loyalty_multiplier' ? '1' : '0');
      } else if (key === 'store_id') {
        defaultVal = 'TK-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      } else if (key === 'license_expire_date') {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14); // 14 Days Trial
        defaultVal = trialEnd.toISOString();
      } else if (key === 'license_type') {
        defaultVal = 'TRIAL';
      }
      try {
        await db.executeSql(`INSERT OR IGNORE INTO settings (key, value) VALUES ('${key}', '${defaultVal}')`);
      } catch (e) { }
    }
  }
};
