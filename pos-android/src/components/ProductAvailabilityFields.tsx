import React from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import tw from 'twrnc';
import DatePickerDropdown from './DatePickerDropdown';

export type ProductAvailabilityValues = {
    active: boolean;
    scheduleEnabled: boolean;
    startTime: string;
    endTime: string;
    days: string;
};

const DEFAULT_DAYS = '0,1,2,3,4,5,6';

export const createProductAvailabilityValues = (product?: any): ProductAvailabilityValues => ({
    active: product?.isActive === undefined || product?.isActive === null
        ? true
        : product?.isActive === true || Number(product?.isActive) === 1,
    scheduleEnabled: product?.availabilityScheduleEnabled === true
        || Number(product?.availabilityScheduleEnabled) === 1,
    startTime: product?.availabilityStartTime || '00:00',
    endTime: product?.availabilityEndTime || '23:59',
    days: product?.availabilityDays || DEFAULT_DAYS,
});

export const validateProductAvailability = (values: ProductAvailabilityValues) => {
    if (!values.active || !values.scheduleEnabled) return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.startTime)
        || !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.endTime)) {
        return 'Pilih jam mulai dan jam selesai yang valid.';
    }
    if (!String(values.days || '').split(',').filter(Boolean).length) {
        return 'Pilih minimal satu hari aktif.';
    }
    return null;
};

export default function ProductAvailabilityFields({
    values,
    onChange,
}: {
    values: ProductAvailabilityValues;
    onChange: (next: ProductAvailabilityValues) => void;
}) {
    const selectedDays = String(values.days || '').split(',').filter(Boolean).map(Number);
    const set = (key: keyof ProductAvailabilityValues, value: any) => onChange({ ...values, [key]: value });
    const toggleDay = (day: number) => {
        const next = selectedDays.includes(day)
            ? selectedDays.filter(item => item !== day)
            : [...selectedDays, day].sort((left, right) => left - right);
        set('days', next.join(','));
    };

    return (
        <View style={tw`bg-emerald-50 dark:bg-gray-900 border border-emerald-100 dark:border-gray-700 rounded-xl p-4 mb-4`}>
            <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-1 mr-4`}>
                    <Text style={tw`font-black text-gray-900 dark:text-gray-100 text-sm`}>Produk Aktif</Text>
                    <Text style={tw`text-[10px] text-gray-600 dark:text-gray-400 mt-0.5`}>
                        Produk nonaktif tidak muncul di kasir
                    </Text>
                </View>
                <Switch
                    value={values.active}
                    onValueChange={value => set('active', value)}
                    trackColor={{ false: '#d1d5db', true: '#86efac' }}
                    thumbColor={values.active ? '#16a34a' : '#f3f4f6'}
                />
            </View>

            {values.active && (
                <View style={tw`mt-4 pt-4 border-t border-emerald-100 dark:border-gray-700`}>
                    <View style={tw`flex-row items-center justify-between`}>
                        <View style={tw`flex-1 mr-4`}>
                            <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-sm`}>Jadwal masa aktif</Text>
                            <Text style={tw`text-[10px] text-gray-500 dark:text-gray-400 mt-0.5`}>
                                Batasi produk pada hari dan jam tertentu
                            </Text>
                        </View>
                        <Switch
                            value={values.scheduleEnabled}
                            onValueChange={value => onChange({
                                ...values,
                                scheduleEnabled: value,
                                startTime: values.startTime || '00:00',
                                endTime: values.endTime || '23:59',
                                days: values.days || DEFAULT_DAYS,
                            })}
                            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                            thumbColor={values.scheduleEnabled ? '#2563eb' : '#f3f4f6'}
                        />
                    </View>

                    {values.scheduleEnabled && (
                        <View style={tw`mt-4`}>
                            <Text style={tw`text-[10px] font-black text-gray-500 dark:text-gray-300 uppercase mb-2`}>Jam tersedia</Text>
                            <View style={tw`flex-row gap-2 mb-4`}>
                                <View style={tw`flex-1`}>
                                    <Text style={tw`text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-1.5`}>Mulai</Text>
                                    <DatePickerDropdown
                                        value={values.startTime}
                                        onChange={value => set('startTime', value)}
                                        placeholder="Pilih jam"
                                        mode="time"
                                    />
                                </View>
                                <View style={tw`flex-1`}>
                                    <Text style={tw`text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-1.5`}>Selesai</Text>
                                    <DatePickerDropdown
                                        value={values.endTime}
                                        onChange={value => set('endTime', value)}
                                        placeholder="Pilih jam"
                                        mode="time"
                                    />
                                </View>
                            </View>

                            <Text style={tw`text-[10px] font-black text-gray-500 dark:text-gray-300 uppercase mb-2`}>Hari tersedia</Text>
                            <View style={tw`flex-row justify-between`}>
                                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((label, day) => (
                                    <TouchableOpacity
                                        key={label}
                                        onPress={() => toggleDay(day)}
                                        style={tw`w-9 h-9 rounded-lg items-center justify-center ${selectedDays.includes(day) ? 'bg-emerald-600' : 'bg-white dark:bg-gray-800 border border-emerald-100 dark:border-gray-700'}`}
                                    >
                                        <Text style={tw`text-[9px] font-black ${selectedDays.includes(day) ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={tw`text-[10px] text-gray-400 mt-3`}>
                                Jam melewati tengah malam didukung, misalnya 18:00–02:00.
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}
