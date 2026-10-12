# Nupur Hassan — Portfolio

Personal portfolio site with a WebGL grain background, a generative cursor blob, and **hand-gesture navigation**: turn on Hand mode and control the page with your webcam, no mouse needed.

**Live site:** https://nupurhassan.github.io/Portfolio/

<!-- TODO: record a short screen capture of Hand mode, save it as assets/hand-control-demo.gif, then uncomment the line below.
![Hand-gesture control demo](assets/hand-control-demo.gif)
-->

## Features

- **Hand-gesture control** — real-time hand tracking in the browser via MediaPipe Hands. Gestures are classified per frame and debounced so the cursor stays steady.

  | Gesture | Action |
  | --- | --- |
  | ☝️ Point | Move cursor |
  | ✌️ Two fingers | Click |
  | 🤟 Three fingers | Exit hand mode |
  | 👍 Thumbs up | Confetti |

- **WebGL grain shader** — animated film-grain background rendered with Three.js, with dark and light themes.
- **Custom cursor and blob** — canvas-drawn cursor with particle trail and an organic blob that follows the pointer.
- **Text-scramble navigation** and an animated intro that plays on the first visit only (add `?intro` to the URL to replay it).
- **No build step** — plain HTML, CSS and JavaScript.

## Tech stack

| Area | Tools |
| --- | --- |
| Markup and styling | HTML5, CSS3 (custom properties for theming) |
| Scripting | Vanilla JavaScript (ES6+) |
| Graphics | Three.js r128 (WebGL shader), Canvas 2D |
| Computer vision | MediaPipe Hands, MediaPipe Camera Utils |
| Fonts | Syne, Space Mono (Google Fonts) |

## Run it locally

The site is static, but the webcam only works from `http://localhost` or HTTPS, not by double-clicking the file. Serve the folder with any static server:

```bash
git clone https://github.com/nupurhassan/Portfolio.git
cd Portfolio
python3 -m http.server 8000
```

Then open http://localhost:8000. To try hand control, switch the **Pointer / Hand** toggle to Hand and allow camera access. Video is processed entirely in your browser and never leaves your machine.

## Project structure

```
index.html          Animated intro (first visit only), then redirects to homepage
homepage.html       Main site: About, Work and navigation
css/                Variables, base styles and one stylesheet per section
js/
  hand-control.js     MediaPipe setup and gesture classification
  hand-control-ui.js  Camera permission flow, status pill, gesture hints
  grain-shader.js     Three.js grain background
  blob.js, cursor.js  Canvas cursor effects
  text-scramble.js    Nav text animation
  theme.js, toggles.js  Dark/light and pointer/hand toggles
assets/             Images
```

## License

[MIT](LICENSE)
