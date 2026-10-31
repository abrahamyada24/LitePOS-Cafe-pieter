// Sale names are historical data. Packages use pkg-{id}, never a products.id.
// The joins also recover names for older invoices without a stored snapshot.
export const transactionItemJoins = `
    LEFT JOIN products p ON p.id = ti.productId
    LEFT JOIN packages pkg ON ti.productId = ('pkg-' || pkg.id)
`;

export const transactionItemName = `COALESCE(
    NULLIF(TRIM(ti.productName), ''),
    NULLIF(TRIM(p.name), ''),
    '[Paket] ' || NULLIF(TRIM(pkg.name), ''),
    CASE WHEN ti.productId LIKE 'pkg-%' THEN 'Paket' END,
    'Produk dihapus'
)`;
