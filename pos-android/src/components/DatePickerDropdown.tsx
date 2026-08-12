/**
 * DatePickerDropdown — modern calendar-grid date picker
 * Format tampil: dd-MM-yyyy  |  Stored internally: yyyy-MM-dd (or yyyy-MM-dd HH:mm)
 *
 * Step 1 – Calendar grid with month/year navigation
 * Step 2 – Time picker with ▲/▼ (only when withTime=true)
 */
import React, { useMemo } from 'react';
import {
    View, Text, TouchableOpacity, Modal,
    useWindowDimensions, ScrollView,
} from 'react-native';
import tw from 'twrnc';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// ── helpers ──────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

const MONTHS_FULL = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate(); // month is 0-based here

/** Get the day-of-week for the 1st of the month (0=Mon … 6=Sun) */
const getStartDow = (year: number, month: number) => {
    const d = new Date(year, month, 1).getDay(); // 0=Sun
    return d === 0 ? 6 : d - 1; // shift to Mon-based
};

const parseISO = (iso: string, timeOnly = false) => {
    if (timeOnly && /^\d{2}:\d{2}$/.test(iso)) {
        const now = new Date();
        return {
            d: now.getDate(),
            m: now.getMonth(),
            y: now.getFullYear(),
            h: parseInt(iso.substring(0, 2), 10),
            min: parseInt(iso.substring(3, 5), 10),
        };
    }
    if (!iso || iso.length < 10) {
        const now = new Date();
        return {
            d: now.getDate(),
            m: now.getMonth(),     // 0-based
            y: now.getFullYear(),
            h: now.getHours(),
            min: Math.floor(now.getMinutes() / 5) * 5,
        };
    }
    return {
        d: parseInt(iso.substring(8, 10), 10),
        m: parseInt(iso.substring(5, 7), 10) - 1,  // convert to 0-based
        y: parseInt(iso.substring(0, 4), 10),
        h: iso.length >= 16 && iso.includes(' ') ? parseInt(iso.substring(11, 13), 10) : new Date().getHours(),
        min: iso.length >= 16 && iso.includes(' ') ? parseInt(iso.substring(14, 16), 10) : Math.floor(new Date().getMinutes() / 5) * 5,
    };
};

const isSameDay = (d1: number, m1: number, y1: number, d2: number, m2: number, y2: number) =>
    d1 === d2 && m1 === m2 && y1 === y2;

// ── Types ────────────────────────────────────────────────────────
interface Props {
    value: string;       // yyyy-MM-dd or yyyy-MM-dd HH:mm
    onChange: (v: string) => void;
    placeholder?: string;
    label?: string;
    withTime?: boolean;
    mode?: 'date' | 'time' | 'datetime';
}

// ── Calendar Grid Cell ───────────────────────────────────────────
interface CalendarDay {
    day: number;
    month: number;   // 0-based
    year: number;
    isCurrentMonth: boolean;
}

// ── Main Component ───────────────────────────────────────────────
export default function DatePickerDropdown({
    value,
    onChange,
    placeholder = 'Pilih tanggal',
    label,
    withTime,
    mode,
}: Props) {
    const { width: sw } = useWindowDimensions();
    const pickerMode = mode || (withTime ? 'datetime' : 'date');

    // Modal state
    const [open, setOpen] = React.useState(false);
    const [step, setStep] = React.useState<1 | 2>(1); // 1=calendar, 2=time

    // Calendar view month/year (for navigation, independent of selection)
    const [viewMonth, setViewMonth] = React.useState(new Date().getMonth());
    const [viewYear, setViewYear] = React.useState(new Date().getFullYear());

    // Selected date/time (temp until confirmed)
    const [selDay, setSelDay] = React.useState(new Date().getDate());
    const [selMonth, setSelMonth] = React.useState(new Date().getMonth());
    const [selYear, setSelYear] = React.useState(new Date().getFullYear());
    const [selHour, setSelHour] = React.useState(new Date().getHours());
    const [selMin, setSelMin] = React.useState(0);

    // Today
    const today = useMemo(() => {
        const n = new Date();
        return { d: n.getDate(), m: n.getMonth(), y: n.getFullYear() };
    }, []);

    // ── Open modal ───────────────────────────────────────────────
    const openModal = () => {
        const { d, m, y, h, min } = parseISO(value, pickerMode === 'time');
        setSelDay(d);
        setSelMonth(m);
        setSelYear(y);
        setSelHour(h);
        setSelMin(min);
        setViewMonth(m);
        setViewYear(y);
        setStep(pickerMode === 'time' ? 2 : 1);
        setOpen(true);
    };

    // ── Confirm ──────────────────────────────────────────────────
    const confirm = () => {
        if (pickerMode === 'time') {
            onChange(`${pad(selHour)}:${pad(selMin)}`);
            setOpen(false);
            return;
        }
        const maxDay = getDaysInMonth(selYear, selMonth);
        const safeDay = Math.min(selDay, maxDay);
        const dateStr = `${selYear}-${pad(selMonth + 1)}-${pad(safeDay)}`;
        if (pickerMode === 'datetime') {
            onChange(`${dateStr} ${pad(selHour)}:${pad(selMin)}`);
        } else {
            onChange(dateStr);
        }
        setOpen(false);
    };

    // ── Month navigation ─────────────────────────────────────────
    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };
    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(viewYear + 1);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    // ── Build calendar grid ──────────────────────────────────────
    const calendarDays = useMemo((): CalendarDay[] => {
        const result: CalendarDay[] = [];
        const startDow = getStartDow(viewYear, viewMonth);
        const daysInCurr = getDaysInMonth(viewYear, viewMonth);

        // Previous month fill
        const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
        const daysInPrev = getDaysInMonth(prevY, prevM);
        for (let i = startDow - 1; i >= 0; i--) {
            result.push({ day: daysInPrev - i, month: prevM, year: prevY, isCurrentMonth: false });
        }

        // Current month
        for (let d = 1; d <= daysInCurr; d++) {
            result.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true });
        }

        // Next month fill (complete to 6 rows × 7 = 42 cells, or at least full last row)
        const remaining = 42 - result.length;
        const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
        for (let d = 1; d <= remaining; d++) {
            result.push({ day: d, month: nextM, year: nextY, isCurrentMonth: false });
        }

        return result;
    }, [viewMonth, viewYear]);

    // ── Select a day on the grid ─────────────────────────────────
    const selectDay = (cell: CalendarDay) => {
        setSelDay(cell.day);
        setSelMonth(cell.month);
        setSelYear(cell.year);
        // If user tapped a day from prev/next month, navigate there
        if (!cell.isCurrentMonth) {
            setViewMonth(cell.month);
            setViewYear(cell.year);
        }
    };

    // ── "Hari Ini" shortcut ──────────────────────────────────────
    const goToday = () => {
        setSelDay(today.d);
        setSelMonth(today.m);
        setSelYear(today.y);
        setViewMonth(today.m);
        setViewYear(today.y);
    };

    // ── Time helpers ─────────────────────────────────────────────
    const incHour = () => setSelHour(h => (h + 1) % 24);
    const decHour = () => setSelHour(h => (h - 1 + 24) % 24);
    const incMin = () => setSelMin(m => (m + 5) % 60);
    const decMin = () => setSelMin(m => (m - 5 + 60) % 60);
    const setNow = () => {
        const n = new Date();
        setSelHour(n.getHours());
        setSelMin(Math.floor(n.getMinutes() / 5) * 5);
    };

    // ── Display text (trigger button) ────────────────────────────
    let displayText = placeholder;
    if (pickerMode === 'time' && /^\d{2}:\d{2}$/.test(value)) {
        displayText = value;
    } else if (value && value.length >= 10) {
        const { d, m, y, h, min } = parseISO(value);
        if (pickerMode === 'datetime' && value.length >= 15) {
            displayText = `${pad(d)}-${pad(m + 1)}-${y} ${pad(h)}:${pad(min)}`;
        } else {
            displayText = `${pad(d)}-${pad(m + 1)}-${y}`;
        }
    }

    const CELL_SIZE = 40;
    const modalW = Math.min(sw - 32, 360);

    // ── Render ───────────────────────────────────────────────────
    return (
        <>
            {label && (
                <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>{label}</Text>
            )}

            {/* Trigger Button */}
            <TouchableOpacity
                onPress={openModal}
                style={tw`flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3`}
                activeOpacity={0.8}
            >
                <Icon name={pickerMode === 'time' ? 'clock-outline' : 'calendar'} size={18} color={tw.color('gray-500')} style={tw`mr-2`} />
                <Text style={tw`flex-1 font-bold ${value ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`} numberOfLines={1}>
                    {displayText}
                </Text>
                <Text style={tw`text-gray-400 text-xs`}>▼</Text>
            </TouchableOpacity>

            {/* Modal */}
            <Modal visible={open} transparent animationType="fade">
                <TouchableOpacity
                    style={tw`flex-1 bg-black/50 justify-center items-center`}
                    activeOpacity={1}
                    onPress={() => setOpen(false)}
                >
                    <View
                        onStartShouldSetResponder={() => true}
                        onTouchEnd={(e) => e.stopPropagation()}
                        style={[
                            tw`bg-white dark:bg-gray-800 rounded-2xl overflow-hidden`,
                            {
                                width: modalW,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 12 },
                                shadowOpacity: 0.15,
                                shadowRadius: 24,
                                elevation: 20,
                            },
                        ]}
                    >
                        {step === 1 ? (
                            /* ═══════════════════════════════════════════
                               STEP 1 — Calendar Grid
                               ═══════════════════════════════════════════ */
                            <>
                                {/* Month/Year Header with navigation */}
                                <View style={tw`flex-row items-center justify-between px-4 pt-5 pb-3`}>
                                    <TouchableOpacity
                                        onPress={prevMonth}
                                        style={tw`w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center`}
                                        activeOpacity={0.6}
                                    >
                                        <Icon name="chevron-left" size={22} color={tw.color('gray-600 dark:gray-300')} />
                                    </TouchableOpacity>

                                    <Text style={tw`text-base font-black text-gray-800 dark:text-gray-100`}>
                                        {MONTHS_FULL[viewMonth]} {viewYear}
                                    </Text>

                                    <TouchableOpacity
                                        onPress={nextMonth}
                                        style={tw`w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center`}
                                        activeOpacity={0.6}
                                    >
                                        <Icon name="chevron-right" size={22} color={tw.color('gray-600 dark:gray-300')} />
                                    </TouchableOpacity>
                                </View>

                                {/* Day-of-week headers */}
                                <View style={tw`flex-row px-3 mb-1`}>
                                    {DAY_LABELS.map((d, i) => (
                                        <View key={i} style={[tw`items-center`, { width: `${100 / 7}%` as any }]}>
                                            <Text style={tw`text-[11px] font-bold ${i >= 5 ? 'text-red-400' : 'text-gray-400'} uppercase`}>
                                                {d}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Calendar Grid */}
                                <ScrollView
                                    style={{ maxHeight: CELL_SIZE * 6 + 12 }}
                                    scrollEnabled={false}
                                    contentContainerStyle={tw`px-3 pb-1`}
                                >
                                    <View style={tw`flex-row flex-wrap`}>
                                        {calendarDays.map((cell, idx) => {
                                            const isSelected = isSameDay(cell.day, cell.month, cell.year, selDay, selMonth, selYear);
                                            const isToday = isSameDay(cell.day, cell.month, cell.year, today.d, today.m, today.y);
                                            const isWeekend = idx % 7 >= 5;

                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    onPress={() => selectDay(cell)}
                                                    activeOpacity={0.5}
                                                    style={[
                                                        tw`items-center justify-center`,
                                                        {
                                                            width: `${100 / 7}%` as any,
                                                            height: CELL_SIZE,
                                                        },
                                                    ]}
                                                >
                                                    <View
                                                        style={[
                                                            tw`w-9 h-9 rounded-full items-center justify-center`,
                                                            isSelected && tw`bg-blue-600`,
                                                            !isSelected && isToday && tw`border-2 border-blue-400`,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                tw`text-sm`,
                                                                isSelected
                                                                    ? tw`text-white font-black`
                                                                    : !cell.isCurrentMonth
                                                                        ? tw`text-gray-300 dark:text-gray-600 font-medium`
                                                                        : isWeekend
                                                                            ? tw`text-red-400 font-semibold`
                                                                            : tw`text-gray-700 dark:text-gray-200 font-semibold`,
                                                            ]}
                                                        >
                                                            {cell.day}
                                                        </Text>
                                                    </View>
                                                    {/* Today dot */}
                                                    {isToday && !isSelected && (
                                                        <View style={tw`w-1 h-1 rounded-full bg-blue-500 mt-0.5 absolute bottom-0`} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>

                                {/* "Hari Ini" shortcut */}
                                <View style={tw`items-center pb-2 pt-1`}>
                                    <TouchableOpacity onPress={goToday} activeOpacity={0.6}>
                                        <Text style={tw`text-blue-600 font-bold text-xs`}>
                                            ● Hari Ini
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Separator */}
                                <View style={tw`h-px bg-gray-100 dark:bg-gray-700 mx-4`} />

                                {/* Footer */}
                                <View style={tw`flex-row px-4 py-3 gap-3`}>
                                    <TouchableOpacity
                                        style={tw`flex-1 py-3 border border-gray-200 dark:border-gray-600 rounded-xl items-center`}
                                        onPress={() => setOpen(false)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={tw`font-bold text-gray-500 dark:text-gray-300`}>Batal</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={tw`flex-1 py-3 bg-blue-600 rounded-xl items-center flex-row justify-center`}
                                        onPress={() => {
                                            if (pickerMode === 'datetime') {
                                                setStep(2);
                                            } else {
                                                confirm();
                                            }
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={tw`font-bold text-white`}>
                                            {pickerMode === 'datetime' ? 'Selanjutnya' : 'Pilih Tanggal'}
                                        </Text>
                                        {pickerMode === 'datetime' && (
                                            <Icon name="arrow-right" size={16} color="#fff" style={tw`ml-1`} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            /* ═══════════════════════════════════════════
                               STEP 2 — Time Picker
                               ═══════════════════════════════════════════ */
                            <>
                                {pickerMode === 'datetime' ? (
                                    <>
                                        {/* Selected Date Display */}
                                        <View style={tw`items-center pt-5 pb-3`}>
                                            <Text style={tw`text-xs font-bold text-gray-400 uppercase tracking-wider mb-1`}>
                                                Tanggal Dipilih
                                            </Text>
                                            <Text style={tw`text-base font-black text-gray-800 dark:text-gray-100`}>
                                                {pad(selDay)}-{pad(selMonth + 1)}-{selYear}
                                            </Text>
                                        </View>

                                        {/* Separator */}
                                        <View style={tw`h-px bg-gray-100 dark:bg-gray-700 mx-4`} />
                                    </>
                                ) : null}

                                {/* Time Label */}
                                <View style={tw`items-center pt-4 pb-2`}>
                                    <Text style={tw`text-sm font-bold text-gray-500`}>
                                        Pilih Waktu
                                    </Text>
                                </View>

                                {/* Hour : Minute picker */}
                                <View style={tw`flex-row items-center justify-center py-4 px-8`}>
                                    {/* Hour Column */}
                                    <View style={tw`items-center`}>
                                        <TouchableOpacity
                                            onPress={incHour}
                                            style={tw`w-16 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 items-center justify-center mb-2`}
                                            activeOpacity={0.5}
                                        >
                                            <Icon name="chevron-up" size={28} color={tw.color('gray-500')} />
                                        </TouchableOpacity>
                                        <View style={tw`w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 items-center justify-center`}>
                                            <Text style={tw`text-4xl font-black text-blue-600`}>
                                                {pad(selHour)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={decHour}
                                            style={tw`w-16 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 items-center justify-center mt-2`}
                                            activeOpacity={0.5}
                                        >
                                            <Icon name="chevron-down" size={28} color={tw.color('gray-500')} />
                                        </TouchableOpacity>
                                        <Text style={tw`text-[10px] font-bold text-gray-400 mt-2 uppercase`}>Jam</Text>
                                    </View>

                                    {/* Colon */}
                                    <View style={tw`mx-4 items-center`}>
                                        <Text style={tw`text-4xl font-black text-gray-300`}>:</Text>
                                    </View>

                                    {/* Minute Column */}
                                    <View style={tw`items-center`}>
                                        <TouchableOpacity
                                            onPress={incMin}
                                            style={tw`w-16 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 items-center justify-center mb-2`}
                                            activeOpacity={0.5}
                                        >
                                            <Icon name="chevron-up" size={28} color={tw.color('gray-500')} />
                                        </TouchableOpacity>
                                        <View style={tw`w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 items-center justify-center`}>
                                            <Text style={tw`text-4xl font-black text-blue-600`}>
                                                {pad(selMin)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={decMin}
                                            style={tw`w-16 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 items-center justify-center mt-2`}
                                            activeOpacity={0.5}
                                        >
                                            <Icon name="chevron-down" size={28} color={tw.color('gray-500')} />
                                        </TouchableOpacity>
                                        <Text style={tw`text-[10px] font-bold text-gray-400 mt-2 uppercase`}>Menit</Text>
                                    </View>
                                </View>

                                {/* "Sekarang" shortcut */}
                                <View style={tw`items-center pb-3`}>
                                    <TouchableOpacity
                                        onPress={setNow}
                                        activeOpacity={0.6}
                                        style={tw`flex-row items-center bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full`}
                                    >
                                        <Icon name="clock-outline" size={14} color={tw.color('blue-600')} style={tw`mr-1.5`} />
                                        <Text style={tw`text-blue-600 font-bold text-xs`}>
                                            Sekarang
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Separator */}
                                <View style={tw`h-px bg-gray-100 dark:bg-gray-700 mx-4`} />

                                {/* Footer */}
                                <View style={tw`flex-row px-4 py-3 gap-3`}>
                                    <TouchableOpacity
                                        style={tw`flex-1 py-3 border border-gray-200 dark:border-gray-600 rounded-xl items-center flex-row justify-center`}
                                        onPress={() => pickerMode === 'datetime' ? setStep(1) : setOpen(false)}
                                        activeOpacity={0.7}
                                    >
                                        {pickerMode === 'datetime' ? <Icon name="arrow-left" size={16} color={tw.color('gray-500')} style={tw`mr-1`} /> : null}
                                        <Text style={tw`font-bold text-gray-500 dark:text-gray-300`}>{pickerMode === 'datetime' ? 'Kembali' : 'Batal'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={tw`flex-1 py-3 bg-blue-600 rounded-xl items-center flex-row justify-center`}
                                        onPress={confirm}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={tw`font-bold text-white`}>Pilih</Text>
                                        <Icon name="check" size={16} color="#fff" style={tw`ml-1`} />
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}
