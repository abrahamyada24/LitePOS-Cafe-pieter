import React from 'react';
import { Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import DatePickerDropdown from './DatePickerDropdown';

export type DiscountValues = {
    active: boolean;
    type: 'PERCENT' | 'NOMINAL';
    value: string;
    label: string;
    startAt: string;
    endAt: string;
    dateEnabled: boolean;
    startTime: string;
    endTime: string;
    timeEnabled: boolean;
    days: string;
    daysEnabled: boolean;
};

type PickerField = 'startAt' | 'endAt' | 'startTime' | 'endTime';

const pickerLabels: Record<PickerField, string> = {
    startAt: 'Tanggal mulai',
    endAt: 'Tanggal selesai',
    startTime: 'Jam mulai',
    endTime: 'Jam selesai',
};

export const createDiscountValues = (product?: any): DiscountValues => ({
    active: Number(product?.discountActive) === 1 || product?.discountActive === true,
    type: product?.discountType || 'PERCENT',
    value: (product?.discountValue || '').toString(),
    label: product?.discountLabel || '',
    startAt: product?.discountStartAt ? String(product.discountStartAt).slice(0, 10) : '',
    endAt: product?.discountEndAt ? String(product.discountEndAt).slice(0, 10) : '',
    dateEnabled: Boolean(product?.discountStartAt || product?.discountEndAt),
    startTime: product?.discountStartTime || '',
    endTime: product?.discountEndTime || '',
    timeEnabled: Boolean(product?.discountStartTime || product?.discountEndTime),
    days: product?.discountDays || '',
    daysEnabled: Boolean(product?.discountDays),
});

export const validateDiscountSchedule = (values: DiscountValues) => {
    if (!values.active) return null;
    if (values.dateEnabled && (!values.startAt || !values.endAt)) return 'Isi tanggal mulai dan tanggal selesai.';
    if (values.dateEnabled && values.endAt < values.startAt) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
    if (values.timeEnabled && (!values.startTime || !values.endTime)) return 'Isi jam mulai dan jam selesai.';
    if (values.daysEnabled && !String(values.days || '').split(',').filter(Boolean).length) return 'Pilih minimal satu hari untuk jadwal diskon.';
    return null;
};

export const getDiscountScheduleForSave = (values: DiscountValues) => ({
    startAt: values.dateEnabled ? values.startAt || null : null,
    endAt: values.dateEnabled ? values.endAt || null : null,
    startTime: values.timeEnabled ? values.startTime || null : null,
    endTime: values.timeEnabled ? values.endTime || null : null,
    days: values.daysEnabled ? values.days || null : null,
});

export default function ProductDiscountFields({ values, onChange }: { values: DiscountValues; onChange: (next: DiscountValues) => void }) {
    const [colorScheme] = useAppColorScheme(tw);
    const isDark = colorScheme === 'dark';
    const selectedDays = String(values.days || '').split(',').filter(Boolean).map(Number);
    const set = (key: keyof DiscountValues, value: any) => onChange({ ...values, [key]: value });

    const toggleDay = (day: number) => {
        const next = selectedDays.includes(day)
            ? selectedDays.filter(item => item !== day)
            : [...selectedDays, day].sort();
        set('days', next.join(','));
    };

    const renderPickerField = (field: PickerField, mode: 'date' | 'time', enabled: boolean) => (
        <View pointerEvents={enabled ? 'auto' : 'none'} style={[tw`flex-1`, { opacity: enabled ? 1 : 0.45 }]}>
            <View style={tw`flex-row items-center justify-between mb-1.5`}>
                <Text style={tw`text-[10px] font-bold text-gray-600 dark:text-gray-300`}>{pickerLabels[field]}</Text>
                {values[field] ? (
                    <TouchableOpacity onPress={() => set(field, '')} hitSlop={8}>
                        <Text style={tw`text-[9px] font-black text-red-500`}>Hapus</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            <DatePickerDropdown
                value={values[field]}
                onChange={value => set(field, value)}
                placeholder={mode === 'date' ? 'Pilih tanggal' : 'Pilih jam'}
                mode={mode}
            />
        </View>
    );

    const renderScheduleToggle = (key: 'dateEnabled' | 'timeEnabled' | 'daysEnabled', label: string) => {
        const checked = values[key];
        return (
            <TouchableOpacity onPress={() => set(key, !checked)} style={tw`flex-row items-center self-start mb-2`} activeOpacity={0.7}>
                <View style={tw`w-5 h-5 rounded border items-center justify-center mr-2 ${checked ? 'bg-red-600 border-red-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`}>
                    {checked ? <Text style={tw`text-white text-xs font-black`}>{'\u2713'}</Text> : null}
                </View>
                <Text style={tw`text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase`}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={tw`bg-red-50 dark:bg-gray-900 border border-red-100 dark:border-gray-700 rounded-xl p-4 mb-4`}>
            <View style={tw`flex-row items-center justify-between`}>
                <View>
                    <Text style={tw`font-black text-gray-900 dark:text-gray-100 text-sm`}>Diskon Produk</Text>
                    <Text style={tw`text-[10px] text-gray-600 dark:text-gray-400 mt-0.5`}>Harga promo dan jadwal berlaku</Text>
                </View>
                <Switch value={values.active} onValueChange={value => set('active', value)} trackColor={{ false: '#d1d5db', true: '#fca5a5' }} thumbColor={values.active ? '#dc2626' : '#f3f4f6'} />
            </View>

            {values.active && (
                <View style={tw`mt-4`}>
                    <View style={tw`flex-row bg-white dark:bg-gray-800 rounded-lg p-1 border border-red-100 dark:border-gray-700 mb-3`}>
                        {(['PERCENT', 'NOMINAL'] as const).map(type => (
                            <TouchableOpacity key={type} onPress={() => set('type', type)} style={tw`flex-1 h-10 rounded-md items-center justify-center ${values.type === type ? 'bg-red-600' : ''}`}>
                                <Text style={tw`text-xs font-black ${values.type === type ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{type === 'PERCENT' ? 'Persen (%)' : 'Nominal (Rp)'}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={tw`text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-1.5`}>Nilai diskon</Text>
                    <TextInput
                        value={values.value}
                        onChangeText={text => set('value', text.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder={values.type === 'PERCENT' ? 'Contoh: 20' : 'Contoh: 5000'}
                        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                        style={tw`bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 mb-2`}
                    />

                    <Text style={tw`text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-1.5 mt-1`}>Nama promo atau event</Text>
                    <TextInput
                        value={values.label}
                        onChangeText={text => set('label', text)}
                        placeholder="Contoh: Kopi Pagi"
                        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                        style={tw`bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 mb-3`}
                    />

                    {renderScheduleToggle('dateEnabled', 'Periode tanggal aktif')}
                    <View style={tw`flex-row gap-2`}>
                        {renderPickerField('startAt', 'date', values.dateEnabled)}
                        {renderPickerField('endAt', 'date', values.dateEnabled)}
                    </View>

                    <View style={tw`mt-3`}>
                        {renderScheduleToggle('timeEnabled', 'Jam berlaku aktif')}
                    </View>
                    <View style={tw`flex-row gap-2`}>
                        {renderPickerField('startTime', 'time', values.timeEnabled)}
                        {renderPickerField('endTime', 'time', values.timeEnabled)}
                    </View>

                    <View style={tw`mt-3`}>
                        {renderScheduleToggle('daysEnabled', 'Hari berlaku aktif')}
                    </View>
                    <View pointerEvents={values.daysEnabled ? 'auto' : 'none'} style={[tw`flex-row justify-between`, { opacity: values.daysEnabled ? 1 : 0.45 }]}>
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((label, day) => (
                            <TouchableOpacity key={label} onPress={() => toggleDay(day)} style={tw`w-9 h-9 rounded-lg items-center justify-center ${selectedDays.includes(day) ? 'bg-red-600' : 'bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700'}`}>
                                <Text style={tw`text-[9px] font-black ${selectedDays.includes(day) ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}
