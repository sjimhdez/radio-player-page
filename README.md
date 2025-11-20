# Radio Player Page

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/sjimhdez/radio-player-page)
[![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

[![Node](https://img.shields.io/badge/node-20.x-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-19.1.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/vite-6.3.5-blue.svg)](https://vitejs.dev/)
[![MUI](https://img.shields.io/badge/MUI-7.1.1-blue.svg)](https://mui.com/)

A clean, standalone audio player with a waveform visualizer.  
Designed specifically for WordPress-based radio stations.

## Description

**Radio Player Page** is a dedicated solution for streaming **Icecast, Shoutcast, and MP3** streams in WordPress. Unlike standard audio players, it creates a **separate, optimized page** for your station, ensuring continuous playback and improved listener retention.

By decoupling the player from WordPress, it:

- Avoids conflicts with themes or plugins.
- Reduces loading times.
- Keeps streams running even when users navigate your site.

This lightweight, mobile-friendly player focuses entirely on the listening experience. No ads, no premium tiers — just reliable streaming built for professional radio stations.

It is the **first plugin in the official WordPress repository** to fully abstract the player from the site, providing a **dedicated, distraction-free environment** for uninterrupted streaming.

## Features

- **Multiple Stations Support**: Manage up to 6 different radio stations with ease.
- **Minimal UI**: Clean, distraction-free design for optimal listening.
- **Waveform Visualizer**: Real-time audio visualization powered by the Web Audio API.
- **Frontend Decoupling**: Injects the player into a standalone container (`<div id="root">`), independent of the WordPress theme.
- **Modern Stack**: Built with React, TypeScript, and Vite.
- **Responsive Design**: Seamless performance across desktop and mobile.
- **Multilingual Support**: Full i18n for admin panel and player interface (English, Spanish) with automatic WordPress locale detection.

## Technical Details

The plugin ships with a **standalone frontend app** decoupled from WordPress:

- **React + TypeScript** → Maintainable, performant codebase.
- **Vite bundling** → Fast builds and minimal assets.
- **Web Audio API** → Dynamic, real-time waveform animations.
- **Theme-agnostic** → Immune to external styles, scripts, or layouts.

## Installation

1. Upload the `radio-player-page` folder to `/wp-content/plugins/`.
2. Activate the plugin from **Plugins > Installed Plugins**.
3. Configure it via **Settings > Radio Player Page Settings**:
   - Add up to 6 stations.
   - For each station, enter the stream URL and select the target page.

## WordPress Plugin

Official page:  
👉 [wordpress.org/plugins/radio-player-page](https://wordpress.org/plugins/radio-player-page)

## Local Development

Two recommended workflows for the React frontend:

### 1. Standalone React development

Run only the React app using the `window` variables from `player/index.html`.  
Useful for isolated frontend work.

```bash
cd player
npm install
npm run dev
```

## 2. Integrated WordPress development

Continuously builds the frontend into dist/, allowing direct testing inside a local WordPress instance.

```bash
cd player
npm install
npm run dev:build
```

Choose the workflow that best suits your setup.

## Updates

Stay informed about news and releases through the developer’s Bluesky account (linked in the GitHub profile).
