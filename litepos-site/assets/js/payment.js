(() => {
    'use strict';

    const app = document.getElementById('payment-app');
    if (!app) return;

    const payButton = document.getElementById('pay-button');
    const statusUrl = app.dataset.statusUrl;
    let currentStatus = app.dataset.orderStatus || 'pending';
    let polling = false;
    let attempts = 0;

    const escapeText = (value) => String(value ?? '');
    const render = (data) => {
        currentStatus = data.status || currentStatus;
        const label = document.getElementById('status-label');
        const title = document.getElementById('payment-title');
        const message = document.getElementById('payment-message');
        const icon = document.getElementById('status-icon');
        if (label) {
            label.textContent = currentStatus.toUpperCase();
            label.className = `status-label status-text-${currentStatus}`;
        }
        if (icon) {
            icon.className = `status-icon status-${currentStatus}`;
            icon.textContent = currentStatus === 'paid' ? '✓' : (['failed', 'expired', 'cancelled', 'refunded'].includes(currentStatus) ? '×' : '…');
        }
        if (currentStatus === 'paid') {
            if (title) title.textContent = 'Pembayaran berhasil';
            if (message) message.textContent = 'Lisensi sudah diterbitkan dan siap digunakan.';
            if (payButton) payButton.hidden = true;
            if (data.license) {
                const result = document.getElementById('license-result');
                const code = document.getElementById('activation-code');
                const key = document.getElementById('license-key');
                if (code) code.textContent = escapeText(data.license.activation_code);
                if (key) key.textContent = escapeText(data.license.license_key);
                if (result) result.classList.remove('is-hidden');
            }
        } else if (['failed', 'expired', 'cancelled', 'refunded'].includes(currentStatus)) {
            if (title) title.textContent = 'Pembayaran tidak selesai';
            if (message) message.textContent = 'Transaksi gagal, dibatalkan, atau kedaluwarsa. Silakan buat pesanan baru.';
            if (payButton) payButton.hidden = true;
        }
    };

    const poll = async () => {
        if (polling || !statusUrl || currentStatus !== 'pending' || attempts >= 80) return;
        polling = true;
        attempts += 1;
        try {
            const response = await fetch(statusUrl, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
            if (response.ok) render(await response.json());
        } catch (_) {
            // A temporary network error is retried on the next interval.
        } finally {
            polling = false;
            if (currentStatus === 'pending' && attempts < 80) window.setTimeout(poll, 3500);
        }
    };

    if (payButton) {
        payButton.addEventListener('click', () => {
            const snapToken = app.dataset.snapToken;
            if (!snapToken || !window.snap) return;
            window.snap.pay(snapToken, {
                onSuccess: poll,
                onPending: poll,
                onError: poll,
                onClose: poll,
            });
        });
    }

    if (currentStatus === 'pending') {
        if (payButton) payButton.click();
        window.setTimeout(poll, 2500);
    }
})();
