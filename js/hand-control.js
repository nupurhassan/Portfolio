// Hand Gesture Control Module
// Uses angle-based detection for better accuracy (inspired by kinivi/hand-gesture-recognition-mediapipe)
// Gestures: Palm (scroll), 2 fingers (click), 3 fingers (exit), Middle finger (easter egg), Thumbs up (confetti), Rock (theme)

const HandControl = {
    video: null,
    canvas: null,
    ctx: null,
    hands: null,
    camera: null,
    gestureIndicator: null,
    
    isActive: false,
    isReady: false,
    
    smoothPos: { x: 0.5, y: 0.5 },
    
    gesture: {
        current: null,
        previous: null,
        startTime: 0,
        scrollLastY: 0,
        scrollVelocity: 0,
        lastClickTime: 0,
        lastEasterEggTime: 0
    },
    
    smoothing: {
        x: [],
        y: [],
        maxSamples: 8
    },
    
    config: {
        scrollSensitivity: 3,
        scrollDeadzone: 0.015,
        scrollMaxSpeed: 25
    },
    
    onExit: null,

    async init(options = {}) {
        Object.assign(this.config, options.config || {});
        this.createElements();
        
        if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
            this.isReady = true;
        } else {
            await this.waitForMediaPipe();
        }
        
        return this;
    },

    waitForMediaPipe() {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
                if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
                    this.isReady = true;
                    resolve();
                } else if (attempts < 50) {
                    attempts++;
                    setTimeout(check, 100);
                } else {
                    resolve();
                }
            };
            check();
        });
    },

    createElements() {
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', '');
        this.video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
        document.body.appendChild(this.video);

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'hand-preview';
        this.canvas.width = 160;
        this.canvas.height = 120;
        this.canvas.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            width: 160px;
            height: 120px;
            border-radius: 12px;
            opacity: 0;
            pointer-events: none;
            z-index: 9990;
            transition: opacity 0.3s ease;
            transform: scaleX(-1);
            background: rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.1);
        `;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.gestureIndicator = document.createElement('div');
        this.gestureIndicator.id = 'gesture-indicator';
        this.gestureIndicator.style.cssText = `
            position: fixed;
            top: 180px;
            right: 20px;
            padding: 8px 16px;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            font-family: 'Space Mono', monospace;
            font-size: 11px;
            letter-spacing: 1px;
            color: rgba(255,255,255,0.8);
            opacity: 0;
            pointer-events: none;
            z-index: 9991;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(this.gestureIndicator);
    },

    async start() {
        if (!this.isReady) throw new Error('MediaPipe not ready');
        if (this.isActive) return;

        try {
            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,  // Full model for better accuracy
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => this.onResults(results));

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            stream.getTracks().forEach(track => track.stop());

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
            
            this.canvas.style.opacity = '0.9';
            this.gestureIndicator.style.opacity = '1';
            
            if (window.Cursor) Cursor.setInputSource('hand');
            
        } catch (err) {
            console.error('HandControl: Failed', err);
            throw err;
        }
    },

    stop() {
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }
        if (this.hands) {
            this.hands.close();
            this.hands = null;
        }
        
        this.isActive = false;
        this.canvas.style.opacity = '0';
        this.gestureIndicator.style.opacity = '0';
        
        this.gesture.current = null;
        this.gesture.scrollVelocity = 0;
        this.smoothing.x = [];
        this.smoothing.y = [];
        
        if (window.Cursor) Cursor.setInputSource('mouse');
        if (this.onExit) this.onExit();
    },

    onResults(results) {
        if (!this.ctx) return;
        
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.image) {
            this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            this.drawHand(landmarks);
            this.updateCursorPosition(landmarks[8].x, landmarks[8].y);
            
            const gesture = this.detectGesture(landmarks);
            this.processGesture(gesture, landmarks);
        } else {
            if (this.gesture.current) {
                this.gesture.previous = this.gesture.current;
                this.gesture.current = null;
                this.updateGestureIndicator(null);
            }
        }

        this.ctx.restore();
    },

    updateCursorPosition(x, y) {
        this.smoothing.x.push(x);
        this.smoothing.y.push(y);
        if (this.smoothing.x.length > this.smoothing.maxSamples) this.smoothing.x.shift();
        if (this.smoothing.y.length > this.smoothing.maxSamples) this.smoothing.y.shift();
        
        const smoothX = this.smoothing.x.reduce((a, b) => a + b, 0) / this.smoothing.x.length;
        const smoothY = this.smoothing.y.reduce((a, b) => a + b, 0) / this.smoothing.y.length;
        
        this.smoothPos.x += (smoothX - this.smoothPos.x) * 0.4;
        this.smoothPos.y += (smoothY - this.smoothPos.y) * 0.4;
        
        const screenX = (1 - this.smoothPos.x) * window.innerWidth;
        const screenY = this.smoothPos.y * window.innerHeight;
        
        if (window.Cursor) Cursor.setHandPosition(screenX, screenY);
        this.checkHover(screenX, screenY);
    },

    checkHover(x, y) {
        const element = document.elementFromPoint(x, y);
        const isHoverable = element?.closest('.nav-link, a, button, [data-toggle]');
        if (window.Cursor) Cursor.setHover(!!isHoverable);
    },

    // ANGLE-BASED GESTURE DETECTION - Much more accurate!
    detectGesture(landmarks) {
        // Helper: Calculate angle at point p2 between vectors p1->p2 and p2->p3
        const getAngle = (p1, p2, p3) => {
            const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: (p1.z || 0) - (p2.z || 0) };
            const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: (p3.z || 0) - (p2.z || 0) };
            
            const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
            const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
            const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
            
            if (mag1 === 0 || mag2 === 0) return 180;
            
            const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
            return Math.acos(cosAngle) * (180 / Math.PI);
        };
        
        // Helper: Calculate distance between two points
        const getDistance = (p1, p2) => {
            return Math.sqrt(
                Math.pow(p1.x - p2.x, 2) + 
                Math.pow(p1.y - p2.y, 2) + 
                Math.pow((p1.z || 0) - (p2.z || 0), 2)
            );
        };
        
        // Palm width for reference
        const palmWidth = getDistance(landmarks[5], landmarks[17]);
        
        // Check if a finger is extended using angle at PIP joint
        const isFingerExtended = (mcp, pip, dip, tip) => {
            const anglePIP = getAngle(landmarks[mcp], landmarks[pip], landmarks[dip]);
            const angleDIP = getAngle(landmarks[pip], landmarks[dip], landmarks[tip]);
            const tipToMcp = getDistance(landmarks[tip], landmarks[mcp]);
            
            // Extended if PIP angle > 155° (straight) OR tip is far from MCP
            const isAngleStraight = anglePIP > 155;
            const isTipFar = tipToMcp > palmWidth * 0.7;
            
            return isAngleStraight || isTipFar;
        };
        
        // Thumb detection (different anatomy)
        const isThumbExtended = () => {
            const thumbTip = landmarks[4];
            const indexMCP = landmarks[5];
            const thumbSpread = getDistance(thumbTip, indexMCP);
            return thumbSpread > palmWidth * 0.5;
        };
        
        // Thumb pointing up detection
        const isThumbUp = () => {
            const thumbTip = landmarks[4];
            const thumbMCP = landmarks[2];
            const wrist = landmarks[0];
            return thumbTip.y < thumbMCP.y - 0.06 && thumbTip.y < wrist.y - 0.08;
        };
        
        // Detect each finger
        const indexExtended = isFingerExtended(5, 6, 7, 8);
        const middleExtended = isFingerExtended(9, 10, 11, 12);
        const ringExtended = isFingerExtended(13, 14, 15, 16);
        const pinkyExtended = isFingerExtended(17, 18, 19, 20);
        const thumbUp = isThumbUp();
        
        const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

        // Debug log occasionally
        if (Math.random() < 0.03) {
            console.log('Fingers:', { 
                I: indexExtended ? '☝️' : '✊', 
                M: middleExtended ? '🖕' : '✊', 
                R: ringExtended ? '💍' : '✊', 
                P: pinkyExtended ? '🤙' : '✊',
                count: extendedCount,
                thumbUp
            });
        }

        // === GESTURE CLASSIFICATION (most specific first) ===
        
        // THUMBS UP: thumb up, all fingers curled 👍
        if (thumbUp && extendedCount === 0) {
            return 'thumbsup';
        }

        // MIDDLE FINGER ONLY = Easter egg 🖕
        // Extra strict: middle must be extended AND others must be clearly curled
        const middleTip = landmarks[12];
        const middleMcp = landmarks[9];
        const indexTip = landmarks[8];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        const wrist = landmarks[0];
        
        const middleClearlyUp = middleExtended && (middleTip.y < middleMcp.y - 0.05);
        const indexDown = !indexExtended && (indexTip.y > landmarks[6].y);
        const ringDown = !ringExtended && (ringTip.y > landmarks[14].y);
        const pinkyDown = !pinkyExtended && (pinkyTip.y > landmarks[18].y);
        
        if (middleClearlyUp && indexDown && ringDown && pinkyDown) {
            return 'middle';
        }

        // ROCK: index + pinky only 🤘
        if (indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
            return 'rock';
        }

        // THREE FINGERS: index + middle + ring (no pinky) = Exit
        if (indexExtended && middleExtended && ringExtended && !pinkyExtended) {
            return 'three';
        }

        // TWO FINGERS: index + middle = Click ✌️
        if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
            return 'two';
        }

        // POINT: just index ☝️
        if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return 'point';
        }

        // PALM: 4 fingers extended = Scroll ✋
        if (extendedCount >= 4) {
            return 'palm';
        }

        // FIST: nothing extended ✊
        if (extendedCount === 0 && !thumbUp) {
            return 'fist';
        }

        return null;
    },

    processGesture(gesture, landmarks) {
        const now = Date.now();
        const prevGesture = this.gesture.current;
        
        if (gesture !== prevGesture) {
            this.gesture.previous = prevGesture;
            this.gesture.current = gesture;
            this.gesture.startTime = now;
            
            if (prevGesture === 'palm') {
                this.gesture.scrollVelocity = 0;
            }
        }

        switch (gesture) {
            case 'palm':
                this.handlePalmScroll(landmarks);
                break;
                
            case 'middle':
                if (prevGesture !== 'middle' && now - this.gesture.lastEasterEggTime > 10000) {
                    this.triggerBoxBreathing();
                    this.gesture.lastEasterEggTime = now;
                }
                break;
                
            case 'three':
                if (prevGesture !== 'three') {
                    this.handleThreeFingerExit();
                }
                break;
                
            case 'two':
                if (now - this.gesture.lastClickTime > 500) {
                    this.triggerClick();
                    this.gesture.lastClickTime = now;
                }
                break;
                
            case 'thumbsup':
                if (prevGesture !== 'thumbsup') {
                    this.triggerThumbsUp();
                }
                break;
                
            case 'rock':
                if (prevGesture !== 'rock') {
                    this.triggerRock();
                }
                break;
        }

        this.updateGestureIndicator(gesture);
    },

    handlePalmScroll(landmarks) {
        const indexY = landmarks[8].y;
        
        if (this.gesture.previous !== 'palm') {
            this.gesture.scrollLastY = indexY;
        } else {
            const deltaY = indexY - this.gesture.scrollLastY;
            
            if (Math.abs(deltaY) > this.config.scrollDeadzone) {
                let scrollAmount = deltaY * this.config.scrollSensitivity * 100;
                scrollAmount = Math.max(-this.config.scrollMaxSpeed, Math.min(this.config.scrollMaxSpeed, scrollAmount));
                
                this.gesture.scrollVelocity = this.gesture.scrollVelocity * 0.7 + scrollAmount * 0.3;
                window.scrollBy(0, this.gesture.scrollVelocity);
            }
            
            this.gesture.scrollLastY = indexY;
        }
    },

    handleThreeFingerExit() {
        console.log('HandControl: 3 fingers - exiting');
        this.stop();
    },

    triggerClick() {
        console.log('HandControl: 2 fingers - CLICK');
        
        if (window.Cursor) Cursor.triggerClick();
        
        const pos = window.Cursor ? Cursor.getPosition() : { x: 0, y: 0 };
        const element = document.elementFromPoint(pos.x, pos.y);
        
        if (element) {
            const clickable = element.closest('a, button, [data-toggle], .nav-link');
            if (clickable) clickable.click();
        }
    },

    triggerThumbsUp() {
        console.log('HandControl: THUMBS UP - confetti!');
        this.createConfetti();
    },

    triggerRock() {
        console.log('HandControl: ROCK - theme!');
        
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        if (window.Theme) {
            Theme.set(newTheme);
            document.querySelectorAll('[data-toggle="theme"]').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.value === newTheme);
            });
        }
        
        this.playSound(523);
    },

    triggerBoxBreathing() {
        console.log('HandControl: Middle finger - BOX BREATHING');
        this.showBoxBreathing();
    },

    showBoxBreathing() {
        const overlay = document.createElement('div');
        overlay.id = 'box-breathing-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: #000;
            z-index: 100000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 1s ease;
        `;
        
        overlay.innerHTML = `
            <div class="breath-intro" style="text-align: center; color: #fff; font-family: 'Syne', sans-serif;">
                <p style="font-size: 18px; letter-spacing: 3px; margin-bottom: 20px; opacity: 0.7;">take a deep breath</p>
                <p style="font-size: 14px; letter-spacing: 2px; opacity: 0.5;">you found an easter egg</p>
            </div>
            
            <div class="breath-box" style="margin-top: 60px; position: relative; width: 200px; height: 200px; opacity: 0;">
                <svg width="200" height="200" style="position: absolute; top: 0; left: 0;">
                    <rect x="10" y="10" width="180" height="180" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" rx="10"/>
                    <rect id="breath-progress" x="10" y="10" width="180" height="180" fill="none" stroke="#fff" stroke-width="2" rx="10" stroke-dasharray="720" stroke-dashoffset="720"/>
                </svg>
                <div id="breath-circle" style="position: absolute; top: 50%; left: 50%; width: 40px; height: 40px; background: rgba(255,255,255,0.1); border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%) scale(1); transition: transform 4s ease-in-out;"></div>
            </div>
            
            <p id="breath-instruction" style="margin-top: 40px; font-family: 'Space Mono', monospace; font-size: 14px; letter-spacing: 4px; color: #fff; opacity: 0; text-transform: uppercase;">breathe in</p>
            <p id="breath-counter" style="margin-top: 20px; font-family: 'Syne', sans-serif; font-size: 48px; color: #fff; opacity: 0;">4</p>
            
            <button id="breath-skip" style="position: absolute; bottom: 40px; background: none; border: 1px solid rgba(255,255,255,0.3); color: rgba(255,255,255,0.5); padding: 10px 24px; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 2px; cursor: pointer; border-radius: 20px; transition: all 0.3s ease;">SKIP</button>
        `;
        
        document.body.appendChild(overlay);
        
        const skipBtn = overlay.querySelector('#breath-skip');
        skipBtn.addEventListener('click', () => this.closeBoxBreathing(overlay));
        
        requestAnimationFrame(() => overlay.style.opacity = '1');
        
        setTimeout(() => {
            const intro = overlay.querySelector('.breath-intro');
            const box = overlay.querySelector('.breath-box');
            const instruction = overlay.querySelector('#breath-instruction');
            const counter = overlay.querySelector('#breath-counter');
            
            intro.style.transition = 'opacity 1s ease';
            intro.style.opacity = '0';
            
            setTimeout(() => {
                intro.style.display = 'none';
                box.style.transition = 'opacity 1s ease';
                box.style.opacity = '1';
                instruction.style.transition = 'opacity 0.5s ease';
                instruction.style.opacity = '1';
                counter.style.transition = 'opacity 0.5s ease';
                counter.style.opacity = '1';
                
                this.runBoxBreathingCycles(overlay, 5);
            }, 1000);
        }, 3000);
    },

    runBoxBreathingCycles(overlay, cycles) {
        const circle = overlay.querySelector('#breath-circle');
        const instruction = overlay.querySelector('#breath-instruction');
        const counter = overlay.querySelector('#breath-counter');
        const progress = overlay.querySelector('#breath-progress');
        
        const phases = [
            { text: 'BREATHE IN', scale: 2.5, offset: 540 },
            { text: 'HOLD', scale: 2.5, offset: 360 },
            { text: 'BREATHE OUT', scale: 1, offset: 180 },
            { text: 'HOLD', scale: 1, offset: 0 }
        ];
        
        let currentCycle = 0;
        let currentPhase = 0;
        
        const runPhase = () => {
            if (currentCycle >= cycles) {
                this.completeBoxBreathing(overlay);
                return;
            }
            
            const phase = phases[currentPhase];
            instruction.textContent = phase.text;
            circle.style.transform = `translate(-50%, -50%) scale(${phase.scale})`;
            progress.style.transition = 'stroke-dashoffset 4s linear';
            progress.style.strokeDashoffset = phase.offset;
            
            let count = 4;
            counter.textContent = count;
            
            const countInterval = setInterval(() => {
                count--;
                if (count > 0) counter.textContent = count;
                else clearInterval(countInterval);
            }, 1000);
            
            setTimeout(() => {
                currentPhase++;
                if (currentPhase >= phases.length) {
                    currentPhase = 0;
                    currentCycle++;
                }
                runPhase();
            }, 4000);
        };
        
        progress.style.strokeDashoffset = '720';
        runPhase();
    },

    completeBoxBreathing(overlay) {
        const box = overlay.querySelector('.breath-box');
        const instruction = overlay.querySelector('#breath-instruction');
        const counter = overlay.querySelector('#breath-counter');
        
        box.style.opacity = '0';
        instruction.style.opacity = '0';
        counter.style.opacity = '0';
        
        setTimeout(() => {
            const complete = document.createElement('div');
            complete.style.cssText = 'text-align: center; color: #fff; font-family: "Syne", sans-serif;';
            complete.innerHTML = `
                <p style="font-size: 24px; letter-spacing: 2px; margin-bottom: 20px;">well done</p>
                <p style="font-size: 14px; letter-spacing: 3px; opacity: 0.6;">feel centered</p>
            `;
            overlay.insertBefore(complete, overlay.querySelector('#breath-skip'));
            
            setTimeout(() => this.closeBoxBreathing(overlay), 3000);
        }, 1000);
    },

    closeBoxBreathing(overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 1000);
    },

    createConfetti() {
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        
        for (let i = 0; i < 80; i++) {
            const confetti = document.createElement('div');
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() * 10 + 5;
            
            confetti.style.cssText = `
                position: fixed;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                left: ${Math.random() * 100}vw;
                top: -20px;
                pointer-events: none;
                z-index: 10000;
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            `;
            
            document.body.appendChild(confetti);
            
            confetti.animate([
                { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                { transform: `translateY(${window.innerHeight + 50}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 }
            ], {
                duration: (Math.random() * 2 + 2) * 1000,
                delay: Math.random() * 500,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fill: 'forwards'
            }).onfinish = () => confetti.remove();
        }
    },

    playSound(freq) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.value = 0.1;
            
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) {}
    },

    updateGestureIndicator(gesture) {
        const labels = {
            palm: '✋ SCROLL',
            middle: '🖕 BREATHE',
            three: '🤟 EXIT',
            two: '✌️ CLICK',
            point: '☝️ POINT',
            thumbsup: '👍 NICE!',
            rock: '🤘 ROCK!',
            fist: '✊ FIST'
        };
        
        this.gestureIndicator.textContent = labels[gesture] || '👀 TRACKING';
    },

    drawHand(landmarks) {
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
        ];

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;

        connections.forEach(([i, j]) => {
            this.ctx.beginPath();
            this.ctx.moveTo(landmarks[i].x * this.canvas.width, landmarks[i].y * this.canvas.height);
            this.ctx.lineTo(landmarks[j].x * this.canvas.width, landmarks[j].y * this.canvas.height);
            this.ctx.stroke();
        });

        landmarks.forEach((point, i) => {
            this.ctx.beginPath();
            this.ctx.arc(point.x * this.canvas.width, point.y * this.canvas.height, i === 8 ? 4 : 2, 0, Math.PI * 2);
            this.ctx.fillStyle = i === 8 ? '#00ff88' : 'rgba(255, 255, 255, 0.7)';
            this.ctx.fill();
        });
    }
};

window.HandControl = HandControl;