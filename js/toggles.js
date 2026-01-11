// toggle controls

const Toggles = {
    init() {
        document.querySelectorAll('.toggle-option').forEach(option => {
            option.addEventListener('click', () => this.handleToggle(option));
        });
    },

    handleToggle(option) {
        const group = option.dataset.toggle;
        const value = option.dataset.value;

        document.querySelectorAll(`[data-toggle="${group}"]`).forEach(opt => {
            opt.classList.remove('active');
        });
        option.classList.add('active');

        this.dispatch(group, value);
    },

    dispatch(group, value) {
        switch (group) {
            case 'theme':
                if (window.Theme) Theme.set(value);
                break;

            case 'cursor':
                if (window.Cursor) {
                    Cursor.setVisible(value !== 'hand');
                }
                break;

            case 'mode':
                console.log('Mode:', value);
                break;
        }
    }
};

window.Toggles = Toggles;