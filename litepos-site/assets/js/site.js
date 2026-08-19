(() => {
    'use strict';

    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('main-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        nav.addEventListener('click', () => {
            nav.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
        });
    }

    document.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-copy-target]');
        if (!button) return;
        const target = document.getElementById(button.dataset.copyTarget || '');
        if (!target) return;

        try {
            await navigator.clipboard.writeText(target.textContent.trim());
            const original = button.textContent;
            button.textContent = 'Tersalin';
            window.setTimeout(() => { button.textContent = original; }, 1400);
        } catch (_) {
            const range = document.createRange();
            range.selectNodeContents(target);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
        }
    });
})();
