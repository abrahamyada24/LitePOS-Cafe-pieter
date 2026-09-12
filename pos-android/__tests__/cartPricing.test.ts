import { getCartItemEffectiveUnitPrice, getCartItemLineTotal } from '../src/utils/cartPricing';

test('jumlah produk dan jumlah add-on dihitung terpisah', () => {
    const item = {
        price: 18500,
        basePrice: 8500,
        quantity: 10,
        addons: [{ price: 1000, quantity: 10 }],
    };

    expect(getCartItemLineTotal(item)).toBe(95000);
    expect(getCartItemEffectiveUnitPrice(item)).toBe(9500);
});

test('data transaksi lama tanpa rincian add-on tetap memakai harga tersimpan', () => {
    expect(getCartItemLineTotal({ price: 9500, basePrice: 8500, quantity: 10 })).toBe(95000);
});
