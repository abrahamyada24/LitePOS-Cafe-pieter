import React, { useState, useRef } from 'react';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, PermissionsAndroid, Platform } from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { RECEIPT_LOGO_BASE64 } from '../assets/receiptLogoBase64';
import RNFS from 'react-native-fs';
import { getPaidAmount, getPaymentStatusLabel, getPaymentStatusMessage, getRemainingAmount } from '../utils/preOrderPayment';
import { connectConfiguredPrinter } from '../utils/printerConnection';
import { printKitchenTicket } from '../utils/kitchenPrinter';
import {
    getReceiptLogoPrintOptions,
    RECEIPT_LOGO_CAPTURE_HEIGHT,
    RECEIPT_LOGO_CAPTURE_WIDTH,
    RECEIPT_LOGO_INNER_HEIGHT,
    RECEIPT_LOGO_INNER_WIDTH,
    resolveReceiptLogoUri,
} from '../utils/receiptLogo';
import { shouldShowLitePosBranding } from '../utils/receiptBranding';
import { getPaymentTypeLabel } from '../utils/paymentLabels';

// Logo LitePOS permanen - tidak perlu setting
const LITEPOS_LOGO = require('../assets/logo.png');

export default function ReceiptPreviewScreen({ route, navigation }: any) {
    useAppColorScheme(tw);
    const { receiptData } = route.params;
    const [isPrinting, setIsPrinting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isKitchenPrinting, setIsKitchenPrinting] = useState(false);
    const user = useStore(state => state.user);
    const settings = useStore(state => state.settings);
    const viewShotRef = useRef<any>(null);
    const logoShotRef = useRef<any>(null);
    const receiptLogoUri = resolveReceiptLogoUri(settings.storeLogo, settings.apiBaseUrl);
    const showLitePosBranding = shouldShowLitePosBranding(settings);
    const kitchenPrintEnabled = settings.enableKitchenPrint === true || String(settings.enableKitchenPrint) === 'true';

    const formatRp = (num: number) => 'Rp ' + (Math.round(num) || 0).toLocaleString('id-ID');
    const paymentStatusLabel = getPaymentStatusLabel(receiptData.paymentStatus);
    const paidAmount = getPaidAmount(receiptData);
    const remainingAmount = getRemainingAmount(receiptData);
    const paymentMethodLabel = receiptData.paymentMethod === 'PENDING'
        ? 'Belum Bayar'
        : getPaymentTypeLabel(receiptData.paymentMethod, 'Tunai');
    const transactionTotal = Math.max(0, Number(receiptData.total ?? receiptData.grandTotal ?? 0));
    const transactionDiscount = Math.max(0, Number(receiptData.discountAmount || 0));
    const transactionSubtotal = Math.max(0, Number(
        receiptData.subtotal ?? receiptData.subTotal ?? (transactionTotal + transactionDiscount)
    ));
    const getItemQuantity = (item: any) => Math.max(1, Number(item.quantity ?? item.qty ?? 1));
    const getItemPrice = (item: any) => Math.max(0, Number(item.price || 0));
    const getItemOriginalPrice = (item: any) => Math.max(
        getItemPrice(item),
        Number(item.originalPrice ?? item.price ?? 0),
    );
    const getItemDiscountTotal = (item: any) => {
        const unitDiscount = Math.max(
            0,
            Number(item.discountAmount || 0),
            getItemOriginalPrice(item) - getItemPrice(item),
        );
        return unitDiscount * getItemQuantity(item);
    };
    const productDiscountTotal = (receiptData.items || []).reduce(
        (sum: number, item: any) => sum + getItemDiscountTotal(item),
        0,
    );
    const transactionTax = Math.max(0, Number(receiptData.taxAmount || 0));
    const transactionTaxRate = Number(receiptData.taxRate || 0);
    const paidDisplayAmount = Math.max(0, Number(receiptData.cashAmount ?? paidAmount ?? 0));

    const center = (str: string, len: number) => {
        const pad = Math.max(0, Math.floor((len - str.length) / 2));
        return ' '.repeat(pad) + str;
    };

    const columns = (left: string, right: string, width: number) => {
        const safeRight = String(right).slice(-width);
        const maxLeftLength = Math.max(0, width - safeRight.length - 1);
        const safeLeft = String(left).slice(0, maxLeftLength);
        return safeLeft + ' '.repeat(Math.max(1, width - safeLeft.length - safeRight.length)) + safeRight;
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
            if (receiptData.takeAwayOption && receiptData.orderType !== 'DINE_IN') {
                text += center(`VIA : ${receiptData.takeAwayOption}`, WIDTH) + '\n';
            }
        }

        text += LINE;

        // Items
        for (const item of receiptData.items) {
            const itemName = (item.name || 'Produk').substring(0, WIDTH);
            const quantity = getItemQuantity(item);
            const itemPrice = getItemPrice(item);
            const originalPrice = getItemOriginalPrice(item);
            const itemDiscountTotal = getItemDiscountTotal(item);
            text += itemName + '\n';
            if (itemDiscountTotal > 0) {
                text += columns(
                    `${quantity} x ${originalPrice.toLocaleString('id-ID')}`,
                    `-${itemDiscountTotal.toLocaleString('id-ID')}`,
                    WIDTH,
                ) + '\n';
            }
            text += columns(
                `${quantity} x ${itemPrice.toLocaleString('id-ID')}`,
                (quantity * itemPrice).toLocaleString('id-ID'),
                WIDTH,
            ) + '\n';
            if (itemDiscountTotal > 0) text += `  ${item.discountLabel || 'Diskon produk'}\n`;
            if (item.notes) text += `  Catatan: ${item.notes}\n`;
        }

        text += LINE;

        if (productDiscountTotal > 0) {
            text += columns('Harga normal', `Rp ${(transactionSubtotal + productDiscountTotal).toLocaleString('id-ID')}`, WIDTH) + '\n';
            text += columns('Diskon produk', `-Rp ${productDiscountTotal.toLocaleString('id-ID')}`, WIDTH) + '\n';
        }
        text += columns('Subtotal', `Rp ${transactionSubtotal.toLocaleString('id-ID')}`, WIDTH) + '\n';
        if (transactionDiscount > 0) {
            text += columns('Diskon transaksi', `-Rp ${transactionDiscount.toLocaleString('id-ID')}`, WIDTH) + '\n';
        }
        if (transactionTax > 0) {
            const taxLabel = transactionTaxRate > 0 ? `Pajak (${transactionTaxRate}%)` : 'Pajak';
            text += columns(taxLabel, `Rp ${transactionTax.toLocaleString('id-ID')}`, WIDTH) + '\n';
        }

        text += columns('TOTAL', `Rp ${transactionTotal.toLocaleString('id-ID')}`, WIDTH) + '\n';

        if (receiptData.paymentStatus === 'UNPAID') {
            text += columns('DIBAYAR', 'Rp 0', WIDTH) + '\n';
        } else {
            text += columns(`BAYAR (${paymentMethodLabel})`, `Rp ${paidDisplayAmount.toLocaleString('id-ID')}`, WIDTH) + '\n';

            if ((receiptData.changeAmount || 0) > 0) {
                text += columns('KEMBALI', `Rp ${Number(receiptData.changeAmount).toLocaleString('id-ID')}`, WIDTH) + '\n';
            }
        }

        if (remainingAmount > 0) {
            text += columns('SISA', `Rp ${remainingAmount.toLocaleString('id-ID')}`, WIDTH) + '\n';
        }

        text += LINE;
        if (settings.receiptFooter) {
            const footerLines = wrapText(settings.receiptFooter, WIDTH);
            for (const line of footerLines) {
                text += center(line, WIDTH) + '\n';
            }
        } else {
            text += center('Terima kasih atas kunjungan Anda', WIDTH) + '\n';
        }
        if (showLitePosBranding) {
            text += center('Powered by LitePOS', WIDTH) + '\n';
        }
        text += '\n\n\n';

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
                    await printerClass.printImageBase64(logoToPrint, getReceiptLogoPrintOptions());
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

    const downloadReceipt = async () => {
        setIsDownloading(true);
        try {
            if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
                const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
                if (permission !== PermissionsAndroid.RESULTS.GRANTED) return;
            }
            if (!viewShotRef.current?.capture) throw new Error('Preview struk belum siap.');
            const source = await viewShotRef.current.capture();
            const safeInvoice = String(receiptData.invoiceNumber || Date.now()).replace(/[^a-zA-Z0-9-_]/g, '-');
            const target = `${RNFS.DownloadDirectoryPath}/Struk-${safeInvoice}.png`;
            await RNFS.copyFile(source.replace('file://', ''), target);
            Alert.alert('Berhasil', `Struk disimpan di folder Download.\n${target.split('/').pop()}`);
        } catch (error: any) {
            Alert.alert('Gagal', error?.message || 'Struk tidak dapat disimpan.');
        } finally {
            setIsDownloading(false);
        }
    };

    const printKitchenCopy = async () => {
        if (!kitchenPrintEnabled) return;
        setIsKitchenPrinting(true);
        try {
            await printKitchenTicket(settings, receiptData.items || [], {
                tableNumber: receiptData.tableName,
                customerName: receiptData.customerName,
                orderName: receiptData.invoiceNumber,
            });
        } catch (error: any) {
            Alert.alert('Gagal Cetak Dapur', error?.message || 'Pastikan printer menyala dan tersambung.');
        } finally {
            setIsKitchenPrinting(false);
        }
    };

    return (
        <View style={tw`flex-1 items-center justify-center bg-black/70 p-4`}>
            {receiptLogoUri && settings.showLogoOnReceipt !== false ? (
                <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: -10000, width: RECEIPT_LOGO_CAPTURE_WIDTH, height: RECEIPT_LOGO_CAPTURE_HEIGHT }}>
                    <ViewShot
                        ref={logoShotRef}
                        options={{ format: 'png', quality: 1 }}
                        style={{
                            width: RECEIPT_LOGO_CAPTURE_WIDTH,
                            height: RECEIPT_LOGO_CAPTURE_HEIGHT,
                            padding: 10,
                            backgroundColor: '#FFFFFF',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Image
                            source={{ uri: receiptLogoUri }}
                            style={{ width: RECEIPT_LOGO_INNER_WIDTH, height: RECEIPT_LOGO_INNER_HEIGHT }}
                            resizeMode="contain"
                        />
                    </ViewShot>
                </View>
            ) : null}

            <View style={[tw`w-full overflow-hidden rounded-3xl bg-gray-50`, { maxWidth: 430, maxHeight: '94%' }]}>
                <View style={tw`flex-row items-center border-b border-gray-100 bg-white px-5 py-4`}>
                    <Text style={tw`flex-1 text-center text-lg font-bold text-gray-900`}>Struk Transaksi</Text>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        accessibilityLabel="Tutup preview struk"
                        style={tw`absolute right-4 rounded-full p-2`}
                    >
                        <Icon name="close" size={22} color={tw.color('gray-500')} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={tw`items-center px-5 py-4`} showsVerticalScrollIndicator={false}>
                
                {/* The Paper Receipt inside ViewShot */}
                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={tw`bg-white w-full max-w-[330px] rounded-2xl`}>
                    <View style={tw`rounded-2xl border border-gray-200 p-5 bg-white`} collapsable={false}>
                        {/* Logo */}
                        {receiptLogoUri && settings.showLogoOnReceipt !== false ? (
                            <View style={tw`items-center mb-4`}>
                                <Image 
                                    source={{ uri: receiptLogoUri }}
                                    style={{ width: 120, height: 72, backgroundColor: '#FFFFFF' }}
                                    resizeMode="contain"
                                />
                            </View>
                        ) : null}
                        
                        <Text style={tw`text-center font-mono text-xs font-bold text-black mb-1`}>{settings.storeName || 'LitePOS'}</Text>
                        {settings.storeAddress ? <Text style={tw`text-center font-mono text-[10px] text-black`}>{settings.storeAddress}</Text> : null}
                        {settings.storePhone ? <Text style={tw`text-center font-mono text-[10px] text-black mb-2`}>Telp: {settings.storePhone}</Text> : null}
                        
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
                            <>
                                <Text style={tw`text-center font-mono text-[11px] font-bold text-black ${receiptData.preOrderDate ? 'mt-1' : 'mt-2'}`}>
                                    === {receiptData.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY'}{receiptData.orderType === 'DINE_IN' && receiptData.tableName ? ` (Meja ${receiptData.tableName})` : ''} ===
                                </Text>
                                {receiptData.takeAwayOption && receiptData.orderType !== 'DINE_IN' ? (
                                    <Text style={tw`text-center font-mono text-[10px] text-black`}>VIA : {receiptData.takeAwayOption}</Text>
                                ) : null}
                            </>
                        ) : null}

                        <View style={tw`w-full border-t border-dashed border-gray-400 my-2`} />

                        {receiptData.items.map((item: any, idx: number) => {
                            const quantity = getItemQuantity(item);
                            const itemPrice = getItemPrice(item);
                            const originalPrice = getItemOriginalPrice(item);
                            const itemDiscountTotal = getItemDiscountTotal(item);
                            return (
                                <View key={idx} style={tw`mb-2`}>
                                    <Text style={tw`font-mono text-[11px] font-bold text-black`} numberOfLines={2}>{item.name || 'Produk'}</Text>
                                    {itemDiscountTotal > 0 ? (
                                        <View style={tw`flex-row justify-between`}>
                                            <Text style={tw`font-mono text-[11px] text-black`}>
                                                {quantity} x <Text style={tw`line-through`}>{originalPrice.toLocaleString('id-ID')}</Text>
                                            </Text>
                                            <Text style={tw`font-mono text-[11px] text-black`}>-{itemDiscountTotal.toLocaleString('id-ID')}</Text>
                                        </View>
                                    ) : null}
                                    <View style={tw`flex-row justify-between`}>
                                        <Text style={tw`font-mono text-[11px] text-black`}>{quantity} x {itemPrice.toLocaleString('id-ID')}</Text>
                                        <Text style={tw`font-mono text-[11px] text-black`}>{(itemPrice * quantity).toLocaleString('id-ID')}</Text>
                                    </View>
                                    {itemDiscountTotal > 0 ? (
                                        <Text style={tw`font-mono text-[10px] italic text-gray-600`}>{item.discountLabel || 'Diskon produk'}</Text>
                                    ) : null}
                                    {item.notes ? (
                                        <Text style={tw`font-mono text-[10px] italic text-gray-600`}>Catatan: {item.notes}</Text>
                                    ) : null}
                                </View>
                            );
                        })}

                        <View style={tw`w-full border-t border-dashed border-gray-400 my-2`} />

                        {productDiscountTotal > 0 && (
                            <>
                                <View style={tw`flex-row justify-between mb-1`}>
                                    <Text style={tw`font-mono text-[11px] text-black`}>Harga normal</Text>
                                    <Text style={tw`font-mono text-[11px] text-black`}>{(transactionSubtotal + productDiscountTotal).toLocaleString('id-ID')}</Text>
                                </View>
                                <View style={tw`flex-row justify-between mb-1`}>
                                    <Text style={tw`font-mono text-[11px] text-black`}>Diskon produk</Text>
                                    <Text style={tw`font-mono text-[11px] text-black`}>-{productDiscountTotal.toLocaleString('id-ID')}</Text>
                                </View>
                            </>
                        )}

                        <View style={tw`flex-row justify-between mb-1`}>
                            <Text style={tw`font-mono text-[11px] text-black`}>Subtotal</Text>
                            <Text style={tw`font-mono text-[11px] text-black`}>{transactionSubtotal.toLocaleString('id-ID')}</Text>
                        </View>
                        {transactionDiscount > 0 ? (
                            <View style={tw`flex-row justify-between mb-1`}>
                                <Text style={tw`font-mono text-[11px] text-black`}>Diskon transaksi</Text>
                                <Text style={tw`font-mono text-[11px] text-black`}>-{transactionDiscount.toLocaleString('id-ID')}</Text>
                            </View>
                        ) : null}
                        {transactionTax > 0 ? (
                            <View style={tw`flex-row justify-between mb-1`}>
                                <Text style={tw`font-mono text-[11px] text-black`}>{transactionTaxRate > 0 ? `Pajak (${transactionTaxRate}%)` : 'Pajak'}</Text>
                                <Text style={tw`font-mono text-[11px] text-black`}>{transactionTax.toLocaleString('id-ID')}</Text>
                            </View>
                        ) : null}

                        <View style={tw`flex-row justify-between mt-1 mb-1`}>
                            <Text style={tw`font-mono text-[12px] font-bold text-black`}>TOTAL</Text>
                            <Text style={tw`font-mono text-[12px] font-bold text-black`}>{transactionTotal.toLocaleString('id-ID')}</Text>
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
                                    <Text style={tw`font-mono text-[11px] text-black`}>{paidDisplayAmount.toLocaleString('id-ID')}</Text>
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
                            {settings.receiptFooter || 'Terima kasih atas kunjungan Anda'}
                        </Text>
                        {showLitePosBranding && (
                            <Text style={tw`text-center font-mono text-[10px] text-black mt-1`}>Powered by LitePOS</Text>
                        )}
                        
                    </View>
                </ViewShot>

                </ScrollView>

                <View style={tw`border-t border-gray-100 bg-white p-4`}>
                    {!settings.printerAddress && (
                        <View style={tw`mb-3 flex-row items-center justify-center rounded-lg bg-orange-50 py-2`}>
                            <Icon name="alert-circle-outline" size={14} color={tw.color('orange-600')} style={tw`mr-2`} />
                            <Text style={tw`text-[10px] font-bold text-orange-700`}>Printer thermal belum diatur</Text>
                        </View>
                    )}

                    <View style={tw`mb-3 flex-row gap-2`}>
                        <TouchableOpacity
                            style={tw`flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-1 py-3 ${isDownloading ? 'opacity-50' : ''}`}
                            onPress={downloadReceipt}
                            disabled={isDownloading}
                        >
                            <Icon name="download-outline" size={21} color={tw.color('gray-900')} />
                            <Text style={tw`mt-1 text-[9px] font-medium text-gray-800`}>{isDownloading ? 'Menyimpan...' : 'Unduh'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={tw`flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-1 py-3`}
                            onPress={shareReceiptWA}
                        >
                            <Icon name="share-variant-outline" size={21} color={tw.color('gray-900')} />
                            <Text style={tw`mt-1 text-[9px] font-medium text-gray-800`}>Bagikan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={tw`flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-1 py-3 ${isPrinting || !settings.printerAddress ? 'opacity-50' : ''}`}
                            onPress={printReceipt}
                            disabled={isPrinting || !settings.printerAddress}
                        >
                            <Icon name="printer-outline" size={21} color={tw.color('gray-900')} />
                            <Text style={tw`mt-1 text-[9px] font-medium text-gray-800`}>{isPrinting ? 'Mencetak...' : 'Cetak'}</Text>
                        </TouchableOpacity>
                        {kitchenPrintEnabled && (
                            <TouchableOpacity
                                style={tw`flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-1 py-3 ${isKitchenPrinting || !settings.printerAddress ? 'opacity-50' : ''}`}
                                onPress={printKitchenCopy}
                                disabled={isKitchenPrinting || !settings.printerAddress}
                            >
                                <Icon name="silverware-fork-knife" size={21} color={tw.color('orange-600')} />
                                <Text style={tw`mt-1 text-center text-[9px] font-medium text-gray-800`}>{isKitchenPrinting ? 'Mencetak...' : 'Cetak Dapur'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity style={tw`items-center rounded-xl bg-gray-100 py-3.5`} onPress={() => navigation.goBack()}>
                        <Text style={tw`font-medium text-gray-800`}>Selesai</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
