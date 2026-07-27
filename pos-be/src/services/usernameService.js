const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();

const validateUsername = (value) => {
  const username = normalizeUsername(value);
  if (!username) return 'Username wajib diisi.';
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username harus 3-50 karakter dan hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung.';
  }
  return null;
};

const usernameBaseFrom = (...values) => {
  const source = values.find((value) => String(value || '').trim()) || 'user';
  const emailPrefix = String(source).split('@')[0];
  let base = emailPrefix
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .replace(/[._-]{2,}/g, '.');

  if (base.length < 3) base = `user.${base || 'pos'}`;
  return base.slice(0, 50).replace(/[^a-z0-9]+$/g, '') || 'user.pos';
};

const generateUniqueUsername = async (prisma, preferred, excludeUserId = null) => {
  const base = usernameBaseFrom(preferred);

  for (let suffix = 0; suffix < 10000; suffix += 1) {
    const suffixText = suffix === 0 ? '' : `.${suffix + 1}`;
    const candidate = `${base.slice(0, 50 - suffixText.length)}${suffixText}`;
    const existing = await prisma.user.findFirst({
      where: {
        username: candidate,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  throw new Error('Tidak dapat membuat username unik.');
};

module.exports = {
  USERNAME_PATTERN,
  generateUniqueUsername,
  normalizeUsername,
  usernameBaseFrom,
  validateUsername,
};
