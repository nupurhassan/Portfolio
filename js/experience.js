// Experience: case-study cards. Click a card's header to open its details;
// opening one closes the others.

(() => {
    const cards = [...document.querySelectorAll('#page-work .xp')];

    function setOpen(card, open) {
        card.classList.toggle('is-open', open);
        card.querySelector('.xp-head').setAttribute('aria-expanded', String(open));
    }

    cards.forEach(card => {
        card.querySelector('.xp-head').addEventListener('click', () => {
            const opening = !card.classList.contains('is-open');
            cards.forEach(c => setOpen(c, false));
            if (opening) setOpen(card, true);
        });
    });
})();
