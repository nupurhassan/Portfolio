/* js/blob.js
   Flat transparent maroon blob (NO shading).
   Mechanics:
   - Starts as a perfect circle
   - Follows Cursor with heavy inertia
   - Stretch/tail appears OPPOSITE of movement direction (speed-based)
   - Relaxes back to circle when slow/stop
*/

(() => {
  const Blob = {
    canvas: null,
    ctx: null,

    dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
    w: 0,
    h: 0,

    // center motion (heavy)
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    follow: 0.030,
    damp: 0.86,

    // circle geometry
    baseR: 260,
    points: 52,

    // speed tracking
    prevTarget: { x: 0, y: 0 },
    v: { x: 0, y: 0 },     // filtered velocity
    vFilter: 0.18,
    maxSpeed: 1700,        // px/sec -> 1.0 tail
    tailMax: 0.22,         // stretch amount
    squashMax: 0.10,       // perpendicular squash

    // start as perfect circle
    bornAt: performance.now(),
    startEaseMs: 900,      // ramp-in so it starts clean

    // flat fill color
    fill: "rgba(210, 20, 40, 0.25)",

    init(canvasId = "blob-canvas") {
      this.canvas = typeof canvasId === "string" ? document.getElementById(canvasId) : canvasId;
      if (!this.canvas) {
        console.warn("[Blob] canvas not found:", canvasId);
        return;
      }
      this.ctx = this.canvas.getContext("2d", { alpha: true });

      this.resize();
      window.addEventListener("resize", () => this.resize(), { passive: true });

      // start at a nice default spot (right side)
      this.pos.x = this.w * 0.72;
      this.pos.y = this.h * 0.46;

      this.prevTarget.x = this.pos.x;
      this.prevTarget.y = this.pos.y;

      requestAnimationFrame((t) => this.frame(t));
    },

    resize() {
      this.w = window.innerWidth;
      this.h = window.innerHeight;

      this.canvas.style.width = this.w + "px";
      this.canvas.style.height = this.h + "px";

      this.canvas.width = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);

      const minSide = Math.min(this.w, this.h);
      this.baseR = Math.max(170, Math.min(380, minSide * 0.30));

      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    },

    getPositions() {
      const c = window.Cursor;
      if (c && typeof c === "object") {
        const ring = c.ringPos || c.getPosition?.() || { x: this.w / 2, y: this.h / 2 };
        return { ring };
      }
      return { ring: { x: this.w / 2, y: this.h / 2 } };
    },

    clamp01(x) { return Math.max(0, Math.min(1, x)); },

    frame(now) {
      if (!this._last) this._last = now;
      const dt = Math.max(0.001, Math.min(0.05, (now - this._last) / 1000));
      this._last = now;

      const { ring } = this.getPositions();

      // velocity (px/sec), filtered
      const rawVx = (ring.x - this.prevTarget.x) / dt;
      const rawVy = (ring.y - this.prevTarget.y) / dt;
      this.prevTarget.x = ring.x;
      this.prevTarget.y = ring.y;

      this.v.x += (rawVx - this.v.x) * this.vFilter;
      this.v.y += (rawVy - this.v.y) * this.vFilter;

      const speed = Math.sqrt(this.v.x * this.v.x + this.v.y * this.v.y);
      const speedN = this.clamp01(speed / this.maxSpeed);

      // ramp-in so it starts as a perfect circle
      const easeIn = this.clamp01((now - this.bornAt) / this.startEaseMs);
      const ease = easeIn * easeIn * (3 - 2 * easeIn); // smoothstep
      const tailK = speedN * ease;

      // heavy follow
      const tx = ring.x;
      const ty = ring.y;

      this.vel.x += (tx - this.pos.x) * this.follow;
      this.vel.y += (ty - this.pos.y) * this.follow;
      this.vel.x *= this.damp;
      this.vel.y *= this.damp;

      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;

      // draw
      this.draw(tailK);

      requestAnimationFrame((n) => this.frame(n));
    },

    draw(tailK) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);

      // soft edge blur like gel, but NO shading (flat fill)
      ctx.save();
      ctx.filter = "blur(8px)";

      const cx = this.pos.x;
      const cy = this.pos.y;

      // tail direction is opposite movement direction
      const moveAng = Math.atan2(this.v.y, this.v.x);
      const tailAng = moveAng + Math.PI;

      // stretch & squash based on speed
      const stretch = 1 + tailK * this.tailMax;
      const squash  = 1 - tailK * this.squashMax;

      ctx.beginPath();
      for (let i = 0; i <= this.points; i++) {
        const p = i / this.points;
        const a = p * Math.PI * 2;

        // perfect circle radius
        let r = this.baseR;

        // add tail bump opposite motion
        const d = Math.cos(a - tailAng);
        const bump = Math.pow(Math.max(0, d), 2.6) * (this.baseR * tailK * 0.18);
        r += bump;

        // point
        let x = Math.cos(a) * r;
        let y = Math.sin(a) * r;

        // anisotropic scale aligned with tail axis
        const ca = Math.cos(tailAng);
        const sa = Math.sin(tailAng);

        const rx = x * ca + y * sa;
        const ry = -x * sa + y * ca;

        const sx = rx * stretch;
        const sy = ry * squash;

        x = sx * ca - sy * sa;
        y = sx * sa + sy * ca;

        const px = cx + x;
        const py = cy + y;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.fillStyle = this.fill;
      ctx.fill();

      ctx.restore();
    }
  };

  window.Blob = Blob;
})();
