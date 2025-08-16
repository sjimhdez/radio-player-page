# Radio Player Page

[![Version](https://img.shields.io/badge/version-1.1.1-blue.svg)](https://github.com/sjimhdez/radio-player-page)
[![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

[![Node](https://img.shields.io/badge/node-20.x-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-19.1.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/vite-6.3.5-blue.svg)](https://vitejs.dev/)
[![MUI](https://img.shields.io/badge/MUI-7.1.1-blue.svg)](https://mui.com/)

A clean, standalone audio player with waveform visualizer. Designed specifically for WordPress-based radio stations.

---

## Description

Many WordPress-based radio stations either rely on direct streaming links that open in the browser—resulting in an unbranded and clunky experience—or require inserting shortcode-based players, which still render within the clutter of the site layout.

Other existing plugin solutions often overcomplicate the player with excessive features, scripts, and styling dependencies, leading to slow loading times and a poor user experience.

**Radio Player Page** solves this with a focused solution: it creates a dedicated page that strips out all WordPress theme elements and loads only the essentials—a modern audio player and a real-time waveform visualizer.

This is the first plugin to abstract the radio player entirely from the rest of the website, providing a standalone environment focused solely on the listening experience.

This ensures a distraction-free, lightweight, and branded listening experience. Ideal for users who want to keep the player open in a separate tab or as a central page for continuous radio playback.

This plugin was originally developed for a real radio project, where a minimal interface proved to significantly improve user engagement and listening time.

---

## Features

- **Minimal UI:** Clean, distraction-free page for optimal listening.
- **Visual Feedback:** Real-time waveform visualizer powered by the Web Audio API.
- **Frontend Decoupling:** Injects the player into a blank HTML shell (`<div id="root">`) with zero dependency on your active WordPress theme.
- **Built with Modern Tools:** Developed in React + TypeScript and bundled with Vite.
- **Fully Responsive:** Works seamlessly across devices, including mobile.

---

## Technical Details

The plugin includes a standalone frontend application that is decoupled from the WordPress ecosystem:

- **React & TypeScript:** Ensures code maintainability and performance.
- **Vite Bundling:** For fast build times and minimal asset overhead.
- **Audio Visualization:** Uses the Web Audio API to generate dynamic waveform animations.
- **Theme-agnostic:** No interference from existing styles, scripts, or layout elements.

---

## Installation

1. Upload the `radio-player-page` folder to `/wp-content/plugins/`.
2. Activate the plugin in **Plugins > Installed Plugins**.
3. Go to **Settings > Radio Player Page Settings** to:
   - Set your stream URL (e.g. Icecast, Shoutcast, MP3 stream).
   - Select the page where the player will be injected.

---

## WordPress Plugin

Available at: [wordpress.org/plugins/radio-player-page](https://wordpress.org/plugins/radio-player-page)

---

## Local Development

There are two recommended workflows for developing the React frontend:

- **Standalone React development:**

  Runs only the React app using the `window` variables defined in `player/index.html`. Useful for working on the frontend in isolation, without a local WordPress instance.

  ```bash
  cd player
  npm install
  npm run dev
  ```

- **Integrated development with WordPress:**

  Continuously builds the frontend into the `dist/` folder, so you can test the plugin directly within your local WordPress installation.

  ```bash
  cd player
  npm install
  npm run dev:build
  ```

Choose the workflow that best fits your needs.

---

## Updates

Stay informed about the latest news and releases through the developer's Bluesky account, linked in the GitHub profile.
