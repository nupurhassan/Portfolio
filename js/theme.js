// theme module

const Theme = {
    current: 'dark',
    material: null,

    init(shaderMaterial = null) {
        this.material = shaderMaterial;
        this.bindToggles();
    },

    set(theme) {
        this.current = theme;
        document.documentElement.setAttribute('data-theme', theme);

        // dark = 1.0, light = 0.0
        if (this.material) {
            this.material.uniforms.uTheme.value = theme === 'dark' ? 1.0 : 0.0;
        }
    },

    bindToggles() {
        document.querySelectorAll('[data-toggle="theme"]').forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;

                document.querySelectorAll('[data-toggle="theme"]').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');

                this.set(value);
            });
        });
    }
};

window.Theme = Theme;