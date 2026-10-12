// A Hairline "Riffle" tray (eight cards) paired with eight detail entries.
// Hovering a card, or using the arrow keys, shows its entry beside the tray;
// clicking an entry in the index below pulls its card.
// Markup: [data-riffle] holds .riffle-figure and .rf-detail > .rf-item × 8,
// followed by an empty ol.rf-index in the same page.

const HAIRLINE_URL = 'https://cdn.jsdelivr.net/npm/@lucasmarkes/hairline@0.5.0/dist/index.js';

let riffleFn = null;
try {
    ({ riffle: riffleFn } = await import(HAIRLINE_URL));
} catch (err) {
    // CDN unreachable: each index and detail panel still works on its own.
    console.warn('Hairline failed to load; showing the lists only.', err);
}

document.querySelectorAll('[data-riffle]').forEach(setup);

function setup(layout) {
    const items = [...layout.querySelectorAll('.rf-item')];
    const figureEl = layout.querySelector('.riffle-figure');
    const index = layout.parentElement.querySelector('.rf-index');

    let shown = 0;   // entry on screen (1-based)
    let pulled = 0;  // card standing up in the tray (0 = none)

    function show(n) {
        if (n === shown || n < 1 || n > items.length) return;
        shown = n;
        items.forEach((item, i) => {
            const active = i + 1 === n;
            item.hidden = !active;
            item.classList.toggle('is-active', active);
        });
        index.querySelectorAll('button').forEach((btn, i) => {
            if (i + 1 === n) btn.setAttribute('aria-current', 'true');
            else btn.removeAttribute('aria-current');
        });
    }

    // Riffle has no "pull card n" call, but its arrow keys walk 01 → 08,
    // so pulling a card from the index is a matter of stepping there.
    function pull(n) {
        const target = figureEl.querySelector('svg');
        if (!target) return;
        const press = (key) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        let at = pulled;
        if (at === 0) { press('ArrowRight'); at = 1; }
        while (at < n) { press('ArrowRight'); at++; }
        while (at > n) { press('ArrowLeft'); at--; }
        pulled = n;
    }

    items.forEach((item, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-controls', item.id);
        btn.innerHTML = `<span class="ri-num">${item.dataset.n}</span><span class="ri-title">${item.querySelector('.rf-title').textContent}</span>`;
        btn.addEventListener('click', () => { show(i + 1); pull(i + 1); });
        li.appendChild(btn);
        index.appendChild(li);
    });

    show(1);

    if (!riffleFn) {
        layout.classList.add('no-figure');
        return;
    }
    riffleFn(figureEl, {
        intensity: 0.6,
        label: figureEl.dataset.label,
        onRead(text) {
            if (text === 'rest') { pulled = 0; return; }  // keep the last entry on screen
            pulled = parseInt(text, 10);
            show(pulled);
        }
    });
}
