// hand control ui

const HandControlUI = {
    elements: {},
    isInitialized: false,

    async init() {
        this.createUI();
        this.bindEvents();
        
        await HandControl.init();
        
        // when fist exits, update toggle UI
        HandControl.onExit = () => {
            this.onHandControlExit();
        };

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

        // gesture hints
        const hints = document.createElement('div');
        hints.className = 'hand-hints';
        hints.innerHTML = `
            <div class="hand-hint">
                <span class="hand-hint-icon">✋</span>
                <span>Palm = Scroll</span>
            </div>
            <div class="hand-hint">
                <span class="hand-hint-icon">✌️</span>
                <span>2 fingers = Click</span>
            </div>
            <div class="hand-hint">
                <span class="hand-hint-icon">🤟</span>
                <span>3 fingers = Exit</span>
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
                <h2 class="hand-permission-title">Hand Gesture Control</h2>
                <p class="hand-permission-text">
                    Control the site with your hand.<br>
                    Camera stays local — nothing uploaded.
                </p>
                <div class="hand-permission-gestures">
                    <div class="hand-permission-gesture">
                        <span class="hand-permission-gesture-icon">✋</span>
                        <span class="hand-permission-gesture-label">Scroll</span>
                    </div>
                    <div class="hand-permission-gesture">
                        <span class="hand-permission-gesture-icon">✌️</span>
                        <span class="hand-permission-gesture-label">Click</span>
                    </div>
                    <div class="hand-permission-gesture">
                        <span class="hand-permission-gesture-icon">🤟</span>
                        <span class="hand-permission-gesture-label">Exit</span>
                    </div>
                </div>
                <button class="hand-permission-btn">Enable Camera</button>
                <button class="hand-permission-skip">Skip</button>
            </div>
        `;
        document.body.appendChild(permission);
        this.elements.permission = permission;
    },

    bindEvents() {
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
                if (HandControl.isActive) {
                    HandControl.stop();
                }
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
        if (!this.isInitialized) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Camera not supported');
            return;
        }

        this.elements.status.classList.add('active', 'detecting');
        this.elements.status.querySelector('.hand-status-text').textContent = 'Starting...';
        
        try {
            await HandControl.start();
            
            this.elements.status.classList.remove('detecting');
            this.elements.status.querySelector('.hand-status-text').textContent = 'Hand Active';
            this.elements.hints.classList.add('active');
            
        } catch (err) {
            console.error('HandControl error:', err);
            
            let errorMsg = 'Camera Error';
            if (err.name === 'NotAllowedError') errorMsg = 'Camera denied';
            else if (err.name === 'NotFoundError') errorMsg = 'No camera';
            
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

    onHandControlExit() {
        // called when fist gesture exits hand mode
        this.elements.status.classList.remove('active', 'detecting');
        this.elements.hints.classList.remove('active');
        this.deactivateToggle();
    },

    deactivateToggle() {
        const pointerToggle = document.querySelector('[data-toggle="cursor"][data-value="pointer"]');
        const handToggle = document.querySelector('[data-toggle="cursor"][data-value="hand"]');
        
        if (pointerToggle && handToggle) {
            handToggle.classList.remove('active');
            pointerToggle.classList.add('active');
        }
    }
};

window.HandControlUI = HandControlUI;