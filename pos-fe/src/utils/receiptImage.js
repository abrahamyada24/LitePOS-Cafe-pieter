import { toBlob } from 'html-to-image';

const waitForReceiptAssets = async (node) => {
    if (document.fonts?.ready) await document.fonts.ready;

    await Promise.all(Array.from(node.querySelectorAll('img')).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
            const finish = () => resolve();
            image.addEventListener('load', finish, { once: true });
            image.addEventListener('error', finish, { once: true });
            window.setTimeout(finish, 3000);
        });
    }));
};

export const getReceiptImageFilename = (invoiceNumber) => {
    const safeInvoice = String(invoiceNumber || Date.now()).replace(/[^a-zA-Z0-9-_]/g, '-');
    return `Struk-${safeInvoice}.png`;
};

export const createReceiptImageBlob = async (node) => {
    if (!node) throw new Error('Preview struk belum siap.');
    await waitForReceiptAssets(node);

    const blob = await toBlob(node, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
        width: Math.ceil(node.scrollWidth),
        height: Math.ceil(node.scrollHeight),
        style: {
            boxShadow: 'none',
            display: 'block',
            left: 'auto',
            margin: '0',
            position: 'static',
            top: 'auto',
        },
    });

    if (!blob) throw new Error('Gambar struk gagal dibuat.');
    return blob;
};

export const downloadReceiptImage = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const shareReceiptImage = async ({ blob, filename, title, text }) => {
    const file = new File([blob], filename, {
        type: 'image/png',
        lastModified: Date.now(),
    });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return 'shared';
    }

    downloadReceiptImage(blob, filename);
    return 'downloaded';
};
