const test = require('node:test');
const assert = require('node:assert/strict');
const { isProductAvailable } = require('./productAvailability');

const scheduledProduct = {
    isActive: true,
    availabilityScheduleEnabled: true,
    availabilityStartTime: '09:00',
    availabilityEndTime: '11:00',
    availabilityDays: '1',
};

test('produk hanya tersedia pada jadwal Jakarta', () => {
    assert.equal(isProductAvailable(scheduledProduct, new Date('2026-09-14T02:30:00Z')), true);
    assert.equal(isProductAvailable(scheduledProduct, new Date('2026-09-14T05:00:00Z')), false);
});

test('jadwal melewati tengah malam memakai hari mulai', () => {
    const product = {
        ...scheduledProduct,
        availabilityStartTime: '18:00',
        availabilityEndTime: '02:00',
    };
    assert.equal(isProductAvailable(product, new Date('2026-09-14T18:00:00Z')), true);
    assert.equal(isProductAvailable(product, new Date('2026-09-15T03:00:00Z')), false);
});

test('produk nonaktif selalu tidak tersedia', () => {
    assert.equal(isProductAvailable({ ...scheduledProduct, isActive: false }, new Date('2026-09-14T02:30:00Z')), false);
});
