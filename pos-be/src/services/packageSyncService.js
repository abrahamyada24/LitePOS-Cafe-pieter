// Commit the package and its components together, before resolving sales that use it.
const upsertAndroidPackage = async (db, pkg) => db.$transaction(async tx => {
    const requestedServerId = Number(pkg.serverId);
    let existing = Number.isInteger(requestedServerId) && requestedServerId > 0
        ? await tx.package.findUnique({ where: { id: requestedServerId } })
        : await tx.package.findUnique({ where: { androidId: pkg.id } });
    if (pkg.serverId && !existing) throw new Error(`Paket server ${pkg.serverId} tidak ditemukan.`);

    let components;
    if (Array.isArray(pkg.items)) {
        if (pkg.items.length === 0) throw new Error('Isi paket tidak boleh kosong.');
        components = [];
        for (const item of pkg.items) {
            let product;
            if (item.serverProductId) {
                product = await tx.product.findUnique({ where: { id: Number(item.serverProductId) } });
            } else {
                const localId = Number(item.productId);
                product = await tx.product.findUnique({ where: { androidId: localId } });
                if (!product) product = await tx.product.findUnique({ where: { id: localId } });
            }
            if (!product) throw new Error(`Produk paket ${item.productId} tidak ditemukan di server.`);
            const qty = Number(item.quantity ?? item.qty ?? 1);
            if (!Number.isInteger(qty) || qty <= 0) throw new Error('Jumlah isi paket harus bilangan bulat positif.');
            components.push({ productId: product.id, qty });
        }
    } else if (!existing) {
        throw new Error('Isi paket wajib dikirim untuk paket baru.');
    }

    const data = {
        name: pkg.name || existing?.name,
        description: pkg.description ?? existing?.description ?? null,
        price: Number(pkg.price),
        imageUrl: pkg.imageUrl || existing?.imageUrl || null,
        isActive: pkg.isActive === true || Number(pkg.isActive) === 1,
    };
    if (!existing) {
        const saved = await tx.package.create({ data: {
            ...data, androidId: pkg.id, items: { create: components },
        } });
        return { id: saved.id, created: true };
    }
    if (components) await tx.packageItem.deleteMany({ where: { packageId: existing.id } });
    await tx.package.update({ where: { id: existing.id }, data: {
        ...data, ...(components ? { items: { create: components } } : {}),
    } });
    return { id: existing.id, created: false };
});

module.exports = { upsertAndroidPackage };
