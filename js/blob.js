(() => {
    const Blob = {
        canvas: null,
        ctx: null,

        dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
        w: 0,
        h: 0,

        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        acc: { x: 0, y: 0 },
        
        config: {
            follow: 0.018,
            damp: 0.92,
            baseRadius: 280,
            maxSpeed: 2000,
            stretchMax: 0.45,
            squashMax: 0.25,
            magneticRange: 500,
            magneticPull: 0.008
        },

        prevTarget: { x: 0, y: 0 },
        v: { x: 0, y: 0 },
        vSmooth: { x: 0, y: 0 },
        vFilter: 0.12,
        
        speedHistory: [],
        maxSpeedHistory: 10,
        
        trail: [],
        maxTrail: 8,

        time: 0,
        bornAt: performance.now(),
        startEaseMs: 800,

        colors: {
            dark: {
                primary: 'rgba(255, 255, 255, 0.25)',
                secondary: 'rgba(255, 255, 255, 0.15)',
                glow: 'rgba(255, 255, 255, 0.08)',
                core: 'rgba(255, 255, 255, 0.35)'
            },
            light: {
                primary: 'rgba(0, 0, 0, 0.30)',
                secondary: 'rgba(0, 0, 0, 0.18)',
                glow: 'rgba(0, 0, 0, 0.10)',
                core: 'rgba(0, 0, 0, 0.40)'
            }
        },
        currentTheme: 'dark',

        init(canvasId = 'blob-canvas', options = {}) {
            Object.assign(this.config, options);
            
            this.canvas = typeof canvasId === 'string' 
                ? document.getElementById(canvasId) 
                : canvasId;
                
            if (!this.canvas) return;
            
            this.ctx = this.canvas.getContext('2d', { alpha: true });

            this.resize();
            window.addEventListener('resize', () => this.resize(), { passive: true });

            this.pos.x = this.w * 0.72;
            this.pos.y = this.h * 0.46;
            this.prevTarget.x = this.pos.x;
            this.prevTarget.y = this.pos.y;
            
            for (let i = 0; i < this.maxTrail; i++) {
                this.trail.push({ x: this.pos.x, y: this.pos.y });
            }

            this.observeTheme();
            requestAnimationFrame((t) => this.frame(t));
        },

        resize() {
            this.w = window.innerWidth;
            this.h = window.innerHeight;

            this.canvas.style.width = this.w + 'px';
            this.canvas.style.height = this.h + 'px';

            this.canvas.width = Math.floor(this.w * this.dpr);
            this.canvas.height = Math.floor(this.h * this.dpr);

            const minSide = Math.min(this.w, this.h);
            this.config.baseRadius = Math.max(180, Math.min(420, minSide * 0.34));

            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        },

        observeTheme() {
            this.currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'data-theme') {
                        this.currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                    }
                });
            });
            
            observer.observe(document.documentElement, { attributes: true });
        },

        getCursorData() {
            const c = window.Cursor;
            if (c && typeof c === 'object') {
                const pos = c.ringPos || { x: this.w / 2, y: this.h / 2 };
                return { pos };
            }
            return { pos: { x: this.w / 2, y: this.h / 2 } };
        },

        clamp(x, min, max) {
            return Math.max(min, Math.min(max, x));
        },

        clamp01(x) {
            return this.clamp(x, 0, 1);
        },
        
        lerp(a, b, t) {
            return a + (b - a) * t;
        },

        frame(now) {
            if (!this._last) this._last = now;
            const dt = Math.max(0.001, Math.min(0.05, (now - this._last) / 1000));
            this._last = now;
            this.time = now;

            const { pos: cursorPos } = this.getCursorData();

            const rawVx = (cursorPos.x - this.prevTarget.x) / dt;
            const rawVy = (cursorPos.y - this.prevTarget.y) / dt;
            this.prevTarget.x = cursorPos.x;
            this.prevTarget.y = cursorPos.y;

            this.v.x += (rawVx - this.v.x) * this.vFilter;
            this.v.y += (rawVy - this.v.y) * this.vFilter;
            
            this.vSmooth.x += (this.v.x - this.vSmooth.x) * 0.08;
            this.vSmooth.y += (this.v.y - this.vSmooth.y) * 0.08;

            const speed = Math.sqrt(this.v.x * this.v.x + this.v.y * this.v.y);
            
            this.speedHistory.push(speed);
            if (this.speedHistory.length > this.maxSpeedHistory) {
                this.speedHistory.shift();
            }
            
            const speedN = this.clamp01(speed / this.config.maxSpeed);

            const easeIn = this.clamp01((now - this.bornAt) / this.startEaseMs);
            const ease = easeIn * easeIn * (3 - 2 * easeIn);

            const dx = cursorPos.x - this.pos.x;
            const dy = cursorPos.y - this.pos.y;
            const distToCursor = Math.sqrt(dx * dx + dy * dy);
            const magneticFactor = this.clamp01(1 - distToCursor / this.config.magneticRange);

            const followStrength = this.config.follow + magneticFactor * this.config.magneticPull + speedN * 0.01;
            this.acc.x = dx * followStrength;
            this.acc.y = dy * followStrength;
            
            this.vel.x += this.acc.x;
            this.vel.y += this.acc.y;
            this.vel.x *= this.config.damp;
            this.vel.y *= this.config.damp;

            this.pos.x += this.vel.x;
            this.pos.y += this.vel.y;
            
            this.trail.unshift({ x: this.pos.x, y: this.pos.y });
            if (this.trail.length > this.maxTrail) {
                this.trail.pop();
            }

            this.draw(speedN, magneticFactor, ease);

            requestAnimationFrame((n) => this.frame(n));
        },

        draw(speedN, magneticFactor, ease) {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.w, this.h);

            const colors = this.colors[this.currentTheme];
            const cx = this.pos.x;
            const cy = this.pos.y;
            const baseR = this.config.baseRadius;

            const moveAng = Math.atan2(this.vel.y, this.vel.x);
            
            const stretchAmount = speedN * this.config.stretchMax * ease;
            const squashAmount = speedN * this.config.squashMax * ease;
            
            const stretch = 1 + stretchAmount;
            const squash = 1 - squashAmount;

            ctx.save();
            ctx.filter = 'blur(50px)';
            const glowR = baseR * (1.4 + magneticFactor * 0.2);
            ctx.beginPath();
            this.drawEllipse(ctx, cx, cy, glowR, stretch * 0.7, squash * 0.7, moveAng);
            ctx.fillStyle = colors.glow;
            ctx.globalAlpha = 0.4 + magneticFactor * 0.2;
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.filter = 'blur(25px)';
            const secondaryR = baseR * 1.15;
            ctx.beginPath();
            this.drawEllipse(ctx, cx, cy, secondaryR, stretch * 0.85, squash * 0.85, moveAng);
            ctx.fillStyle = colors.secondary;
            ctx.globalAlpha = 0.6;
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.filter = 'blur(12px)';
            const primaryR = baseR;
            ctx.beginPath();
            this.drawEllipse(ctx, cx, cy, primaryR, stretch, squash, moveAng);
            ctx.fillStyle = colors.primary;
            ctx.globalAlpha = 1;
            ctx.fill();
            ctx.restore();

            if (magneticFactor > 0.15 || speedN > 0.1) {
                ctx.save();
                ctx.filter = 'blur(20px)';
                const coreR = baseR * 0.3 * (magneticFactor + speedN * 0.5);
                const coreStretch = 1 + stretchAmount * 0.5;
                const coreSquash = 1 - squashAmount * 0.5;
                ctx.beginPath();
                this.drawEllipse(ctx, cx, cy, coreR, coreStretch, coreSquash, moveAng);
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * Math.max(coreStretch, coreSquash));
                gradient.addColorStop(0, colors.core);
                gradient.addColorStop(1, 'transparent');
                ctx.fillStyle = gradient;
                ctx.globalAlpha = magneticFactor * 0.8 + speedN * 0.4;
                ctx.fill();
                ctx.restore();
            }

            if (speedN > 0.2) {
                this.drawMotionTrail(ctx, colors, baseR, stretch, squash, moveAng, speedN);
            }
        },

        drawEllipse(ctx, cx, cy, radius, stretchX, stretchY, angle) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.scale(stretchX, stretchY);
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.restore();
        },

        drawMotionTrail(ctx, colors, baseR, stretch, squash, moveAng, speedN) {
            const trailCount = Math.min(this.trail.length, Math.floor(speedN * 6) + 2);
            
            for (let i = 1; i < trailCount; i++) {
                const t = i / trailCount;
                const trailPos = this.trail[i];
                if (!trailPos) continue;
                
                const trailR = baseR * (1 - t * 0.4) * (1 - speedN * 0.3);
                const trailStretch = this.lerp(stretch, 1, t * 0.7);
                const trailSquash = this.lerp(squash, 1, t * 0.7);
                const trailAlpha = (1 - t) * 0.25 * speedN;
                
                ctx.save();
                ctx.filter = 'blur(' + (15 + t * 20) + 'px)';
                ctx.globalAlpha = trailAlpha;
                ctx.beginPath();
                this.drawEllipse(ctx, trailPos.x, trailPos.y, trailR, trailStretch, trailSquash, moveAng);
                ctx.fillStyle = colors.secondary;
                ctx.fill();
                ctx.restore();
            }
        },

        setTheme(theme) {
            this.currentTheme = theme;
        }
    };

    window.Blob = Blob;
})();