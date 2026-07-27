const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateUniqueUsername,
  normalizeUsername,
  usernameBaseFrom,
  validateUsername,
} = require('../src/services/usernameService');

test('normalisasi dan validasi username', () => {
  assert.equal(normalizeUsername('  BOSS.Toko  '), 'boss.toko');
  assert.equal(validateUsername('boss.toko'), null);
  assert.match(validateUsername('ab'), /3-50/);
  assert.match(validateUsername('boss toko'), /hanya boleh/);
});

test('membuat basis username aman dari email atau nama', () => {
  assert.equal(usernameBaseFrom('Boss Toko@example.com'), 'boss.toko');
  assert.equal(usernameBaseFrom('É'), 'user.e');
});

test('memberi suffix ketika username sudah dipakai', async () => {
  const used = new Set(['owner', 'owner.2']);
  const prisma = {
    user: {
      findFirst: async ({ where }) => used.has(where.username) ? { id: 1 } : null,
    },
  };
  assert.equal(await generateUniqueUsername(prisma, 'owner'), 'owner.3');
});
