// hand control ui - integrates with toggle system

const HandControlUI = {
    elements: {},
    isInitialized: false,

    async init() {
        this.createUI();
        this.bindEvents();
        
        // pre-load mediapipe
        await HandControl.init({
            scroll: {
                sensitivity: 3,
                deadzone: 0.015,
                maxSpeed: 25
            },
            onScroll: (velocity) => this.onScroll(velocity)
        });

        HandControl.onGestureStart = (gesture) => this.onGestureStart(gesture);
        HandControl.onGestureEnd = (gesture) => this.onGestureEnd(gesture);

        this.isInitialized = true;
        console.log('HandControlUI: Ready');
    },

    createUI() {
        // status indicator
        const status = document.createElement('div');
        status.className = 'hand-status';
        status.innerHTML = `
            <span class="hand-status-dot"></span>
            <span class="hand-status-text">Hand Control</span>
        `;
        document.body.appendChild(status);
        this.elements.status = status;

        // scroll indicator bar
        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'hand-scroll-indicator';
        scrollIndicator.innerHTML = '<div class="hand-scroll-track"></div>';
        document.body.appendChild(scrollIndicator);
        this.elements.scrollIndicator = scrollIndicator;
        this.elements.scrollTrack = scrollIndicator.querySelector('.hand-scroll-track');

        // gesture hints
        const hints = document.createElement('div');
        hints.className = 'hand-hints';
        hints.innerHTML = `
            <div class="hand-hint">
                <span class="hand-hint-icon">✌️</span>
                <span>Two fingers to scroll</span>
            </div>
            <div class="hand-hint">
                <span class="hand-hint-icon">✊</span>
                <span>Fist to stop</span>
            </div>
        `;
        document.body.appendChild(hints);
        this.elements.hints = hints;

        // permission modal
        const permission = document.createElement('div');
        permission.className = 'hand-permission';
        permission.innerHTML = `
            <div class="hand-permission-content">
                <div class="hand-permission-icon">✋</div>
                <h2 class="hand-permission-title">Enable Hand Control</h2>
                <p class="hand-permission-text">
                    Use hand gestures to scroll through the portfolio.<br>
                    Camera access is required for gesture recognition.<br>
                    Your camera feed is processed locally and never uploaded.
                </p>
                <button class="hand-permission-btn">Enable Camera</button>
                <button class="hand-permission-skip">Skip for now</button>
            </div>
        `;
        document.body.appendChild(permission);
        this.elements.permission = permission;
    },

    bindEvents() {
        // permission buttons
        const enableBtn = this.elements.permission.querySelector('.hand-permission-btn');
        const skipBtn = this.elements.permission.querySelector('.hand-permission-skip');

        enableBtn.addEventListener('click', () => {
            this.hidePermission();
            this.start();
        });

        skipBtn.addEventListener('click', () => {
            this.hidePermission();
            this.deactivateToggle();
        });

        // update toggle handlers
        const handToggle = document.querySelector('[data-toggle="cursor"][data-value="hand"]');
        const pointerToggle = document.querySelector('[data-toggle="cursor"][data-value="pointer"]');

        if (handToggle) {
            handToggle.addEventListener('click', () => {
                if (!HandControl.isActive && this.isInitialized) {
                    this.showPermission();
                }
            });
        }

        if (pointerToggle) {
            pointerToggle.addEventListener('click', () => {
                this.stop();
            });
        }
    },

    showPermission() {
        this.elements.permission.classList.add('active');
    },

    hidePermission() {
        this.elements.permission.classList.remove('active');
    },

    async start() {
        if (!this.isInitialized) {
            console.warn('HandControlUI not initialized');
            return;
        }

        // check for camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Camera not supported on this browser');
            return;
        }

        this.elements.status.classList.add('active', 'detecting');
        this.elements.status.querySelector('.hand-status-text').textContent = 'Detecting...';
        
        try {
            await HandControl.start();
            
            this.elements.status.classList.remove('detecting');
            this.elements.status.querySelector('.hand-status-text').textContent = 'Hand Active';
            this.elements.hints.classList.add('active');
            
            // hide mouse cursor
            if (window.Cursor) {
                Cursor.setVisible(false);
            }
        } catch (err) {
            console.error('HandControl error:', err);
            
            let errorMsg = 'Camera Error';
            if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
                errorMsg = 'Camera access denied';
            } else if (err.name === 'NotFoundError') {
                errorMsg = 'No camera found';
            } else if (err.message?.includes('MediaPipe')) {
                errorMsg = 'Loading models...';
            }
            
            this.showError(errorMsg);
        }
    },

    showError(message) {
        this.elements.status.classList.remove('detecting');
        this.elements.status.classList.add('active', 'error');
        this.elements.status.querySelector('.hand-status-text').textContent = message;
        
        setTimeout(() => {
            this.elements.status.classList.remove('active', 'error');
            this.deactivateToggle();
        }, 3000);
    },

    stop() {
        HandControl.stop();
        
        this.elements.status.classList.remove('active', 'detecting');
        this.elements.hints.classList.remove('active');
        this.elements.scrollIndicator.classList.remove('active');
        
        // restore mouse cursor
        if (window.Cursor) {
            Cursor.setVisible(true);
        }
    },

    deactivateToggle() {
        const pointerToggle = document.querySelector('[data-toggle="cursor"][data-value="pointer"]');
        const handToggle = document.querySelector('[data-toggle="cursor"][data-value="hand"]');
        
        if (pointerToggle && handToggle) {
            handToggle.classList.remove('active');
            pointerToggle.classList.add('active');
        }
    },

    onScroll(velocity) {
        // show scroll indicator
        this.elements.scrollIndicator.classList.add('active');
        
        // update track position based on velocity
        const normalizedVel = Math.max(-1, Math.min(1, velocity / 15));
        const trackPos = 50 + (normalizedVel * 35);
        this.elements.scrollTrack.style.top = `${trackPos}%`;
    },

    onGestureStart(gesture) {
        if (gesture === 'scroll') {
            this.elements.scrollIndicator.classList.add('active');
        }
    },

    onGestureEnd(gesture) {
        if (gesture === 'scroll') {
            // delay hiding for smooth transition
            setTimeout(() => {
                if (!HandControl.gesture.current) {
                    this.elements.scrollIndicator.classList.remove('active');
                }
            }, 300);
        }
    }
};

window.HandControlUI = HandControlUI;