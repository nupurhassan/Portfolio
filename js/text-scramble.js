// text scramble effect — runs ONCE on page load only

class TextScramble {
    constructor(el) {
        this.el = el;
        this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&';
        this.update = this.update.bind(this);
    }

    setText(newText) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.el.innerHTML = newText.split('').map(char =>
                char === ' ' ? ' ' : `<span class="letter">${char}</span>`
            ).join('');
            return Promise.resolve();
        }

        const oldText = this.el.innerText;
        const length = Math.max(oldText.length, newText.length);
        const promise = new Promise(resolve => this.resolve = resolve);
        this.queue = [];

        for (let i = 0; i < length; i++) {
            const from = oldText[i] || '';
            const to = newText[i] || '';
            const start = i * 3;
            const end = start + 25 + Math.floor(Math.random() * 15);
            this.queue.push({ from, to, start, end });
        }

        cancelAnimationFrame(this.frameRequest);
        this.frame = 0;
        this.update();
        return promise;
    }

    update() {
        let output = '';
        let complete = 0;

        for (let i = 0; i < this.queue.length; i++) {
            let { from, to, start, end, char } = this.queue[i];

            if (this.frame >= end) {
                complete++;
                output += `<span class="letter">${to}</span>`;
            } else if (this.frame >= start) {
                if (!char || Math.random() < 0.2) {
                    char = this.randomChar();
                    this.queue[i].char = char;
                }
                const progress = (this.frame - start) / (end - start);
                const opacity = 0.5 + (progress * 0.5);
                output += `<span class="letter" style="opacity: ${opacity}">${char}</span>`;
            } else {
                output += `<span class="letter">${from}</span>`;
            }
        }

        this.el.innerHTML = output;

        if (complete === this.queue.length) {
            this.resolve();
        } else {
            this.frameRequest = requestAnimationFrame(this.update);
            this.frame++;
        }
    }

    randomChar() {
        return this.chars[Math.floor(Math.random() * this.chars.length)];
    }
}

// nav link initialization — scramble on load only, no hover
function initNavScramble() {
    const navLinks = document.querySelectorAll('.nav-link');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    navLinks.forEach((link, index) => {
        const text = link.dataset.text;
        const scramble = new TextScramble(link);

        // set initial empty letters
        link.innerHTML = text.split('').map(() =>
            `<span class="letter" style="opacity:0">&nbsp;</span>`
        ).join('');

        // stagger the scramble on page load
        if (!prefersReducedMotion) {
            setTimeout(() => {
                scramble.setText(text);
            }, 300 + index * 150);
        } else {
            link.innerHTML = text.split('').map(char =>
                char === ' ' ? ' ' : `<span class="letter">${char}</span>`
            ).join('');
        }
    });

    // no hover listeners — scramble only happens once
}

window.TextScramble = TextScramble;
window.initNavScramble = initNavScramble;