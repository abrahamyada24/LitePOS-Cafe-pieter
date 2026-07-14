import { NativeModules, Platform } from 'react-native';
import * as PrinterModule from 'react-native-thermal-receipt-printer-image-qr';
import { requestPrinterPermissions } from './permissions';

const { BLEPrinter, USBPrinter } = PrinterModule as any;

export interface PrinterConnectionSettings {
    printerAddress?: string | null;
    printerType?: 'BLE' | 'USB' | null;
}

const delay = (duration: number) => new Promise<void>(resolve => setTimeout(resolve, duration));

const isIgnorableInitError = (error: any) => (
    /already|initialized|registered/i.test(String(error?.message || error || ''))
);

export const parseUsbPrinterAddress = (address?: string | null) => {
    const [vendorText, productText] = String(address || '').split('|');
    const vendorId = Number(vendorText);
    const productId = Number(productText);
    if (!Number.isInteger(vendorId) || vendorId <= 0 || !Number.isInteger(productId) || productId <= 0) {
        throw new Error('Konfigurasi printer USB tidak valid. Pilih ulang printer di Pengaturan.');
    }
    return { vendorId, productId };
};

const initializePrinter = async (printerClass: any) => {
    try {
        await printerClass.init();
    } catch (error) {
        if (!isIgnorableInitError(error)) throw error;
    }
};

export const connectConfiguredPrinter = async (settings: PrinterConnectionSettings) => {
    if (!settings.printerAddress || !settings.printerType) {
        throw new Error('Printer belum dikonfigurasi di Pengaturan.');
    }

    if (settings.printerType === 'BLE') {
        const hasPermission = await requestPrinterPermissions();
        if (!hasPermission) throw new Error('Izin Bluetooth belum diberikan.');
        await initializePrinter(BLEPrinter);
        await BLEPrinter.connectPrinter(settings.printerAddress);
        return BLEPrinter;
    }

    if (Platform.OS !== 'android') {
        throw new Error('Printer USB hanya tersedia pada aplikasi Android.');
    }

    const { vendorId, productId } = parseUsbPrinterAddress(settings.printerAddress);
    await initializePrinter(USBPrinter);

    const devices = await USBPrinter.getDeviceList();
    const isConnected = devices.some((device: any) => (
        Number(device.vendor_id) === vendorId && Number(device.product_id) === productId
    ));
    if (!isConnected) {
        throw new Error('Printer USB tidak terdeteksi. Periksa kabel OTG dan daya printer.');
    }

    const permissionModule = NativeModules.UsbPrinterPermission;
    if (!permissionModule?.request) {
        throw new Error('Modul izin USB belum tersedia. Build ulang aplikasi Android.');
    }
    await permissionModule.request(vendorId, productId);

    // The printer library resolves its first call before its permission receiver
    // has selected the device. Permission is already granted here, so a short
    // second call reliably completes that internal selection.
    await USBPrinter.connectPrinter(vendorId, productId);
    await delay(150);
    await USBPrinter.connectPrinter(vendorId, productId);
    return USBPrinter;
};

export const closeConfiguredPrinter = async (settings: PrinterConnectionSettings, printerClass: any) => {
    if (settings.printerType === 'BLE' && printerClass?.closeConn) {
        try {
            await printerClass.closeConn();
        } catch {
        }
    }
};
