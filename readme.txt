=== Radio Player Page ===
Contributors: sjimhdez  
Tags: audio, streaming, radio, player, live  
Requires at least: 5.0  
Tested up to: 6.8  
Requires PHP: 7.4  
Stable tag: 1.0.4  
License: GPLv2 or later  
License URI: https://www.gnu.org/licenses/gpl-2.0.html  
Text Domain: radio-player-page  

A simple audio player for WordPress, rendering a fully standalone app in a clean, dedicated page.

== Description ==

Many WordPress-based radio stations either rely on direct streaming links that open in the browser—resulting in an unbranded and clunky experience—or require inserting shortcode-based players, which still render within the clutter of the site layout.

Other existing plugin solutions often overcomplicate the player with excessive features, scripts, and styling dependencies, leading to slow loading times and a poor user experience.

**Radio Player Page** solves this with a focused solution: it creates a dedicated page that strips out all WordPress theme elements and loads only the essentials—a modern audio player and a real-time waveform visualizer.

This is the first plugin to abstract the radio player entirely from the rest of the website, providing a standalone environment focused solely on the listening experience.

This ensures a distraction-free, lightweight, and branded listening experience. Ideal for users who want to keep the player open in a separate tab or as a central page for continuous radio playback.

This plugin was originally developed for a real radio project, where a minimal interface proved to significantly improve user engagement and listening time.

== Features == 

- **Minimal UI:** Clean, distraction-free page for optimal listening.
- **Visual Feedback:** Real-time waveform visualizer powered by the Web Audio API.
- **Frontend Decoupling:** Injects the player into a blank HTML shell (`<div id="root">`) with zero dependency on your active WordPress theme.
- **Built with Modern Tools:** Developed in React + TypeScript and bundled with Vite.
- **Fully Responsive:** Works seamlessly across devices, including mobile.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Go to **Settings > Radio Player Page Settings**
4. Set your stream URL and choose the page where the player will render

== Source Code ==

The source code and development documentation are available at:  
https://github.com/sjimhdez/radio-player-page

== Changelog ==

= 1.0.4 =
- Added usage instructions to the plugin settings page  
- Integrated i18n support in the player (en/es)  
- Refactored player bundle to improve structure and fix minor bugs

For the full development history, including all source code and bundle changes, please refer to the Git repository.
