// hand gesture control module

const HandControl = {
    video: null,
    canvas: null,
    ctx: null,
    hands: null,
    camera: null,
    
    // hand cursor element
    handCursor: null,
    handCursorRing: null,
    
    // cursor position (screen coords)
    cursorPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    targetPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    
    isActive: false,
    isReady: false,
    
    // gesture state
    gesture: {
        current: null,
        previous: null,
        startY: 0,
        lastY: 0,
        velocity: 0
    },
    
    // smoothing
    smoothing: {
        positions: [],
        maxSamples: 5,
        cursorX: [],
        cursorY: []
    },
    
    // scroll config
    scroll: {
        sensitivity: 2.5,
        deadzone: 0.02,
        maxSpeed: 30
    },
    
    // callbacks
    onGestureStart: null,
    onGestureMove: null,
    onGestureEnd: null,
    onScroll: null,

    async init(options = {}) {
        Object.assign(this.scroll, options.scroll || {});
        this.onScroll = options.onScroll || null;
        
        this.createElements();
        
        // check if MediaPipe is loaded (from CDN in HTML head)
        if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
            this.isReady = true;
            console.log('HandControl: MediaPipe ready');
        } else {
            console.warn('HandControl: MediaPipe not loaded. Make sure CDN scripts are in HTML head.');
            // try waiting a bit for scripts to load
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
                    console.log('HandControl: MediaPipe loaded');
                    resolve();
                } else if (attempts < 50) {
                    attempts++;
                    setTimeout(check, 100);
                } else {
                    console.error('HandControl: MediaPipe failed to load');
                    resolve();
                }
            };
            check();
        });
    },

    createElements() {
        // hidden video for camera feed
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', '');
        this.video.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 160px;
            height: 120px;
            opacity: 0;
            pointer-events: none;
            z-index: -1;
        `;
        document.body.appendChild(this.video);

        // debug canvas (camera preview with hand tracking)
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'hand-debug-canvas';
        this.canvas.width = 160;
        this.canvas.height = 120;
        this.canvas.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 160px;
            height: 120px;
            border-radius: 12px;
            opacity: 0;
            pointer-events: none;
            z-index: 9990;
            transition: opacity 0.3s ease;
            transform: scaleX(-1);
            background: #000;
        `;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // hand cursor (follows index finger)
        this.handCursor = document.createElement('div');
        this.handCursor.className = 'hand-cursor';
        this.handCursor.style.cssText = `
            position: fixed;
            width: 14px;
            height: 14px;
            background: var(--white, #fff);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            transform: translate(-50%, -50%);
            mix-blend-mode: difference;
            opacity: 0;
            transition: width 0.2s ease, height 0.2s ease, opacity 0.3s ease;
        `;
        document.body.appendChild(this.handCursor);

        // hand cursor ring
        this.handCursorRing = document.createElement('div');
        this.handCursorRing.className = 'hand-cursor-ring';
        this.handCursorRing.style.cssText = `
            position: fixed;
            width: 45px;
            height: 45px;
            border: 1px solid var(--white, #fff);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9998;
            transform: translate(-50%, -50%);
            mix-blend-mode: difference;
            opacity: 0;
            transition: width 0.2s ease, height 0.2s ease, opacity 0.3s ease;
        `;
        document.body.appendChild(this.handCursorRing);
    },

    async start() {
        if (!this.isReady) {
            console.warn('HandControl: MediaPipe not loaded yet');
            throw new Error('MediaPipe not ready');
        }

        if (this.isActive) return;

        try {
            // initialize mediapipe hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 0, // 0 = lite, faster for MacBook
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => this.onResults(results));

            // start camera
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
            this.showDebug(true);
            this.showHandCursor(true);
            
            console.log('HandControl: Started');
        } catch (err) {
            console.error('HandControl: Failed to start', err);
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
        this.showDebug(false);
        this.showHandCursor(false);
        this.gesture.current = null;
        this.gesture.velocity = 0;
        this.smoothing.positions = [];
        this.smoothing.cursorX = [];
        this.smoothing.cursorY = [];
        console.log('HandControl: Stopped');
    },

    showDebug(show) {
        if (this.canvas) {
            this.canvas.style.opacity = show ? '0.9' : '0';
        }
    },

    showHandCursor(show) {
        if (this.handCursor) {
            this.handCursor.style.opacity = show ? '1' : '0';
        }
        if (this.handCursorRing) {
            this.handCursorRing.style.opacity = show ? '0.5' : '0';
        }
    },

    updateHandCursor(x, y, gesture) {
        // smooth cursor position
        this.smoothing.cursorX.push(x);
        this.smoothing.cursorY.push(y);
        if (this.smoothing.cursorX.length > 8) this.smoothing.cursorX.shift();
        if (this.smoothing.cursorY.length > 8) this.smoothing.cursorY.shift();
        
        const smoothX = this.smoothing.cursorX.reduce((a, b) => a + b, 0) / this.smoothing.cursorX.length;
        const smoothY = this.smoothing.cursorY.reduce((a, b) => a + b, 0) / this.smoothing.cursorY.length;
        
        // mirror X (camera is mirrored) and map to screen
        const screenX = (1 - smoothX) * window.innerWidth;
        const screenY = smoothY * window.innerHeight;
        
        // lerp for extra smoothness
        this.cursorPos.x += (screenX - this.cursorPos.x) * 0.3;
        this.cursorPos.y += (screenY - this.cursorPos.y) * 0.3;
        
        // update cursor position
        if (this.handCursor) {
            this.handCursor.style.left = this.cursorPos.x + 'px';
            this.handCursor.style.top = this.cursorPos.y + 'px';
            
            // scale cursor based on gesture
            if (gesture === 'scroll' || gesture === 'palm') {
                this.handCursor.style.width = '20px';
                this.handCursor.style.height = '20px';
            } else if (gesture === 'point') {
                this.handCursor.style.width = '10px';
                this.handCursor.style.height = '10px';
            } else {
                this.handCursor.style.width = '14px';
                this.handCursor.style.height = '14px';
            }
        }
        
        if (this.handCursorRing) {
            // ring follows with delay
            this.handCursorRing.style.left = this.cursorPos.x + 'px';
            this.handCursorRing.style.top = this.cursorPos.y + 'px';
            
            // expand ring when scrolling
            if (gesture === 'scroll' || gesture === 'palm') {
                this.handCursorRing.style.width = '60px';
                this.handCursorRing.style.height = '60px';
                this.handCursorRing.style.opacity = '0.3';
            } else {
                this.handCursorRing.style.width = '45px';
                this.handCursorRing.style.height = '45px';
                this.handCursorRing.style.opacity = '0.5';
            }
        }
    },

    onResults(results) {
        if (!this.ctx) return;
        
        // clear canvas
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // draw camera feed
        if (results.image) {
            this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // draw hand skeleton
            this.drawHand(landmarks);
            
            // detect gesture
            const gesture = this.detectGesture(landmarks);
            
            // update hand cursor position (using index finger tip)
            const INDEX_TIP = 8;
            this.updateHandCursor(landmarks[INDEX_TIP].x, landmarks[INDEX_TIP].y, gesture);
            
            // process gesture for scrolling
            this.processGesture(gesture, landmarks);
        } else {
            // no hand detected - hide cursor slightly
            if (this.handCursor) {
                this.handCursor.style.opacity = '0.3';
            }
            if (this.handCursorRing) {
                this.handCursorRing.style.opacity = '0.1';
            }
            
            // reset gesture
            if (this.gesture.current) {
                this.gesture.previous = this.gesture.current;
                this.gesture.current = null;
                
                if (this.onGestureEnd) {
                    this.onGestureEnd(this.gesture.previous);
                }
            }
        }

        this.ctx.restore();
    },

    drawHand(landmarks) {
        // draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],           // thumb
            [0, 5], [5, 6], [6, 7], [7, 8],           // index
            [0, 9], [9, 10], [10, 11], [11, 12],      // middle
            [0, 13], [13, 14], [14, 15], [15, 16],    // ring
            [0, 17], [17, 18], [18, 19], [19, 20],    // pinky
            [5, 9], [9, 13], [13, 17]                 // palm
        ];

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = 1;

        connections.forEach(([i, j]) => {
            const p1 = landmarks[i];
            const p2 = landmarks[j];
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x * this.canvas.width, p1.y * this.canvas.height);
            this.ctx.lineTo(p2.x * this.canvas.width, p2.y * this.canvas.height);
            this.ctx.stroke();
        });

        // draw landmarks
        landmarks.forEach((point, i) => {
            const x = point.x * this.canvas.width;
            const y = point.y * this.canvas.height;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, i === 8 ? 4 : 2, 0, Math.PI * 2);
            this.ctx.fillStyle = i === 8 ? '#00ff88' : 'rgba(255, 255, 255, 0.8)';
            this.ctx.fill();
        });
    },

    detectGesture(landmarks) {
        // landmark indices
        const INDEX_TIP = 8;
        const INDEX_MCP = 5;
        const MIDDLE_TIP = 12;
        const MIDDLE_MCP = 9;
        const RING_TIP = 16;
        const RING_MCP = 13;
        const PINKY_TIP = 20;
        const PINKY_MCP = 17;

        // helper: is finger extended (tip is above MCP in screen coords)
        const isFingerExtended = (tip, mcp) => {
            return landmarks[tip].y < landmarks[mcp].y;
        };

        const indexExtended = isFingerExtended(INDEX_TIP, INDEX_MCP);
        const middleExtended = isFingerExtended(MIDDLE_TIP, MIDDLE_MCP);
        const ringExtended = isFingerExtended(RING_TIP, RING_MCP);
        const pinkyExtended = isFingerExtended(PINKY_TIP, PINKY_MCP);

        // open palm: all fingers extended - use for scroll
        if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
            return 'palm';
        }

        // peace/scroll: index and middle extended
        if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
            return 'scroll';
        }

        // pointing: only index extended
        if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return 'point';
        }

        // fist: no fingers extended - stop
        if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return 'fist';
        }

        return null;
    },

    processGesture(gesture, landmarks) {
        const INDEX_TIP = 8;
        const indexY = landmarks[INDEX_TIP].y;

        // smooth position
        this.smoothing.positions.push(indexY);
        if (this.smoothing.positions.length > this.smoothing.maxSamples) {
            this.smoothing.positions.shift();
        }
        const smoothY = this.smoothing.positions.reduce((a, b) => a + b, 0) / this.smoothing.positions.length;

        // scroll gesture (peace sign or palm)
        if (gesture === 'scroll' || gesture === 'palm') {
            if (this.gesture.current !== 'scroll') {
                // gesture started
                this.gesture.current = 'scroll';
                this.gesture.startY = smoothY;
                this.gesture.lastY = smoothY;
                
                if (this.onGestureStart) {
                    this.onGestureStart('scroll');
                }
            } else {
                // gesture continuing - calculate scroll
                const deltaY = smoothY - this.gesture.lastY;
                
                // apply deadzone
                if (Math.abs(deltaY) > this.scroll.deadzone) {
                    // calculate scroll amount
                    let scrollAmount = deltaY * this.scroll.sensitivity * 100;
                    
                    // clamp to max speed
                    scrollAmount = Math.max(-this.scroll.maxSpeed, Math.min(this.scroll.maxSpeed, scrollAmount));
                    
                    // smooth velocity
                    this.gesture.velocity = this.gesture.velocity * 0.7 + scrollAmount * 0.3;
                    
                    if (this.onScroll) {
                        this.onScroll(this.gesture.velocity);
                    } else {
                        // default: scroll the page
                        window.scrollBy(0, this.gesture.velocity);
                    }
                    
                    if (this.onGestureMove) {
                        this.onGestureMove('scroll', { deltaY, velocity: this.gesture.velocity });
                    }
                }
                
                this.gesture.lastY = smoothY;
            }
        } else if (gesture === 'fist') {
            // fist = stop/pause
            if (this.gesture.current === 'scroll') {
                this.gesture.current = null;
                this.gesture.velocity = 0;
                
                if (this.onGestureEnd) {
                    this.onGestureEnd('scroll');
                }
            }
        } else if (gesture === 'point') {
            this.gesture.current = 'point';
        } else {
            // unknown or transition - decay velocity
            if (this.gesture.current === 'scroll') {
                this.gesture.velocity *= 0.9;
                if (Math.abs(this.gesture.velocity) < 0.1) {
                    this.gesture.current = null;
                    this.gesture.velocity = 0;
                    
                    if (this.onGestureEnd) {
                        this.onGestureEnd('scroll');
                    }
                }
            }
        }

        // draw gesture indicator
        this.drawGestureIndicator(gesture);
    },

    drawGestureIndicator(gesture) {
        if (!gesture) return;

        const labels = {
            'palm': '✋ SCROLL',
            'scroll': '✌️ SCROLL',
            'point': '☝️ POINT',
            'fist': '✊ STOP'
        };

        this.ctx.font = 'bold 10px "Space Mono", monospace';
        this.ctx.fillStyle = '#00ff88';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(labels[gesture] || gesture, 8, 16);

        // scroll direction indicator
        if (this.gesture.current === 'scroll' && Math.abs(this.gesture.velocity) > 0.5) {
            const direction = this.gesture.velocity > 0 ? '↓' : '↑';
            const intensity = Math.min(Math.abs(this.gesture.velocity) / 10, 1);
            
            this.ctx.font = `bold ${14 + intensity * 10}px sans-serif`;
            this.ctx.fillStyle = `rgba(0, 255, 136, ${0.5 + intensity * 0.5})`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(direction, this.canvas.width / 2, this.canvas.height / 2);
        }
    },

    toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            this.start();
        }
        return this.isActive;
    },

    setScrollSensitivity(value) {
        this.scroll.sensitivity = value;
    }
};

window.HandControl = HandControl;