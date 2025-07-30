# Radio Player Page

[![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)](https://github.com/tuusuario/radio-player-page)
[![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)](https://wordpress.org/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

**Contributors:** sjimhdez  
**Tags:** audio, streaming, radio, player, live
**Requires at least:** 5.0  
**Tested up to:** 6.8  
**Requires PHP:** 7.4  
**Stable tag:** 1.0.2
**License:** GPLv2 or later  
**License URI:** [https://www.gnu.org/licenses/gpl-2.0.html](https://www.gnu.org/licenses/gpl-2.0.html)

A clean, standalone audio player with waveform visualizer. Designed specifically for WordPress-based radio stations.

---

## Description

Many WordPress-based radio stations either rely on direct streaming links that open in the browser—resulting in an unbranded and clunky experience—or require inserting shortcode-based players, which still render within the clutter of the site layout.

Other existing plugin solutions often overcomplicate the player with excessive features, scripts, and styling dependencies, leading to slow loading times and a poor user experience.

**Radio Player Page** solves this with a focused solution: it creates a dedicated page that strips out all WordPress theme elements and loads only the essentials—a modern audio player and a real-time waveform visualizer.

This is the first plugin to abstract the radio player entirely from the rest of the website, providing a standalone environment focused solely on the listening experience.

This ensures a distraction-free, lightweight, and branded listening experience. Ideal for users who want to keep the player open in a separate tab or as a central page for continuous radio playback.

This plugin was originally developed for a real radio project, where a minimal interface proved to significantly improve user engagement and listening time.

Note: This plugin is production-ready but currently under review by the official WordPress plugins team. You can install and use it safely; any updates or changes required by the review process will be communicated promptly.

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
3. Go to **Settings > Live Radio** to:
   - Set your stream URL (e.g. Icecast, Shoutcast, MP3 stream).
   - Select the page where the player will be injected.
