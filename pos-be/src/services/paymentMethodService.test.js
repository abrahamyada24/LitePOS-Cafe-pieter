const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePaymentMethod } = require('./paymentMethodService');

test('manual payment methods never use Midtrans', () => {
    for (const paymentType of ['CASH', 'TRANSFER', 'QRIS_MANUAL']) {
        assert.deepEqual(resolvePaymentMethod(paymentType), {
            paymentType,
            isGatewayPayment: false,
            isInstantPayment: true
        });
    }
});

test('QRIS gateway is rejected while Midtrans is disabled', () => {
    assert.throws(
        () => resolvePaymentMethod('QRIS'),
        error => error.code === 'MIDTRANS_DISABLED'
    );
});

test('QRIS gateway is available only when Midtrans is enabled', () => {
    assert.deepEqual(resolvePaymentMethod('qris', { midtransEnabled: true }), {
        paymentType: 'QRIS',
        isGatewayPayment: true,
        isInstantPayment: false
    });
});
