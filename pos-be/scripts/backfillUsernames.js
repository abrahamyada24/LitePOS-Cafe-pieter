const { PrismaClient } = require('@prisma/client');
const { generateUniqueUsername } = require('../src/services/usernameService');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, email: true, name: true },
    orderBy: { id: 'asc' },
  });

  let updated = 0;
  for (const user of users) {
    const username = await generateUniqueUsername(prisma, user.email || user.name, user.id);
    await prisma.user.update({ where: { id: user.id }, data: { username } });
    updated += 1;
  }

  console.log(`Username siap: ${updated} akun diperbarui.`);
}

main()
  .catch((error) => {
    console.error(`Backfill username gagal: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
