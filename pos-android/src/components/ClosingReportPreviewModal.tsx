import React, { useRef, useState } from 'react';
import {
    Alert,
    Modal,
    PermissionsAndroid,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import tw from 'twrnc';

type ReportSummary = {
    bruto: number;
    returns: number;
    neto: number;
    count: number;
    cash: number;
    qris: number;
    transfer: number;
};

type Bestseller = {
    name: string;
    qty: number;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    onPrint: () => Promise<void>;
    storeName: string;
    storeAddress?: string;
    periodLabel: string;
    printedBy: string;
    summary: ReportSummary;
    bestsellers: Bestseller[];
    expenseTotal: number;
    showLitePosBranding?: boolean;
};

const formatRp = (value: number) => `Rp ${(Math.round(value) || 0).toLocaleString('id-ID')}`;

function Divider() {
    return <View style={tw`my-2 w-full border-t border-dashed border-gray-400`} />;
}

function ReportRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
    return (
        <View style={tw`mb-1 flex-row justify-between gap-3`}>
            <Text style={tw`flex-1 font-mono text-[10px] text-black ${bold ? 'font-bold' : ''}`}>{label}</Text>
            <Text style={tw`font-mono text-[10px] text-black ${bold ? 'font-bold' : ''}`}>{value}</Text>
        </View>
    );
}

function ActionButton({ icon, label, color = '#111827', onPress, disabled = false }: {
    icon: string;
    label: string;
    color?: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={tw`flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-2 py-3 ${disabled ? 'opacity-50' : ''}`}
        >
            <Icon name={icon} size={21} color={color} />
            <Text style={tw`mt-1 text-[10px] font-medium text-gray-800`}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function ClosingReportPreviewModal({
    visible,
    onClose,
    onPrint,
    storeName,
    storeAddress,
    periodLabel,
    printedBy,
    summary,
    bestsellers,
    expenseTotal,
    showLitePosBranding = true,
}: Props) {
    const receiptRef = useRef<any>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const totalItems = bestsellers.reduce((total, item) => total + Number(item.qty || 0), 0);

    const captureReceipt = async () => {
        if (!receiptRef.current?.capture) throw new Error('Preview struk belum siap.');
        return receiptRef.current.capture();
    };

    const downloadReceipt = async () => {
        try {
            if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
                const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
                if (permission !== PermissionsAndroid.RESULTS.GRANTED) return;
            }
            const source = await captureReceipt();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const target = `${RNFS.DownloadDirectoryPath}/Laporan-Penjualan-${timestamp}.png`;
            await RNFS.copyFile(source.replace('file://', ''), target);
            Alert.alert('Berhasil', `Struk laporan disimpan di folder Download.\n${target.split('/').pop()}`);
        } catch (error: any) {
            Alert.alert('Gagal', error?.message || 'Struk laporan tidak dapat disimpan.');
        }
    };

    const shareReceipt = async () => {
        try {
            const uri = await captureReceipt();
            await Share.open({
                title: 'Laporan Penjualan',
                message: `Laporan penjualan ${storeName} - ${periodLabel}`,
                url: uri,
            });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert('Gagal', 'Struk laporan tidak dapat dibagikan.');
            }
        }
    };

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            await onPrint();
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={tw`flex-1 items-center justify-center bg-black/70 p-4`}>
                <View style={[tw`w-full overflow-hidden rounded-3xl bg-gray-50`, { maxWidth: 430, maxHeight: '94%' }]}>
                    <View style={tw`flex-row items-center border-b border-gray-100 bg-white px-5 py-4`}>
                        <Text style={tw`flex-1 text-center text-base font-bold text-gray-900`}>Preview Laporan</Text>
                        <TouchableOpacity onPress={onClose} accessibilityLabel="Tutup preview laporan" style={tw`absolute right-4 rounded-full p-2`}>
                            <Icon name="close" size={21} color={tw.color('gray-500')} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={tw`items-center px-5 py-4`} showsVerticalScrollIndicator={false}>
                        <ViewShot
                            ref={receiptRef}
                            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
                            style={[tw`w-full bg-white`, { maxWidth: 330 }]}
                        >
                            <View style={tw`rounded-2xl border border-gray-200 bg-white px-5 py-5`} collapsable={false}>
                                <Text style={tw`text-center font-mono text-[13px] font-bold text-black`}>{storeName}</Text>
                                {!!storeAddress && <Text style={tw`mt-1 text-center font-mono text-[9px] text-black`}>{storeAddress}</Text>}
                                <Divider />
                                <Text style={tw`text-center font-mono text-[12px] font-bold text-black`}>LAPORAN PENJUALAN</Text>
                                <Text style={tw`mt-1 text-center font-mono text-[10px] font-bold text-black`}>{periodLabel}</Text>
                                <Divider />

                                <Text style={tw`mb-1 font-mono text-[10px] font-bold text-black`}>Periode:</Text>
                                <Text style={tw`font-mono text-[9px] text-black`}>{periodLabel}</Text>
                                <ReportRow label="Jumlah Transaksi" value={String(summary.count)} />
                                <ReportRow label="Jumlah Item" value={String(totalItems)} />
                                <Divider />

                                <Text style={tw`mb-2 font-mono text-[10px] font-bold text-black`}>PENJUALAN</Text>
                                <ReportRow label="Penjualan Bruto" value={formatRp(summary.bruto)} />
                                {summary.returns > 0 && <ReportRow label="Retur" value={`-${formatRp(summary.returns)}`} />}
                                <ReportRow label="Penjualan Neto" value={formatRp(summary.neto)} bold />
                                {expenseTotal > 0 && <ReportRow label="Pengeluaran" value={`-${formatRp(expenseTotal)}`} />}
                                <Divider />

                                <Text style={tw`mb-2 font-mono text-[10px] font-bold text-black`}>PEMBAYARAN</Text>
                                <ReportRow label="Tunai" value={formatRp(summary.cash)} />
                                <ReportRow label="QRIS" value={formatRp(summary.qris)} />
                                {summary.transfer > 0 && <ReportRow label="Transfer" value={formatRp(summary.transfer)} />}
                                <Divider />

                                <Text style={tw`mb-2 font-mono text-[10px] font-bold text-black`}>PRODUK TERLARIS</Text>
                                {bestsellers.slice(0, 6).map((item, index) => (
                                    <ReportRow key={`${item.name}-${index}`} label={`${index + 1}. ${item.name}`} value={String(item.qty)} bold={index === 0} />
                                ))}
                                {bestsellers.length === 0 && <Text style={tw`font-mono text-[9px] text-gray-500`}>Belum ada produk terjual</Text>}
                                <Divider />

                                <Text style={tw`text-center font-mono text-[9px] text-gray-500`}>AKHIR LAPORAN</Text>
                                <Text style={tw`mt-1 text-center font-mono text-[9px] text-gray-500`}>Dicetak oleh: {printedBy}</Text>
                                {showLitePosBranding && (
                                    <View style={tw`mt-4 border-t border-gray-100 pt-3`}>
                                        <Text style={tw`text-center font-mono text-[8px] text-gray-400`}>Powered by LitePOS</Text>
                                    </View>
                                )}
                            </View>
                        </ViewShot>
                    </ScrollView>

                    <View style={tw`border-t border-gray-100 bg-white p-4`}>
                        <View style={tw`mb-3 flex-row gap-3`}>
                            <ActionButton icon="download-outline" label="Unduh" onPress={downloadReceipt} />
                            <ActionButton icon="share-variant-outline" label="Bagikan" onPress={shareReceipt} />
                            <ActionButton icon="printer-outline" label={isPrinting ? 'Mencetak...' : 'Cetak'} onPress={handlePrint} disabled={isPrinting} />
                        </View>
                        <TouchableOpacity onPress={onClose} style={tw`items-center rounded-xl bg-gray-100 py-3.5`}>
                            <Text style={tw`font-medium text-gray-800`}>Selesai</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
