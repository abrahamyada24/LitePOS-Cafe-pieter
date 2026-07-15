import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch } from 'react-native';
import tw from 'twrnc';

type DiscountValues = {
    active: boolean;
    type: 'PERCENT' | 'NOMINAL';
    value: string;
    label: string;
    startAt: string;
    endAt: string;
    startTime: string;
    endTime: string;
    days: string;
};

export default function ProductDiscountFields({ values, onChange }: { values: DiscountValues; onChange: (next: DiscountValues) => void }) {
    const selectedDays = String(values.days || '').split(',').filter(Boolean).map(Number);
    const set = (key: keyof DiscountValues, value: any) => onChange({ ...values, [key]: value });
    const toggleDay = (day: number) => {
        const next = selectedDays.includes(day)
            ? selectedDays.filter(item => item !== day)
            : [...selectedDays, day].sort();
        set('days', next.join(','));
    };

    return (
        <View style={tw`bg-red-50 dark:bg-gray-900 border border-red-100 dark:border-gray-700 rounded-xl p-4 mb-4`}>
            <View style={tw`flex-row items-center justify-between`}>
                <View>
                    <Text style={tw`font-black text-gray-800 dark:text-gray-100 text-sm`}>Diskon Produk</Text>
                    <Text style={tw`text-[10px] text-gray-500 mt-0.5`}>Harga promo dan jadwal berlaku</Text>
                </View>
                <Switch value={values.active} onValueChange={value => set('active', value)} trackColor={{ false: '#d1d5db', true: '#fca5a5' }} thumbColor={values.active ? '#dc2626' : '#f3f4f6'} />
            </View>

            {values.active && (
                <View style={tw`mt-4`}>
                    <View style={tw`flex-row bg-white dark:bg-gray-800 rounded-lg p-1 border border-red-100 dark:border-gray-700 mb-3`}>
                        {(['PERCENT', 'NOMINAL'] as const).map(type => (
                            <TouchableOpacity key={type} onPress={() => set('type', type)} style={tw`flex-1 h-10 rounded-md items-center justify-center ${values.type === type ? 'bg-red-600' : ''}`}>
                                <Text style={tw`text-xs font-black ${values.type === type ? 'text-white' : 'text-gray-500'}`}>{type === 'PERCENT' ? 'Persen (%)' : 'Nominal (Rp)'}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TextInput value={values.value} onChangeText={text => set('value', text.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder={values.type === 'PERCENT' ? 'Contoh: 20' : 'Contoh: 5000'} style={tw`bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-800 dark:text-gray-100 mb-2`} />
                    <TextInput value={values.label} onChangeText={text => set('label', text)} placeholder="Nama promo / event" style={tw`bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-800 dark:text-gray-100 mb-2`} />

                    <View style={tw`flex-row gap-2`}>
                        <TextInput value={values.startAt} onChangeText={text => set('startAt', text)} placeholder="Mulai YYYY-MM-DD" autoCapitalize="none" style={tw`flex-1 bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-lg px-3 py-3 text-xs text-gray-800 dark:text-gray-100`} />
                        <TextInput value={values.endAt} onChangeText={text => set('endAt', text)} placeholder="Selesai YYYY-MM-DD" autoCapitalize="none" style={tw`flex-1 bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-lg px-3 py-3 text-xs text-gray-800 dark:text-gray-100`} />
                    </View>
                    <View style={tw`flex-row gap-2 mt-2`}>
                        <TextInput value={values.startTime} onChangeText={text => set('startTime', text)} placeholder="Jam mulai 07:00" keyboardType="numbers-and-punctuation" style={tw`flex-1 bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-lg px-3 py-3 text-xs text-gray-800 dark:text-gray-100`} />
                        <TextInput value={values.endTime} onChangeText={text => set('endTime', text)} placeholder="Jam selesai 09:00" keyboardType="numbers-and-punctuation" style={tw`flex-1 bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-lg px-3 py-3 text-xs text-gray-800 dark:text-gray-100`} />
                    </View>

                    <Text style={tw`text-[10px] font-black text-gray-500 uppercase mt-3 mb-2`}>Hari berlaku</Text>
                    <View style={tw`flex-row justify-between`}>
                        {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((label, day) => (
                            <TouchableOpacity key={`${label}-${day}`} onPress={() => toggleDay(day)} style={tw`w-9 h-9 rounded-lg items-center justify-center ${selectedDays.includes(day) ? 'bg-red-600' : 'bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700'}`}>
                                <Text style={tw`text-[10px] font-black ${selectedDays.includes(day) ? 'text-white' : 'text-gray-500'}`}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}
