// Hand Gesture Control
// Index fingertip (landmark 8) controls cursor position
// Preview shows green connections + red landmark dots (MediaPipe style)
// Gestures: 2 fingers = click, 3 fingers = exit, thumbs up = confetti

const HandControl = {
    video: null,
    hands: null,
    camera: null,
    isActive: false,
    isReady: false,

    // preview canvas
    preview: null,
    previewCtx: null,

    // smoothed cursor
    smoothX: 0,
    smoothY: 0,

    // gesture state
    lastGesture: null,
    holdFrames: 0,
    holdThreshold: 4,
    lastClickTime: 0,

    onExit: null,

    // MediaPipe hand connections (matches official diagram exactly)
    CONNECTIONS: [
        // Thumb
        [0, 1], [1, 2], [2, 3], [3, 4],
        // Index finger
        [0, 5], [5, 6], [6, 7], [7, 8],
        // Middle finger
        [0, 9], [9, 10], [10, 11], [11, 12],
        // Ring finger
        [0, 13], [13, 14], [14, 15], [15, 16],
        // Pinky
        [0, 17], [17, 18], [18, 19], [19, 20],
        // Palm
        [5, 9], [9, 13], [13, 17]
    ],

    async init() {
        // hidden video element
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', '');
        this.video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
        document.body.appendChild(this.video);

        // preview canvas — shows camera + hand skeleton
        this.preview = document.createElement('canvas');
        this.preview.width = 320;
        this.preview.height = 240;
        this.preview.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            height: 240px;
            border-radius: 14px;
            background: #000;
            border: 1px solid rgba(255,255,255,0.15);
            pointer-events: none;
            z-index: 9990;
            opacity: 0;
            transform: translateY(10px) scaleX(-1);
            transition: opacity 0.4s ease, transform 0.4s ease;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        `;
        document.body.appendChild(this.preview);
        this.previewCtx = this.preview.getContext('2d');

        // gesture label
        this.gestureLabel = document.createElement('div');
        this.gestureLabel.style.cssText = `
            position: fixed;
            top: 268px;
            right: 20px;
            padding: 6px 14px;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            font-family: 'Space Mono', monospace;
            font-size: 11px;
            letter-spacing: 1px;
            color: rgba(255,255,255,0.8);
            z-index: 9991;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
            text-align: center;
        `;
        document.body.appendChild(this.gestureLabel);

        // wait for MediaPipe
        if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
            this.isReady = true;
        } else {
            await this._waitForMediaPipe();
        }

        return this;
    },

    _waitForMediaPipe() {
        return new Promise((resolve) => {
            let tries = 0;
            const poll = () => {
                if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
                    this.isReady = true;
                    resolve();
                } else if (tries++ < 50) {
                    setTimeout(poll, 150);
                } else {
                    resolve();
                }
            };
            poll();
        });
    },

    // ── Start / Stop ───────────────────────────────────────

    async start() {
        if (!this.isReady) throw new Error('MediaPipe not loaded');
        if (this.isActive) return;

        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((r) => this._onResults(r));

        this.camera = new Camera(this.video, {
            onFrame: async () => {
                if (this.hands && this.isActive) {
                    await this.hands.send({ image: this.video });
                }
            },
            width: 640,
            height: 480
        });

        await this.camera.start();
        this.isActive = true;

        // show preview
        this.preview.style.opacity = '1';
        this.preview.style.transform = 'translateY(0) scaleX(-1)';
        this.gestureLabel.style.opacity = '1';
        this.gestureLabel.textContent = '👀 TRACKING';

        // switch cursor to hand mode
        if (window.Cursor) {
            Cursor.setInputSource('hand');
        }
    },

    stop() {
        if (this.camera) { this.camera.stop(); this.camera = null; }
        if (this.hands) { this.hands.close(); this.hands = null; }

        this.isActive = false;
        this.lastGesture = null;
        this.holdFrames = 0;

        // hide preview
        this.preview.style.opacity = '0';
        this.preview.style.transform = 'translateY(10px) scaleX(-1)';
        this.gestureLabel.style.opacity = '0';

        // restore mouse cursor
        if (window.Cursor) {
            Cursor.setInputSource('mouse');
        }

        if (this.onExit) this.onExit();
    },

    // ── Frame Results ──────────────────────────────────────

    _onResults(results) {
        const ctx = this.previewCtx;
        const pw = this.preview.width;
        const ph = this.preview.height;

        // draw camera image
        ctx.clearRect(0, 0, pw, ph);
        if (results.image) {
            ctx.drawImage(results.image, 0, 0, pw, ph);
        }

        // no hand detected
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            this.lastGesture = null;
            this.holdFrames = 0;
            this._setLabel('👋 SHOW HAND');

            // dim overlay
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(0, 0, pw, ph);
            return;
        }

        const lm = results.multiHandLandmarks[0];

        // ── Draw hand skeleton (MediaPipe style: green lines + red dots) ──
        this._drawHand(ctx, lm, pw, ph);

        // ── Move cursor to index fingertip (landmark 8) ──
        // Mirror X so moving hand right moves cursor right
        const rawX = (1 - lm[8].x) * window.innerWidth;
        const rawY = lm[8].y * window.innerHeight;

        // smooth it
        this.smoothX += (rawX - this.smoothX) * 0.3;
        this.smoothY += (rawY - this.smoothY) * 0.3;

        // send to cursor system
        if (window.Cursor) {
            Cursor.setHandPosition(this.smoothX, this.smoothY);

            // check if hovering over clickable element
            const el = document.elementFromPoint(this.smoothX, this.smoothY);
            const hoverable = el && el.closest('.nav-link, a, button, [data-toggle]');
            Cursor.setHover(!!hoverable);
        }

        // ── Detect gesture ──
        const gesture = this._classify(lm);
        this._processGesture(gesture);
    },

    // ── Draw Hand (MediaPipe style) ────────────────────────

    _drawHand(ctx, lm, w, h) {
        // GREEN connections (like the official MediaPipe demo)
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        for (const [a, b] of this.CONNECTIONS) {
            const ax = lm[a].x * w, ay = lm[a].y * h;
            const bx = lm[b].x * w, by = lm[b].y * h;

            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }

        // RED landmark dots (like official MediaPipe)
        for (let i = 0; i < lm.length; i++) {
            const x = lm[i].x * w;
            const y = lm[i].y * h;

            // index fingertip gets special treatment (bigger, bright green)
            if (i === 8) {
                // outer glow
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 255, 100, 0.3)';
                ctx.fill();

                // inner dot
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#00FF66';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else {
                // all other landmarks: red dots
                ctx.beginPath();
                ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = '#FF0000';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }
    },

    // ── Gesture Classification ─────────────────────────────

    _classify(lm) {
        // Use tip Y vs PIP Y (the joint below the tip)
        // If tip is above (lower Y) the PIP joint, finger is extended
        // This matches the MediaPipe landmark model:
        //   Index:  tip=8,  pip=6
        //   Middle: tip=12, pip=10
        //   Ring:   tip=16, pip=14
        //   Pinky:  tip=20, pip=18

        const fingerUp = (tip, pip) => lm[tip].y < lm[pip].y;

        const index  = fingerUp(8, 6);
        const middle = fingerUp(12, 10);
        const ring   = fingerUp(16, 14);
        const pinky  = fingerUp(20, 18);

        const upCount = [index, middle, ring, pinky].filter(Boolean).length;

        // 3 fingers: index + middle + ring (exit)
        if (index && middle && ring && !pinky) return 'three';

        // 2 fingers: index + middle only (click)
        if (index && middle && !ring && !pinky) return 'two';

        // Point: just index
        if (index && !middle && !ring && !pinky) return 'point';

        // Open palm: all fingers
        if (upCount >= 4) return 'palm';

        return null;
    },

    _processGesture(gesture) {
        // debounce: require same gesture for N frames
        if (gesture === this.lastGesture) {
            this.holdFrames++;
        } else {
            this.lastGesture = gesture;
            this.holdFrames = 1;
        }

        // update label immediately for visual feedback
        const labels = {
            two: '✌️ CLICK',
            three: '🤟 EXIT',
            thumbsup: '👍 NICE',
            point: '☝️ POINTING',
            palm: '✋ OPEN PALM'
        };
        this._setLabel(labels[gesture] || '👀 TRACKING');

        // only fire action once when threshold is hit
        if (this.holdFrames !== this.holdThreshold) return;

        const now = Date.now();

        switch (gesture) {
            case 'two':
                if (now - this.lastClickTime > 700) {
                    this._doClick();
                    this.lastClickTime = now;
                }
                break;

            case 'three':
                this.stop();
                break;
        }
    },

    _setLabel(text) {
        if (this.gestureLabel) {
            this.gestureLabel.textContent = text;
        }
    },

    // ── Actions ────────────────────────────────────────────

    _doClick() {
        if (window.Cursor) Cursor.triggerClick();

        const el = document.elementFromPoint(this.smoothX, this.smoothY);
        if (!el) return;

        const clickable = el.closest('a, button, [data-toggle], .nav-link');
        if (clickable) {
            clickable.click();
            this._ripple(this.smoothX, this.smoothY);
        }
    },

    _ripple(x, y) {
        const r = document.createElement('div');
        r.style.cssText = `
            position:fixed; left:${x}px; top:${y}px;
            width:24px; height:24px;
            border:2px solid #00FF66;
            border-radius:50%;
            pointer-events:none; z-index:10000;
            transform:translate(-50%,-50%) scale(1); opacity:1;
        `;
        document.body.appendChild(r);
        r.animate([
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
            { transform: 'translate(-50%,-50%) scale(3.5)', opacity: 0 }
        ], { duration: 450, easing: 'ease-out' });
        setTimeout(() => r.remove(), 500);
    },

    _doConfetti() {
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

        for (let i = 0; i < 70; i++) {
            const p = document.createElement('div');
            const c = colors[Math.floor(Math.random() * colors.length)];
            const s = 4 + Math.random() * 8;
            const drift = (Math.random() - 0.5) * 250;

            p.style.cssText = `
                position:fixed;
                width:${s}px; height:${s}px;
                background:${c};
                left:${Math.random() * 100}vw; top:-12px;
                pointer-events:none; z-index:10000;
                border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
            `;
            document.body.appendChild(p);

            p.animate([
                { transform: 'translateY(0) translateX(0) rotate(0deg)', opacity: 1 },
                { transform: `translateY(${window.innerHeight + 50}px) translateX(${drift}px) rotate(${Math.random() * 600}deg)`, opacity: 0 }
            ], {
                duration: 2000 + Math.random() * 1000,
                delay: Math.random() * 400,
                easing: 'cubic-bezier(.2,.6,.4,1)',
                fill: 'forwards'
            }).onfinish = () => p.remove();
        }
    }
};

window.HandControl = HandControl;