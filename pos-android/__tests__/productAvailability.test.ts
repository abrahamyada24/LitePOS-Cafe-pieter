import { getProductAvailability, isProductAvailable } from '../src/utils/productAvailability';

const localDate = (day: number, hour: number, minute = 0) => {
    const date = new Date(2026, 8, 6 + day, hour, minute, 0, 0); // Minggu, 6 Sep 2026
    return date;
};

describe('product availability', () => {
    it('blocks a manually inactive product', () => {
        expect(isProductAvailable({ isActive: 0 }, localDate(1, 10))).toBe(false);
    });

    it('allows an active product without a schedule', () => {
        expect(isProductAvailable({ isActive: 1 }, localDate(1, 10))).toBe(true);
    });

    it('checks selected days and normal time ranges', () => {
        const product = {
            isActive: 1,
            availabilityScheduleEnabled: 1,
            availabilityDays: '1,2,3,4,5',
            availabilityStartTime: '08:00',
            availabilityEndTime: '17:00',
        };
        expect(isProductAvailable(product, localDate(1, 9))).toBe(true);
        expect(getProductAvailability(product, localDate(0, 9)).reason).toBe('OUTSIDE_DAY');
        expect(getProductAvailability(product, localDate(1, 18)).reason).toBe('OUTSIDE_TIME');
    });

    it('supports schedules that cross midnight', () => {
        const product = {
            isActive: 1,
            availabilityScheduleEnabled: 1,
            availabilityDays: '1',
            availabilityStartTime: '18:00',
            availabilityEndTime: '02:00',
        };
        expect(isProductAvailable(product, localDate(1, 23))).toBe(true);
        expect(isProductAvailable(product, localDate(2, 1))).toBe(true);
        expect(isProductAvailable(product, localDate(1, 1))).toBe(false);
        expect(isProductAvailable(product, localDate(1, 12))).toBe(false);
    });
});
