// grain shader

const GrainShader = {
    scene: null,
    camera: null,
    renderer: null,
    material: null,
    mouse: { x: 0.7, y: 0.3 },
    targetMouse: { x: 0.7, y: 0.3 },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform float uTheme;
        varying vec2 vUv;

        float hash(vec2 p) {
            p = fract(p * vec2(234.34, 435.345));
            p += dot(p, p + 34.23);
            return fract(p.x * p.y);
        }

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                               -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m;
            m = m*m;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
            vec3 g;
            g.x = a0.x * x0.x + h.x * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 5; i++) {
                value += amplitude * snoise(p);
                amplitude *= 0.5;
                p *= 2.0;
            }
            return value;
        }

        void main() {
            vec2 uv = vUv;
            float time = uTime * 0.08;

            vec2 flow;
            flow.x = fbm(uv * 2.0 + time * 0.5);
            flow.y = fbm(uv * 2.0 + vec2(5.0, 3.0) + time * 0.4);
            vec2 distortedUV = uv + flow * 0.03;

            float grainScale1 = 350.0;
            float grainScale2 = 500.0;
            float grainScale3 = 250.0;

            vec2 grainUV1 = distortedUV * grainScale1 + time * 15.0;
            vec2 grainUV2 = distortedUV * grainScale2 - time * 12.0;
            vec2 grainUV3 = distortedUV * grainScale3 + vec2(time * 8.0, -time * 10.0);

            float grain1 = hash(floor(grainUV1));
            float grain2 = hash(floor(grainUV2));
            float grain3 = hash(floor(grainUV3));

            grain1 = grain1 > 0.75 ? 1.0 : 0.0;
            grain2 = grain2 > 0.78 ? 1.0 : 0.0;
            grain3 = grain3 > 0.72 ? 1.0 : 0.0;

            float grain = max(max(grain1 * 0.7, grain2 * 0.5), grain3 * 0.6);

            float density = fbm(uv * 3.0 + time * 0.3) * 0.5 + 0.5;
            density = smoothstep(0.2, 0.8, density);

            vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
            float mouseDist = distance(uv * aspect, uMouse * aspect);
            float light = smoothstep(0.7, 0.0, mouseDist);
            light = pow(light, 1.5);

            float particleDensity = density * 0.6 + 0.4;
            grain *= particleDensity;

            // dark mode
            float darkBase = 0.92;
            float darkGrain = grain * (0.3 + light * 0.5);
            float darkFlow = density * 0.1;
            float darkDark = light * 0.35;
            float darkBrightness = darkBase - darkGrain - darkFlow - darkDark;

            // light mode
            float lightBase = 0.03;
            float lightGrain = grain * (0.25 + light * 0.35);
            float lightFlow = density * 0.08;
            float lightLight = light * 0.15;
            float lightBrightness = lightBase + lightGrain + lightFlow + lightLight;

            float brightness = mix(lightBrightness, darkBrightness, uTheme);
            brightness = clamp(brightness, 0.0, 1.0);

            vec3 lightColor = vec3(brightness * 0.95, brightness * 0.97, brightness);
            vec3 darkColor = vec3(brightness * 1.0, brightness * 0.98, brightness * 0.94);
            vec3 color = mix(lightColor, darkColor, uTheme);

            color += mix(
                light * vec3(0.02, 0.03, 0.05),
                -light * vec3(0.04, 0.03, 0.01),
                uTheme
            );

            gl_FragColor = vec4(color, 1.0);
        }
    `,

    init(canvasId, panelSelector) {
        const canvas = document.getElementById(canvasId);
        const panel = document.querySelector(panelSelector);
        if (!canvas || !panel) return null;

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        this.renderer.setSize(panel.offsetWidth, panel.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.material = new THREE.ShaderMaterial({
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(panel.offsetWidth, panel.offsetHeight) },
                uMouse: { value: new THREE.Vector2(0.7, 0.3) },
                uTheme: { value: 1.0 }
            }
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(mesh);

        this.bindEvents(panel);
        this.animate();

        return this.material;
    },

    bindEvents(panel) {
        panel.addEventListener('mousemove', (e) => {
            const rect = panel.getBoundingClientRect();
            this.targetMouse.x = (e.clientX - rect.left) / rect.width;
            this.targetMouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
        });

        panel.addEventListener('mouseleave', () => {
            this.targetMouse.x = 0.7;
            this.targetMouse.y = 0.3;
        });

        window.addEventListener('resize', () => {
            this.renderer.setSize(panel.offsetWidth, panel.offsetHeight);
            this.material.uniforms.uResolution.value.set(panel.offsetWidth, panel.offsetHeight);
        });
    },

    animate() {
        requestAnimationFrame(() => this.animate());

        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.015;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.015;

        this.material.uniforms.uTime.value += 0.016;
        this.material.uniforms.uMouse.value.set(this.mouse.x, this.mouse.y);

        this.renderer.render(this.scene, this.camera);
    }
};

window.GrainShader = GrainShader;