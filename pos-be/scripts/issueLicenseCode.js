const crypto = require('crypto');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { hashActivationCode } = require('../src/services/licenseService');

dotenv.config();
const prisma = new PrismaClient();

const getArg = (name, fallback = null) => {
  const entry = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  return entry ? entry.slice(name.length + 3) : fallback;
};

const durationDays = Number(getArg('days'));
const validDays = Number(getArg('valid-days', '30'));
const note = String(getArg('note', '')).trim() || null;

if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
  console.error('Gunakan --days=30 (rentang 1-3650 hari).');
  process.exit(1);
}
if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
  console.error('Gunakan --valid-days=30 (rentang 1-365 hari).');
  process.exit(1);
}

const raw = crypto.randomBytes(10).toString('hex').toUpperCase();
const code = `LP-${raw.match(/.{1,4}/g).join('-')}`;
const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

prisma.licenseActivation.create({
  data: {
    codeHash: hashActivationCode(code),
    plan: 'PREMIUM',
    durationDays,
    validUntil,
    note,
  },
}).then(() => {
  console.log(JSON.stringify({ code, durationDays, validUntil, note }));
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
