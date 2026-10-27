import api from './api';

type Statement = [string, any[]];
export const jakartaInvoiceDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date).replace(/-/g, '');

export const newDeviceKey = () => {
    const bytes = new Uint8Array(16);
    (globalThis as any).crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

let terminalPromise: Promise<string> | null = null;
export const getInvoiceTerminal = (db: any): Promise<string> => {
    if (terminalPromise) return terminalPromise;
    terminalPromise = (async () => {
        const [rows] = await db.executeSql("SELECT key, value FROM settings WHERE key IN ('invoice_device_key', 'invoice_terminal_code')");
        const settings: Record<string, string> = {};
        for (let i = 0; i < rows.rows.length; i++) settings[rows.rows.item(i).key] = rows.rows.item(i).value;
        if (settings.invoice_terminal_code) return settings.invoice_terminal_code;
        const deviceKey = settings.invoice_device_key || newDeviceKey();
        await db.executeSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['invoice_device_key', deviceKey]);
        let code: string;
        try {
            const response = await api.post('/transactions/terminal', { deviceKey, kind: 'ANDROID' }, { timeout: 3000 });
            code = response.data?.data?.code;
            if (!/^K\d+$/.test(code)) throw new Error('Terminal tidak valid');
        } catch {
            // A first checkout must remain possible offline. Keep this namespace
            // permanently; reconnecting must never renumber an already printed receipt.
            code = `K${deviceKey.slice(0, 24).toUpperCase()}`;
        }
        await db.executeSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['invoice_terminal_code', code]);
        return code;
    })().finally(() => { terminalPromise = null; });
    return terminalPromise;
};

export const saveCheckout = async (db: any, terminal: string, statements: Statement[], receipt: any) => {
    const day = jakartaInvoiceDay(new Date(receipt.createdAt));
    const counterKey = `invoice_counter:${day}:${terminal}`;
    let persistedReceipt: any;
    // This library requires synchronous callbacks. All writes are enqueued
    // inside its transaction; never use an async transaction callback.
    await db.transaction((tx: any) => {
        const execute = (sql: string, args: any[], success?: (transaction: any, result: any) => void) => {
            tx.executeSql(sql, args, success || (() => {}), (_tx: any, error: any) => { throw error; });
        };
        execute('SELECT receiptJson FROM transactions WHERE id = ?', [receipt.id], (_tx, existing) => {
            if (existing.rows.length && existing.rows.item(0).receiptJson) {
                persistedReceipt = JSON.parse(existing.rows.item(0).receiptJson);
                return;
            }
            execute('SELECT value FROM settings WHERE key = ?', [counterKey], (_tx, result) => {
                const next = (Number(result.rows.length ? result.rows.item(0).value : 0) || 0) + 1;
                const invoiceNumber = `INV/${day}/${terminal}/${String(next).padStart(4, '0')}`;
                persistedReceipt = { ...receipt, invoiceNumber };
                execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [counterKey, String(next)]);
                statements.forEach(([sql, args], index) => {
                    const values = [...args];
                    if (index === 0) values[1] = invoiceNumber;
                    execute(sql, values);
                });
                execute('UPDATE transactions SET receiptJson = ?, syncError = NULL WHERE id = ?', [JSON.stringify(persistedReceipt), receipt.id]);
            });
        });
    });
    // The transaction promise resolves only after COMMIT. A readback failure
    // must not turn a committed sale into a failed checkout/retry.
    return persistedReceipt;
};
