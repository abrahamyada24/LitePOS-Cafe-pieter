import { receiptForTransaction } from '../src/utils/receiptSnapshot';
test('cetak ulang memakai snapshot nota dan saldo saat penjualan, dengan status pembayaran terkini', () => {
    const receipt = receiptForTransaction({
        id: 'one', grandTotal: 23000, paymentStatus: 'PAID', paidAmount: 23000,
        customerPoints: 99, pointsBalanceAfter: 8,
        receiptJson: JSON.stringify({ customerPoints: 8, items: [{ name: 'Menu asli' }], invoiceNumber: 'INV/20261027/K01/0001' }),
    }, [{ name: 'Nama berubah' }]);
    expect(receipt.customerPoints).toBe(8);
    expect(receipt.items[0].name).toBe('Menu asli');
    expect(receipt.paymentStatus).toBe('PAID');
});
test('nota lama tanpa snapshot memakai detail tersimpan', () => {
    expect(receiptForTransaction({ grandTotal: 1000, receiptJson: 'invalid' }, [{ name: 'Menu lama' }]).items[0].name).toBe('Menu lama');
});
