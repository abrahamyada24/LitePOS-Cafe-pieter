import React, { useState, useRef } from 'react';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, Linking } from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { RECEIPT_LOGO_BASE64 } from '../assets/receiptLogoBase64';
import RNFS from 'react-native-fs';
import { getPaidAmount, getPaymentStatusLabel, getPaymentStatusMessage, getRemainingAmount } from '../utils/preOrderPayment';
import { connectConfiguredPrinter } from '../utils/printerConnection';

// Logo LitePOS permanen - tidak perlu setting
const LITEPOS_LOGO = require('../assets/logo.png');

export default function ReceiptPreviewScreen({ route, navigation }: any) {
    useAppColorScheme(tw);
    const { receiptData } = route.params;
    const [isPrinting, setIsPrinting] = useState(false);
    const user = useStore(state => state.user);
    const settings = useStore(state => state.settings);
    const viewShotRef = useRef<any>(null);
    const logoShotRef = useRef<any>(null);

    const formatRp = (num: number) => 'Rp ' + (Math.round(num) || 0).toLocaleString('id-ID');
    const paymentStatusLabel = getPaymentStatusLabel(receiptData.paymentStatus);
    const paidAmount = getPaidAmount(receiptData);
    const remainingAmount = getRemainingAmount(receiptData);
    const paymentMethodLabel = receiptData.paymentMethod === 'PENDING' ? 'BELUM BAYAR' : receiptData.paymentMethod;

    const padEnd = (str: string, len: number) => {
        while (str.length < len) str += ' ';
        return str.substring(0, len);
    };

    const padStart = (str: string, len: number) => {
        while (str.length < len) str = ' ' + str;
        return str.substring(str.length - len);
    };

    const center = (str: string, len: number) => {
        const pad = Math.max(0, Math.floor((len - str.length) / 2));
        return ' '.repeat(pad) + str;
    };

    const wrapText = (text: string, width: number): string[] => {
        const result: string[] = [];
        // Split by explicit newlines first
        const paragraphs = text.split('\n');
        for (const paragraph of paragraphs) {
            if (paragraph.length <= width) {
                result.push(paragraph);
                continue;
            }
            const words = paragraph.split(' ');
            let currentLine = '';
            for (const word of words) {
                if (currentLine.length === 0) {
                    // Word longer than width: force break it
                    if (word.length > width) {
                        for (let i = 0; i < word.length; i += width) {
                            result.push(word.substring(i, i + width));
                        }
                    } else {
                        currentLine = word;
                    }
                } else if ((currentLine + ' ' + word).length <= width) {
                    currentLine += ' ' + word;
                } else {
                    result.push(currentLine);
                    if (word.length > width) {
                        for (let i = 0; i < word.length; i += width) {
                            result.push(word.substring(i, i + width));
                        }
                        currentLine = '';
                    } else {
                        currentLine = word;
                    }
                }
            }
            if (currentLine) result.push(currentLine);
        }
        return result;
    };

    const buildReceiptText = (): string => {
        const LINE = '--------------------------------\n';
        const WIDTH = 32;
        let text = '';

        // Header â€” store name and contact
        const storeName = settings.storeName || 'LitePOS';
        text += center(storeName, WIDTH) + '\n';
        if (settings.storeAddress) {
            const addressLines = wrapText(settings.storeAddress, WIDTH);
            for (const line of addressLines) {
                text += center(line, WIDTH) + '\n';
            }
        }
        if (settings.storePhone) {
            text += center(`Telp: ${settings.storePhone} `, WIDTH) + '\n';
        }
        text += LINE;

        text += `No: ${receiptData.invoiceNumber} \n`;
        text += `Kasir: ${user?.name || 'Kasir'} \n`;
        if (receiptData.customerName && receiptData.customerName !== 'Umum') {
            text += `Pelanggan: ${receiptData.customerName} \n`;
        }
        text += `${new Date(receiptData.createdAt).toLocaleString('id-ID')} \n`;
        if (receiptData.preOrderDate) {
            const dateStr = receiptData.preOrderDate.length >= 10 ? `${receiptData.preOrderDate.substring(8, 10)}-${receiptData.preOrderDate.substring(5, 7)}-${receiptData.preOrderDate.substring(0, 4)}${receiptData.preOrderDate.length === 16 ? ' ' + receiptData.preOrderDate.substring(11) : ''}` : receiptData.preOrderDate;
            text += `** AMBIL: ${dateStr} **\n`;
            text += `STATUS BAYAR: ${paymentStatusLabel}\n`;
        }

        // Order Type
        if (receiptData.orderType && settings.enableDineTable) {
            let orderLine = receiptData.orderType === 'DINE_IN' ? '=== DINE IN' : '=== TAKE AWAY';
            if (receiptData.orderType === 'DINE_IN' && receiptData.tableName) {
                orderLine += ` (Meja ${receiptData.tableName})`;
            }
            orderLine += ' ===';
            text += center(orderLine, WIDTH) + '\n';
        }

        text += LINE;

        // Items
        for (const item of receiptData.items) {
            const itemName = (item.name || 'Produk').substring(0, WIDTH);
            text += itemName + '\n';
            if (item.notes) text += `  * ${item.notes} \n`;
            const qtyPrice = `${item.quantity} x ${item.price.toLocaleString('id-ID')} `;
            const total = (item.quantity * item.price).toLocaleString('id-ID');
            const gap = WIDTH - qtyPrice.length - total.length;
            text += qtyPrice + ' '.repeat(Math.max(1, gap)) + total + '\n';
        }

        text += LINE;

        // Subtotal
        if (receiptData.discountAmount > 0) {
            const subStr = `Subtotal: Rp ${(receiptData.subtotal || receiptData.total + receiptData.discountAmount).toLocaleString('id-ID')} `;
            text += padStart(subStr, WIDTH) + '\n';
            const discStr = `Diskon: -Rp ${receiptData.discountAmount.toLocaleString('id-ID')} `;
            text += padStart(discStr, WIDTH) + '\n';
        }

        const totalStr = `TOTAL: Rp ${receiptData.total.toLocaleString('id-ID')} `;
        text += padStart(totalStr, WIDTH) + '\n';

        if (receiptData.paymentStatus === 'UNPAID') {
            const paidStr = `DIBAYAR: Rp 0 `;
            text += padStart(paidStr, WIDTH) + '\n';
        } else {
            const bayarLabel = `BAYAR(${paymentMethodLabel}): `;
            const bayarValue = `Rp ${(receiptData.cashAmount || paidAmount).toLocaleString('id-ID')} `;
            text += padEnd(bayarLabel, WIDTH - bayarValue.length) + bayarValue + '\n';

            if ((receiptData.changeAmount || 0) > 0) {
                const kembaliStr = `KEMBALI: Rp ${receiptData.changeAmount.toLocaleString('id-ID')} `;
                text += padStart(kembaliStr, WIDTH) + '\n';
            }
        }

        if (remainingAmount > 0) {
            const remainingStr = `SISA: Rp ${remainingAmount.toLocaleString('id-ID')} `;
            text += padStart(remainingStr, WIDTH) + '\n';
        }

        text += LINE;
        if (settings.receiptFooter) {
            const footerLines = wrapText(settings.receiptFooter, WIDTH);
            for (const line of footerLines) {
                text += center(line, WIDTH) + '\n';
            }
        } else {
            text += center('Terima Kasih!', WIDTH) + '\n';
        }
        text += center('Simpan struk ini sebagai bukti', WIDTH) + '\n\n\n';

        return text;
    };

    const getPrintableLogoBase64 = async (): Promise<string> => {
        if (settings.storeLogo && logoShotRef.current?.capture) {
            try {
                const uri = await logoShotRef.current.capture();
                return await RNFS.readFile(uri.replace('file://', ''), 'base64');
            } catch (logoErr) {
                console.log('Logo capture failed, using default logo:', logoErr);
            }
        }

        return RECEIPT_LOGO_BASE64;
    };

    const shareReceiptWA = async () => {
        try {
            // Capture image
            const uri = await viewShotRef.current.capture();
            
            let phone = '';
            if (receiptData.customerPhone) {
                phone = receiptData.customerPhone.replace(/[^0-9]/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
            }

            const shareOptions: any = {
                title: 'Struk Transaksi',
                message: `Struk Transaksi ${settings.storeName || 'LitePOS'}\nNo: ${receiptData.invoiceNumber}\n${getPaymentStatusMessage(receiptData, formatRp)}`,
                url: uri,
            };

            // If we have a phone number, use shareSingle for WhatsApp
            if (phone) {
                shareOptions.social = Share.Social.WHATSAPP;
                shareOptions.whatsAppNumber = phone;
                try {
                    await Share.shareSingle(shareOptions);
                    return;
                } catch (singleError: any) {
                    console.log('shareSingle error:', singleError);
                }
            }
            
            // Fallback: Just open the share sheet
            await Share.open({
                title: 'Struk Transaksi',
                url: uri,
                message: shareOptions.message
            });

        } catch (error: any) {
            console.log('Share error:', error);
            if (error.message !== 'User did not share') {
                Alert.alert('Gagal', 'Tidak dapat membagikan gambar struk.');
            }
        }
    };

    const printReceipt = async () => {
        if (!settings.printerAddress || !settings.printerType) {
            Alert.alert('Info', 'Belum ada printer yang dikonfigurasi.\nMasuk ke menu Pengaturan untuk mengatur printer.');
            return;
        }

        setIsPrinting(true);
        try {
            const printerClass = await connectConfiguredPrinter(settings);

            if (settings.showLogoOnReceipt === true || String(settings.showLogoOnReceipt) === 'true') {
                try {
                    const logoToPrint = await getPrintableLogoBase64();
                    await printerClass.printImageBase64(logoToPrint, { imageWidth: 180 });
                    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
                } catch (logoErr) {
                    console.log('Logo print failed:', logoErr);
                }
            }
            await printerClass.printText(buildReceiptText());
        } catch (e: any) {
            Alert.alert('Gagal Mencetak', e?.message || 'Error saat mencetak. Pastikan printer menyala dan tersambung.');
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <View style={tw`flex-1 bg-gray-300 dark:bg-gray-900`}>
            {/* Header */}
            <View style={tw`bg-white dark:bg-gray-800 px-4 py-4 flex-row items-center shadow-sm z-10`}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`mr-3`}>
                    <Icon name="arrow-left" size={24} color={tw.color('gray-600')} />
                </TouchableOpacity>
                <Text style={tw`text-xl font-bold text-gray-800 dark:text-gray-100 flex-1`}>Printer dan Struk</Text>
            </View>

            {settings.storeLogo && settings.showLogoOnReceipt !== false ? (
                <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: -10000, width: 220, height: 120 }}>
                    <ViewShot
                        ref={logoShotRef}
                        options={{ format: 'jpg', quality: 0.95 }}
                        style={{
                            width: 220,
                            height: 120,
                            padding: 10,
                            backgroundColor: '#FFFFFF',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Image
                            source={{ uri: settings.storeLogo }}
                            style={{ width: 200, height: 100 }}
                            resizeMode="contain"
                        />
                    </ViewShot>
                </View>
            ) : null}

            <ScrollView contentContainerStyle={tw`p-2 items-center`} showsVerticalScrollIndicator={false}>
                
                {/* The Paper Receipt inside ViewShot */}
                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={tw`bg-white w-full max-w-[380px] shadow-md mb-8`}>
                    <View style={tw`p-5 bg-white`}>
                        {/* Logo */}
                        {settings.storeLogo && settings.showLogoOnReceipt !== false ? (
                            <View style={tw`items-center mb-4`}>
                                <Image 
                                    source={{ uri: settings.storeLogo }} 
                                    style={{ width: 120, height: 72, backgroundColor: '#FFFFFF' }}
                                    resizeMode="contain"
                                />
                            </View>
                        ) : null}
                        
                        <Text style={tw`text-center font-mono text-xs font-bold text-black mb-1`}>{settings.storeName || 'LITEPOS'}</Text>
                        {settings.storeAddress ? <Text style={tw`text-center font-mono text-[10px] text-black`}>{settings.storeAddress}</Text> : null}
                        {settings.storePhone ? <Text style={tw`text-center font-mono text-[10px] text-black mb-2`}>{settings.storePhone}</Text> : null}
                        
                        <View style={tw`w-full border-t border-dashed border-gray-400 my-2`} />
                        
                        <View style={tw`flex-row justify-between mb-1`}>
                            <View>
                                <Text style={tw`font-mono text-[10px] text-black`}>{new Date(receiptData.createdAt).toLocaleString('id-ID')}</Text>
                                <Text style={tw`font-mono text-[10px] text-black`}>{receiptData.invoiceNumber}</Text>
                                {receiptData.customerName && receiptData.customerName !== 'Umum' ? (
                                    <Text style={tw`font-mono text-[10px] text-black`}>Pelanggan: {receiptData.customerName}</Text>
                                ) : null}
                            </View>
                            <View>
                                <Text style={tw`font-mono text-[10px] text-black text-right`}>{user?.name || 'Kasir'}</Text>
                            </View>
                        </View>

                        {receiptData.preOrderDate ? (
                            <>
                                <Text style={tw`text-center font-mono text-[11px] font-bold text-black mt-2`}>
                                    ** AMBIL: {receiptData.preOrderDate.length >= 10 ? `${receiptData.preOrderDate.substring(8, 10)}-${receiptData.preOrderDate.substring(5, 7)}-${receiptData.preOrderDate.substring(0, 4)}${receiptData.preOrderDate.length === 16 ? ' ' + receiptData.preOrderDate.substring(11) : ''}` : receiptData.preOrderDate} **
                                </Text>
                                <Text style={tw`text-center font-mono text-[10px] font-bold text-black mt-1`}>
                                    STATUS BAYAR: {paymentStatusLabel}
                                </Text>
                            </>
                        ) : null}

                        {receiptData.orderType && settings.enableDineTable ? (
                            <Text style={tw`text-center font-mono text-[11px] font-bold text-black ${receiptData.preOrderDate ? 'mt-1' : 'mt-2'}`}>
                                === {receiptData.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'}{receiptData.orderType === 'DINE_IN' && receiptData.tableName ? ` (Meja ${receiptData.tableName})` : ''} ===
                            </Text>
                        ) : null}

                        <View style={tw`w-full border-t border-dashed border-gray-400 my-2`} />

                        {receiptData.items.map((item: any, idx: number) => (
                            <View key={idx} style={tw`mb-2`}>
                                <Text style={tw`font-mono text-[11px] text-black`} numberOfLines={2}>{item.name}</Text>
                                <View style={tw`flex-row justify-between`}>
                                    <Text style={tw`font-mono text-[11px] text-black`}>{item.quantity} x {item.price.toLocaleString('id-ID')}</Text>
                                    <Text style={tw`font-mono text-[11px] text-black`}>{(item.price * item.quantity).toLocaleString('id-ID')}</Text>
                                </View>
                                {item.notes ? (
                                    <Text style={tw`font-mono text-[10px] text-gray-600`}>* {item.notes}</Text>
                                ) : null}
                            </View>
                        ))}

                        <View style={tw`w-full border-t border-dashed border-gray-400 my-2`} />

                        {receiptData.discountAmount > 0 && (
                            <>
                                <View style={tw`flex-row justify-between mb-1`}>
                                    <Text style={tw`font-mono text-[11px] text-black`}>Subtotal</Text>
                                    <Text style={tw`font-mono text-[11px] text-black`}>{(receiptData.subtotal || receiptData.total + receiptData.discountAmount).toLocaleString('id-ID')}</Text>
                                </View>
                                <View style={tw`flex-row justify-between mb-1`}>
                                    <Text style={tw`font-mono text-[11px] text-black`}>Diskon</Text>
                                    <Text style={tw`font-mono text-[11px] text-black`}>-{receiptData.discountAmount.toLocaleString('id-ID')}</Text>
                                </View>
                            </>
                        )}

                        <View style={tw`flex-row justify-between mt-1 mb-1`}>
                            <Text style={tw`font-mono text-[12px] font-bold text-black`}>Total</Text>
                            <Text style={tw`font-mono text-[12px] font-bold text-black`}>{receiptData.total.toLocaleString('id-ID')}</Text>
                        </View>
                        {receiptData.paymentStatus === 'UNPAID' ? (
                            <View style={tw`flex-row justify-between mb-1`}>
                                <Text style={tw`font-mono text-[11px] text-black`}>Dibayar</Text>
                                <Text style={tw`font-mono text-[11px] text-black`}>0</Text>
                            </View>
                        ) : (
                            <>
                                <View style={tw`flex-row justify-between mb-1`}>
                                    <Text style={tw`font-mono text-[11px] text-black`}>Bayar ({paymentMethodLabel})</Text>
                                    <Text style={tw`font-mono text-[11px] text-black`}>{(receiptData.cashAmount || paidAmount).toLocaleString('id-ID')}</Text>
                                </View>
                                {(receiptData.changeAmount || 0) > 0 ? (
                                    <View style={tw`flex-row justify-between`}>
                                        <Text style={tw`font-mono text-[11px] text-black`}>Kembali</Text>
                                        <Text style={tw`font-mono text-[11px] text-black`}>{receiptData.changeAmount.toLocaleString('id-ID')}</Text>
                                    </View>
                                ) : null}
                            </>
                        )}
                        {remainingAmount > 0 ? (
                            <View style={tw`flex-row justify-between mt-1`}>
                                <Text style={tw`font-mono text-[11px] font-bold text-black`}>Sisa</Text>
                                <Text style={tw`font-mono text-[11px] font-bold text-black`}>{remainingAmount.toLocaleString('id-ID')}</Text>
                            </View>
                        ) : null}

                        <View style={tw`w-full border-t border-dashed border-gray-400 my-4`} />
                        
                        <Text style={tw`text-center font-mono text-[10px] text-black`}>
                            {settings.receiptFooter || 'Terima Kasih!'}
                        </Text>
                        <Text style={tw`text-center font-mono text-[10px] text-black mt-1`}>Powered by LitePOS</Text>
                        
                    </View>
                </ViewShot>

                {/* Bottom Actions Container */}
                <View style={tw`w-full max-w-[380px] mb-8`}>
                    {!settings.printerAddress && (
                        <View style={tw`flex-row items-center justify-center mb-4 bg-orange-100 py-2.5 rounded border border-orange-200`}>
                            <Icon name="alert" size={14} color={tw.color('orange-600')} style={tw`mr-2`} />
                            <Text style={tw`text-orange-700 text-[11px] font-bold`}>Printer thermal belum diatur</Text>
                        </View>
                    )}

                    <View style={tw`flex-row gap-2 mb-3`}>
                        <TouchableOpacity
                            style={tw`flex-1 py-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded items-center shadow-sm`}
                            onPress={() => navigation.navigate('Main', { screen: 'Beranda' })}
                        >
                            <Text style={tw`font-bold text-gray-700 dark:text-gray-200 text-sm`}>Beranda</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={tw`flex-1 py-4 bg-green-600 rounded items-center flex-row justify-center shadow-sm`}
                            onPress={shareReceiptWA}
                        >
                            <Icon name="whatsapp" size={18} color="white" style={tw`mr-1.5`} />
                            <Text style={tw`font-bold text-white text-sm`}>Kirim WA</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={tw`flex-1 py-4 bg-blue-600 rounded items-center flex-row justify-center shadow-sm ${isPrinting || !settings.printerAddress ? 'opacity-50' : ''}`}
                            onPress={printReceipt}
                            disabled={isPrinting || !settings.printerAddress}
                        >
                            <Icon name="printer" size={18} color="white" style={tw`mr-1.5`} />
                            <Text style={tw`font-bold text-white text-sm`}>{isPrinting ? 'Cetak...' : 'Struk'}</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={tw`py-4 bg-gray-900 dark:bg-gray-700 rounded items-center shadow-sm`}
                        onPress={() => navigation.navigate('POS')}
                    >
                        <Text style={tw`font-bold text-white text-sm`}>Transaksi Baru</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}
