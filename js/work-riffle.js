// Work page: a Hairline "Riffle" tray of eight cards, one per role.
// Hovering a card (or using the arrow keys) shows that role beside the tray;
// clicking a role in the index below pulls its card.

const HAIRLINE_URL = 'https://cdn.jsdelivr.net/npm/@lucasmarkes/hairline@0.5.0/dist/index.js';

const roles = [...document.querySelectorAll('#page-work .role')];
const index = document.getElementById('role-index');
const figureEl = document.getElementById('work-riffle');

let shown = 0;   // role currently shown in the detail panel (1-based)
let pulled = 0;  // card currently standing up in the tray (0 = none)

function show(n) {
    if (n === shown || n < 1 || n > roles.length) return;
    shown = n;
    roles.forEach((role, i) => {
        const active = i + 1 === n;
        role.hidden = !active;
        role.classList.toggle('is-active', active);
    });
    index.querySelectorAll('button').forEach((btn, i) => {
        if (i + 1 === n) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
    });
}

// Build the index list from the role entries, so the content lives in one place.
roles.forEach((role, i) => {
    const n = i + 1;
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-controls', role.id);
    btn.innerHTML = `
        <span class="ri-num">${role.dataset.n}</span>
        <span class="ri-title">${role.querySelector('.role-title').textContent}</span>
        <span class="ri-date">${role.querySelector('.role-meta span').textContent}</span>`;
    btn.addEventListener('click', () => {
        show(n);
        pull(n);
    });
    li.appendChild(btn);
    index.appendChild(li);
});

show(1);

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

try {
    const { riffle } = await import(HAIRLINE_URL);
    riffle(figureEl, {
        intensity: 0.6,
        label: `A tray of ${roles.length} cards, one per role. Hover or use the arrow keys to pull a card and read that role.`,
        onRead(text) {
            if (text === 'rest') { pulled = 0; return; }  // keep the last role on screen
            pulled = parseInt(text, 10);
            show(pulled);
        }
    });
} catch (err) {
    // CDN unreachable: the index and detail panel still work on their own.
    console.warn('Hairline failed to load; showing the role list only.', err);
    document.querySelector('#page-work .riffle-layout').classList.add('no-figure');
}
