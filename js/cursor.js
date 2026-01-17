// cursor module - with hand control support

const Cursor = {
    cursor: null,
    ring: null,
    particles: [],

    // position tracking
    mouse: { x: 0, y: 0 },
    cursorPos: { x: 0, y: 0 },
    ringPos: { x: 0, y: 0 },
    particlePositions: [],

    // input source: 'mouse' or 'hand'
    inputSource: 'mouse',
    handPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },

    // trail particles
    particleCount: 0,
    maxParticles: 50,
    lastPos: { x: 0, y: 0 },

    // state
    isVisible: true,
    isHovering: false,

    init(options = {}) {
        this.cursor = document.querySelector('.cursor');
        this.ring = document.querySelector('.cursor-ring');
        this.particles = document.querySelectorAll('.cursor-particle');

        if (this.particles.length) {
            this.particlePositions = Array(this.particles.length).fill().map(() => ({ x: 0, y: 0 }));
        }

        // set initial position
        this.cursorPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.ringPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

        this.bindEvents(options);
        this.animate();
    },

    bindEvents(options = {}) {
        document.addEventListener('mousemove', (e) => {
            if (this.inputSource !== 'mouse') return;

            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;

            // particle trail
            if (options.trailParticles) {
                this.handleTrailParticles(e.clientX, e.clientY);
            }
        });

        document.addEventListener('mouseleave', () => {
            if (this.inputSource !== 'mouse') return;
            if (this.cursor) this.cursor.style.opacity = '0';
            if (this.ring) this.ring.style.opacity = '0';
        });

        document.addEventListener('mouseenter', () => {
            if (this.inputSource !== 'mouse') return;
            if (this.cursor) this.cursor.style.opacity = '1';
            if (this.ring) this.ring.style.opacity = '0.6';
        });

        // hover effects
        if (options.hoverElements) {
            document.querySelectorAll(options.hoverElements).forEach(el => {
                el.addEventListener('mouseenter', () => this.setHover(true));
                el.addEventListener('mouseleave', () => this.setHover(false));
            });
        }
    },

    // called by hand control to update position
    setHandPosition(x, y) {
        this.handPos.x = x;
        this.handPos.y = y;
    },

    // switch input source
    setInputSource(source) {
        this.inputSource = source;
        console.log('Cursor input:', source);

        if (source === 'hand') {
            // show cursor
            if (this.cursor) {
                this.cursor.style.display = 'block';
                this.cursor.style.opacity = '1';
            }
            if (this.ring) {
                this.ring.style.display = 'block';
                this.ring.style.opacity = '0.6';
            }
            // initialize hand position to center
            this.handPos.x = window.innerWidth / 2;
            this.handPos.y = window.innerHeight / 2;
        } else {
            // mouse mode - cursor follows mouse
            if (this.cursor) {
                this.cursor.style.display = 'block';
                this.cursor.style.opacity = '1';
            }
            if (this.ring) {
                this.ring.style.display = 'block';
                this.ring.style.opacity = '0.6';
            }
        }
    },

    // set hover state
    setHover(hovering) {
        this.isHovering = hovering;
        if (hovering) {
            this.cursor?.classList.add('hover');
            this.ring?.classList.add('hover');
        } else {
            this.cursor?.classList.remove('hover');
            this.ring?.classList.remove('hover');
        }
    },

    // trigger click animation
    triggerClick() {
        if (this.cursor) {
            this.cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
            setTimeout(() => {
                this.cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 150);
        }
        if (this.ring) {
            this.ring.style.transform = 'translate(-50%, -50%) scale(1.5)';
            this.ring.style.opacity = '0';
            setTimeout(() => {
                this.ring.style.transform = 'translate(-50%, -50%) scale(1)';
                this.ring.style.opacity = '0.6';
            }, 200);
        }
    },

    animate() {
        // get target position based on input source
        const targetX = this.inputSource === 'hand' ? this.handPos.x : this.mouse.x;
        const targetY = this.inputSource === 'hand' ? this.handPos.y : this.mouse.y;

        // smooth cursor
        this.cursorPos.x += (targetX - this.cursorPos.x) * 0.15;
        this.cursorPos.y += (targetY - this.cursorPos.y) * 0.15;

        if (this.cursor) {
            this.cursor.style.left = this.cursorPos.x + 'px';
            this.cursor.style.top = this.cursorPos.y + 'px';
        }

        // slower ring
        this.ringPos.x += (targetX - this.ringPos.x) * 0.08;
        this.ringPos.y += (targetY - this.ringPos.y) * 0.08;

        if (this.ring) {
            this.ring.style.left = this.ringPos.x + 'px';
            this.ring.style.top = this.ringPos.y + 'px';
        }

        // trailing particles
        this.particles.forEach((particle, i) => {
            const delay = (i + 1) * 0.05;
            this.particlePositions[i].x += (targetX - this.particlePositions[i].x) * delay;
            this.particlePositions[i].y += (targetY - this.particlePositions[i].y) * delay;

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
        this.isVisible = visible;
        const display = visible ? 'block' : 'none';
        if (this.cursor) this.cursor.style.display = display;
        if (this.ring) this.ring.style.display = display;
        this.particles.forEach(p => p.style.display = display);
        document.body.style.cursor = visible ? 'none' : 'default';
    },

    // get current cursor position
    getPosition() {
        return { x: this.cursorPos.x, y: this.cursorPos.y };
    }
};

window.Cursor = Cursor;