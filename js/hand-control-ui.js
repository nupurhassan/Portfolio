// Hand Control UI — permission flow + status

const HandControlUI = {
    els: {},
    ready: false,

    async init() {
        this._buildUI();
        this._bindEvents();
        await HandControl.init();
        HandControl.onExit = () => this._onExit();
        this.ready = true;
        console.log('HandControlUI: Ready');
    },

    _buildUI() {
        // status pill
        const status = document.createElement('div');
        status.className = 'hand-status';
        status.innerHTML = '<span class="hand-status-dot"></span><span class="hand-status-text">Hand Control</span>';
        document.body.appendChild(status);
        this.els.status = status;

        // gesture hints
        const hints = document.createElement('div');
        hints.className = 'hand-hints';
        hints.innerHTML = `
            <div class="hand-hint"><span class="hand-hint-icon">☝️</span><span>Point = Move cursor</span></div>
            <div class="hand-hint"><span class="hand-hint-icon">✌️</span><span>2 fingers = Click</span></div>
            <div class="hand-hint"><span class="hand-hint-icon">🤟</span><span>3 fingers = Exit</span></div>
            <div class="hand-hint"><span class="hand-hint-icon">👍</span><span>Thumbs up = Confetti</span></div>
        `;
        document.body.appendChild(hints);
        this.els.hints = hints;

        // permission modal
        const modal = document.createElement('div');
        modal.className = 'hand-permission';
        modal.innerHTML = `
            <div class="hand-permission-content">
                <div class="hand-permission-icon">✋</div>
                <h2 class="hand-permission-title">Hand Gesture Control</h2>
                <p class="hand-permission-text">
                    Your index finger becomes the cursor.<br>
                    Camera stays local — nothing leaves your device.
                </p>
                <button class="hand-permission-btn">Enable Camera</button>
                <button class="hand-permission-skip">Skip</button>
            </div>
        `;
        document.body.appendChild(modal);
        this.els.modal = modal;
    },

    _bindEvents() {
        this.els.modal.querySelector('.hand-permission-btn').addEventListener('click', () => {
            this._hideModal();
            this._start();
        });

        this.els.modal.querySelector('.hand-permission-skip').addEventListener('click', () => {
            this._hideModal();
            this._resetToggle();
        });

        const handToggle = document.querySelector('[data-toggle="cursor"][data-value="hand"]');
        const ptrToggle = document.querySelector('[data-toggle="cursor"][data-value="pointer"]');

        if (handToggle) {
            handToggle.addEventListener('click', () => {
                if (!HandControl.isActive && this.ready) this._showModal();
            });
        }

        if (ptrToggle) {
            ptrToggle.addEventListener('click', () => {
                if (HandControl.isActive) HandControl.stop();
            });
        }
    },

    _showModal() { this.els.modal.classList.add('active'); },
    _hideModal() { this.els.modal.classList.remove('active'); },

    async _start() {
        if (!this.ready) return;

        this.els.status.classList.add('active', 'detecting');
        this.els.status.querySelector('.hand-status-text').textContent = 'Starting…';

        try {
            await HandControl.start();
            this.els.status.classList.remove('detecting');
            this.els.status.querySelector('.hand-status-text').textContent = 'Hand Active';
            this.els.hints.classList.add('active');
        } catch (err) {
            let msg = 'Camera Error';
            if (err.name === 'NotAllowedError') msg = 'Camera Denied';
            else if (err.name === 'NotFoundError') msg = 'No Camera Found';

            this.els.status.classList.remove('detecting');
            this.els.status.classList.add('error');
            this.els.status.querySelector('.hand-status-text').textContent = msg;

            setTimeout(() => {
                this.els.status.classList.remove('active', 'error');
                this._resetToggle();
            }, 3000);
        }
    },

    _onExit() {
        this.els.status.classList.remove('active', 'detecting');
        this.els.hints.classList.remove('active');
        this._resetToggle();
    },

    _resetToggle() {
        const ptr = document.querySelector('[data-toggle="cursor"][data-value="pointer"]');
        const hand = document.querySelector('[data-toggle="cursor"][data-value="hand"]');
        if (ptr && hand) {
            hand.classList.remove('active');
            ptr.classList.add('active');
        }
    }
};

window.HandControlUI = HandControlUI;