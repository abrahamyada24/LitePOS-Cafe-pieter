import { closeConfiguredPrinter, connectConfiguredPrinter } from './printerConnection';
const PRINT_WIDTH = 32;

interface KitchenPrinterSettings {
    storeName?: string;
    printerAddress?: string | null;
    printerType?: 'BLE' | 'USB' | null;
}

interface KitchenPrintContext {
    tableNumber?: string;
    customerName?: string;
    orderName?: string;
    queueLabel?: string;
}

const wrapText = (value: string, width = PRINT_WIDTH) => {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if (!currentLine) {
            currentLine = word.slice(0, width);
            continue;
        }
        if (`${currentLine} ${word}`.length <= width) {
            currentLine += ` ${word}`;
        } else {
            lines.push(currentLine);
            currentLine = word.slice(0, width);
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
};

const buildKitchenTicket = (settings: KitchenPrinterSettings, cart: any[], context: KitchenPrintContext) => {
    const divider = '-'.repeat(PRINT_WIDTH);
    const totalItems = cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
    const lines = [
        '          CETAK DAPUR',
        settings.storeName || 'LitePOS',
        new Date().toLocaleString('id-ID'),
    ];

    if (context.queueLabel) {
        lines.push(divider, `       ANTRIAN ${context.queueLabel}`, divider);
    }
    if (context.tableNumber) lines.push(`MEJA: ${context.tableNumber}`);
    if (context.customerName) lines.push(`PELANGGAN: ${context.customerName}`);
    if (context.orderName) lines.push(`ORDER: ${context.orderName}`);
    lines.push(divider);

    for (const item of cart) {
        const quantity = Math.max(1, Number(item.quantity || 1));
        lines.push(...wrapText(`${quantity} x ${item.name}`));
        if (item.notes) {
            lines.push(...wrapText(`  Catatan: ${item.notes}`));
        }
        lines.push('');
    }

    lines.push(divider, `TOTAL ITEM: ${totalItems}`, '', '', '');
    return lines.join('\n');
};

export const printKitchenTicket = async (
    settings: KitchenPrinterSettings,
    cart: any[],
    context: KitchenPrintContext = {}
) => {
    if (!settings.printerAddress || !settings.printerType) {
        throw new Error('Printer belum dikonfigurasi di Pengaturan.');
    }
    if (cart.length === 0) {
        throw new Error('Keranjang masih kosong.');
    }

    const printerClass = await connectConfiguredPrinter(settings);
    try {
        await printerClass.printText(buildKitchenTicket(settings, cart, context));
    } finally {
        await closeConfiguredPrinter(settings, printerClass);
    }
};
