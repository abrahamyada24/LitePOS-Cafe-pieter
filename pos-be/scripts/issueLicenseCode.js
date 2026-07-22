const crypto = require('crypto');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { hashActivationCode } = require('../src/services/licenseService');

dotenv.config();

const PERIODS = [
  { choice: '1', key: '1m', label: '1 bulan', durationDays: 30 },
  { choice: '2', key: '3m', label: '3 bulan', durationDays: 90 },
  { choice: '3', key: '6m', label: '6 bulan', durationDays: 180 },
  { choice: '4', key: '1y', label: '1 tahun', durationDays: 365 },
];

const getArg = (name, fallback = null) => {
  const entry = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  return entry ? entry.slice(name.length + 3) : fallback;
};

const findPeriod = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return PERIODS.find((period) => [
    period.choice,
    period.key,
    String(period.durationDays),
  ].includes(normalized));
};

const showHelp = () => {
  console.log('Generator kode aktivasi LitePOS');
  console.log('');
  console.log('Penggunaan interaktif:');
  console.log('  npm run license:issue');
  console.log('');
  console.log('Penggunaan langsung:');
  console.log('  npm run license:issue -- --period=1m --note="Nama pelanggan"');
  console.log('');
  console.log('Pilihan periode: 1m, 3m, 6m, 1y');
  console.log('Kode dapat ditukar selama 30 hari secara default.');
};

const promptForPeriod = async () => {
  const readline = require('readline/promises');
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('Pilih masa aktif lisensi:');
    PERIODS.forEach((period) => console.log(`  ${period.choice}. ${period.label}`));
    const choice = await input.question('Pilihan [1-4]: ');
    const period = findPeriod(choice);
    if (!period) throw new Error('Pilihan masa aktif tidak valid. Gunakan angka 1 sampai 4.');
    const note = String(await input.question('Catatan pelanggan (opsional): ')).trim() || null;
    return { period, note };
  } finally {
    input.close();
  }
};

const main = async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    return;
  }

  const requestedPeriod = getArg('period', getArg('days'));
  let period = findPeriod(requestedPeriod);
  let note = String(getArg('note', '')).trim() || null;

  if (!period) {
    if (requestedPeriod) {
      throw new Error('Periode tidak valid. Gunakan --period=1m, 3m, 6m, atau 1y.');
    }
    if (!process.stdin.isTTY) {
      throw new Error('Periode wajib diisi. Gunakan --period=1m, 3m, 6m, atau 1y.');
    }
    const prompted = await promptForPeriod();
    period = prompted.period;
    note = prompted.note;
  }

  const validDays = Number(getArg('valid-days', '30'));
  if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
    throw new Error('Gunakan --valid-days=30 (rentang 1-365 hari).');
  }

  const raw = crypto.randomBytes(10).toString('hex').toUpperCase();
  const code = `LP-${raw.match(/.{1,4}/g).join('-')}`;
  const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
  const prisma = new PrismaClient();

  try {
    await prisma.licenseActivation.create({
      data: {
        codeHash: hashActivationCode(code),
        plan: 'PREMIUM',
        durationDays: period.durationDays,
        validUntil,
        note,
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log('');
  console.log(`Kode aktivasi : ${code}`);
  console.log(`Masa aktif    : ${period.label}`);
  console.log(`Dapat dipakai : sampai ${validUntil.toLocaleString('id-ID')}`);
  if (note) console.log(`Catatan       : ${note}`);
  console.log('');
  console.log('Kode hanya dapat digunakan satu kali pada website atau Android oleh akun Owner.');
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
