const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { uploadDir } = require('./config/storage');

const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'litepos-development-only-secret';
  console.warn('[ENV] JWT_SECRET kosong; memakai secret khusus development.');
}

const requiredEnvironment = ['DATABASE_URL', ...(isProduction ? ['JWT_SECRET'] : [])];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);
if (missingEnvironment.length > 0) {
  throw new Error(`Environment wajib belum diisi: ${missingEnvironment.join(', ')}`);
}

const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

// Existing routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingRoutes = require('./routes/settingRoutes');
const userRoutes = require('./routes/userRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');

// New routes (PosAndroid integration)
const expenseRoutes = require('./routes/expenseRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const savedTransactionRoutes = require('./routes/savedTransactionRoutes');
const stockReceiptRoutes = require('./routes/stockReceiptRoutes');
const stockOpnameRoutes = require('./routes/stockOpnameRoutes');
const addonRoutes = require('./routes/addonRoutes');
const tableRoutes = require('./routes/tableRoutes');
const packageRoutes = require('./routes/packageRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const syncRoutes = require('./routes/syncRoutes');
const catalogRoutes = require('./routes/catalogRoutes'); // Rute Katalog Publik

const app = express();
const prisma = new PrismaClient();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const matchesOrigin = (origin, rule) => {
  if (rule === '*') return true;
  if (!rule.includes('*')) return origin === rule;

  const escapedRule = rule
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escapedRule}$`).test(origin);
};

const corsOptions = {
  origin(origin, callback) {
    // Aplikasi Android dan request server-to-server biasanya tidak mengirim Origin.
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');
    const allowUnconfiguredDevelopment = process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0;
    const isAllowed = allowUnconfiguredDevelopment || allowedOrigins.some((rule) => matchesOrigin(normalizedOrigin, rule));
    return callback(null, isAllowed);
  },
};

if (isProduction && allowedOrigins.length === 0) {
  throw new Error('CORS_ORIGINS wajib diisi pada environment production.');
}

fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

if (!isProduction || process.env.ENABLE_API_DOCS === 'true') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
}

// Existing API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);

// New API routes (PosAndroid integration)
app.use('/api/expenses', expenseRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/saved-transactions', savedTransactionRoutes);
app.use('/api/stock-receipts', stockReceiptRoutes);
app.use('/api/stock-opname', stockOpnameRoutes);
app.use('/api/addons', addonRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/catalog', catalogRoutes); // Akses publik tanpa token

app.get('/', (req, res) => {
  res.json({ message: "LitePOS Backend Service is Running!", timestamp: new Date() });
});

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ database: "CONNECTED", server: "ONLINE" });
  } catch (error) {
    console.error('[HEALTH] Database tidak terhubung:', error.message);
    res.status(500).json({ database: "DISCONNECTED", server: "ONLINE" });
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`\n[OK] Server berjalan di: http://${HOST}:${PORT}`);
  console.log(`[DOCS] Dokumentasi API: http://localhost:${PORT}/api-docs\n`);
});

const shutdown = async (signal) => {
  console.log(`[SHUTDOWN] Menerima ${signal}, menutup server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
