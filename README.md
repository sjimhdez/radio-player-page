# Radio Player Page

![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)
![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
![WordPress Plugin Downloads](https://img.shields.io/wordpress/plugin/dw/radio-player-page)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

[![Node](https://img.shields.io/badge/node-20.x-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-19.1.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/vite-6.3.5-blue.svg)](https://vitejs.dev/)
[![MUI](https://img.shields.io/badge/MUI-7.1.1-blue.svg)](https://mui.com/)

Create a dedicated page for your Icecast, Shoutcast, or MP3 radio. Continuous playback without interruptions.

## Description

**Radio Player Page** provides a clean, dedicated page for streaming **Icecast, Shoutcast, and MP3** stations inside WordPress. By isolating the player from the theme, it guarantees uninterrupted playback, faster load times, and a distraction‑free listening experience.

### Why use a dedicated page?
- No conflicts with themes or other plugins.
- Streams keep playing when users navigate the site.
- Minimal UI focused solely on audio.

It is the **first plugin in the official WordPress repository** that fully decouples the player from the site, delivering a truly standalone streaming page.

## Features
- **Multiple stations** – Up to 6 stations with optional custom titles.
- **Waveform visualizer** – Real‑time audio visualization via the Web Audio API.
- **Frontend decoupling** – Player rendered in a standalone `<div id="root"></div>` container.
- **Modern stack** – Built with React, TypeScript, Vite, and MUI.
- **Responsive design** – Works flawlessly on desktop and mobile.
- **Full i18n** – English, Spanish, and Russian support with automatic locale detection.

## Technical Details
The plugin ships a self‑contained React application that is bundled with Vite. The WordPress side only injects the compiled assets and provides the configuration UI.

- **React + TypeScript** – Maintainable, type‑safe code.
- **Vite** – Fast development builds and minimal production bundles.
- **Web Audio API** – Dynamic waveform animations.
- **Theme‑agnostic** – No external CSS or JS interference.

## Installation
1. Upload the `radio-player-page` folder to `/wp-content/plugins/`.
2. Activate the plugin via **Plugins → Installed Plugins**.
3. Open **Settings → Radio Player Page Settings** and:
   - Add up to 6 stations.
   - Provide the stream URL and select a target page for each station.

## Development
Two workflows are provided for the React frontend:

### 1️⃣ Standalone React development
Run the React app independently using the `window` variables from `player/index.html`.
```bash
cd player
npm install
npm run dev
```

### 2️⃣ Integrated WordPress development
Continuously build the frontend into `dist/` and test directly inside a local WordPress instance.
```bash
cd player
npm install
npm run dev:build
```

Choose the workflow that best fits your workflow.

## WordPress Plugin Page
👉 [wordpress.org/plugins/radio-player-page](https://wordpress.org/plugins/radio-player-page)

## Updates & Support
Stay informed about new releases and announcements via the developer’s Bluesky account (linked in the GitHub profile).
