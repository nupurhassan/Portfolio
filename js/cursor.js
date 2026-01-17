const Cursor = {
    cursor: null,
    ring: null,
    particles: [],

    mouse: { x: 0, y: 0 },
    cursorPos: { x: 0, y: 0 },
    ringPos: { x: 0, y: 0 },
    particlePositions: [],

    particleCount: 0,
    maxParticles: 50,
    lastPos: { x: 0, y: 0 },

    init(options = {}) {
        this.cursor = document.querySelector('.cursor');
        this.ring = document.querySelector('.cursor-ring');
        this.particles = document.querySelectorAll('.cursor-particle');

        if (this.particles.length) {
            this.particlePositions = Array(this.particles.length).fill().map(() => ({ x: 0, y: 0 }));
        }

        this.bindEvents(options);

        if (this.ring || this.particles.length) {
            this.animate();
        }
    },

    bindEvents(options = {}) {
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;

            if (!this.ring && this.cursor) {
                this.cursor.style.left = e.clientX + 'px';
                this.cursor.style.top = e.clientY + 'px';
            }

            if (options.trailParticles) {
                this.handleTrailParticles(e.clientX, e.clientY);
            }
        });

        document.addEventListener('mouseleave', () => {
            if (this.cursor) this.cursor.style.opacity = '0';
            if (this.ring) this.ring.style.opacity = '0';
            this.particles.forEach(p => p.style.opacity = '0');
        });

        document.addEventListener('mouseenter', () => {
            if (this.cursor) this.cursor.style.opacity = '1';
            if (this.ring) this.ring.style.opacity = '0.5';
        });

        if (options.hoverElements) {
            document.querySelectorAll(options.hoverElements).forEach(el => {
                el.addEventListener('mouseenter', () => {
                    this.cursor?.classList.add('hover');
                    this.ring?.classList.add('hover');
                });
                el.addEventListener('mouseleave', () => {
                    this.cursor?.classList.remove('hover');
                    this.ring?.classList.remove('hover');
                });
            });
        }
    },

    animate() {
        this.cursorPos.x += (this.mouse.x - this.cursorPos.x) * 0.15;
        this.cursorPos.y += (this.mouse.y - this.cursorPos.y) * 0.15;

        if (this.cursor) {
            this.cursor.style.left = this.cursorPos.x + 'px';
            this.cursor.style.top = this.cursorPos.y + 'px';
        }

        this.ringPos.x += (this.mouse.x - this.ringPos.x) * 0.08;
        this.ringPos.y += (this.mouse.y - this.ringPos.y) * 0.08;

        if (this.ring) {
            this.ring.style.left = this.ringPos.x + 'px';
            this.ring.style.top = this.ringPos.y + 'px';
        }

        this.particles.forEach((particle, i) => {
            const delay = (i + 1) * 0.05;
            this.particlePositions[i].x += (this.mouse.x - this.particlePositions[i].x) * delay;
            this.particlePositions[i].y += (this.mouse.y - this.particlePositions[i].y) * delay;

            particle.style.left = this.particlePositions[i].x + 'px';
            particle.style.top = this.particlePositions[i].y + 'px';
            particle.style.opacity = 0.25 - (i * 0.04);
            particle.style.transform = `translate(-50%, -50%) scale(${1 - i * 0.15})`;
        });

        requestAnimationFrame(() => this.animate());
    },

    handleTrailParticles(x, y) {
        const dx = x - this.lastPos.x;
        const dy = y - this.lastPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) {
            this.createParticle(x, y);
            this.lastPos.x = x;
            this.lastPos.y = y;
        }
    },

    createParticle(x, y) {
        if (this.particleCount >= this.maxParticles) return;

        const particle = document.createElement('div');
        particle.className = 'particle';

        const offsetX = (Math.random() - 0.5) * 10;
        const offsetY = (Math.random() - 0.5) * 10;
        particle.style.left = (x + offsetX) + 'px';
        particle.style.top = (y + offsetY) + 'px';

        const size = 2 + Math.random() * 4;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';

        document.body.appendChild(particle);
        this.particleCount++;

        setTimeout(() => {
            particle.remove();
            this.particleCount--;
        }, 1000);
    },

    setVisible(visible) {
        const display = visible ? 'block' : 'none';
        if (this.cursor) this.cursor.style.display = display;
        if (this.ring) this.ring.style.display = display;
        this.particles.forEach(p => p.style.display = display);
        document.body.style.cursor = visible ? 'none' : 'pointer';
    }
};

window.Cursor = Cursor;