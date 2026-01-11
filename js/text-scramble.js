// text scramble effect

class TextScramble {
    constructor(el) {
        this.el = el;
        this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&';
        this.update = this.update.bind(this);
    }

    setText(newText) {
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

// nav link initialization
function initNavScramble() {
    const navLinks = document.querySelectorAll('.nav-link');
    const instances = [];

    navLinks.forEach((link) => {
        const text = link.dataset.text;
        const scramble = new TextScramble(link);
        instances.push({ scramble, text });

        link.innerHTML = text.split('').map(char =>
            char === ' ' ? ' ' : `<span class="letter">${char}</span>`
        ).join('');
    });

    navLinks.forEach((link, index) => {
        link.addEventListener('mouseenter', () => {
            instances[index].scramble.setText(instances[index].text);
        });
    });
}

window.TextScramble = TextScramble;
window.initNavScramble = initNavScramble;