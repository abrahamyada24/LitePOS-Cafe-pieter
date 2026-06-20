const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

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

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

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
    res.status(500).json({ database: "DISCONNECTED", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n[OK] Server berjalan di: http://localhost:${PORT}`);
  console.log(`[DOCS] Dokumentasi API: http://localhost:${PORT}/api-docs\n`);
});