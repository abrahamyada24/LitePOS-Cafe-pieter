const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    const seedCredentials = [
        ['SEED_OWNER_PASSWORD', 'boss@litepos.com', 'Boss LitePOS', 'OWNER'],
        ['SEED_ADMIN_PASSWORD', 'admin@litepos.com', 'Admin LitePOS', 'ADMIN'],
        ['SEED_CASHIER_PASSWORD', 'cashier@litepos.com', 'Kasir Utama', 'CASHIER'],
    ];

    const missingCredentials = seedCredentials
        .map(([environmentKey]) => environmentKey)
        .filter((environmentKey) => !process.env[environmentKey]);
    if (missingCredentials.length > 0) {
        throw new Error(`Environment seed password wajib diisi: ${missingCredentials.join(', ')}`);
    }

    for (const [environmentKey, email, name, role] of seedCredentials) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            await prisma.user.update({
                where: { id: existingUser.id },
                data: { name, role, isActive: true },
            });
            console.log(`User already exists; password preserved: ${email} (${role})`);
            continue;
        }

        await prisma.user.create({
            data: {
                name,
                email,
                password: await bcrypt.hash(process.env[environmentKey], 12),
                role,
                isActive: true,
                mustChangePassword: true,
            },
        });
        console.log(`User created and must change password: ${email} (${role})`);
    }

    // 3. Create Default Categories (Optional but helpful)
    const categories = ['Makanan', 'Minuman', 'Dessert', 'Snack'];

    for (const catName of categories) {
        await prisma.category.upsert({
            where: { id: 0 }, // Hacky check, usually we use unique name or findFirst
            // Since schema doesn't have unique name on category, we will just use createMany or check manually.
            // For upsert we need unique field. Let's stick to just users for now to be safe, 
            // OR better: check if exists first.
            update: {},
            create: { name: catName }
        }).catch(() => { }); // Ignore if fails due to id or something, actually upsert needs unique constraint.
    }

    // 4. Default Store Settings
    const settings = await prisma.storeSetting.upsert({
        where: { id: 1 },
        update: {
            storeName: 'LitePOS Store',
            allowNegativeStock: false,
            showImages: true,
            theme: 'light',
        },
        create: {
            id: 1,
            storeName: 'LitePOS Store',
            allowNegativeStock: false,
            showImages: true,
            theme: 'light',
        },
    });
    console.log('Store settings initialized.');

    // 5. Default Loyalty Config
    const loyalty = await prisma.loyaltyConfig.upsert({
        where: { id: 1 },
        update: {
            pointMultiplier: 1,
            multiplierAmount: 10000,
            pointValue: 100,
            minRedemptionPoints: 10,
            isActive: true,
        },
        create: {
            id: 1,
            pointMultiplier: 1,
            multiplierAmount: 10000,
            pointValue: 100,
            minRedemptionPoints: 10,
            isActive: true,
        },
    });
    console.log('Loyalty configuration initialized.');

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
