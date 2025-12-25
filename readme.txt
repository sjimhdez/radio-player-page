=== Radio Player Page ===
Contributors: sjimhdez
Tags: audio, icecast, radio player, shoutcast, streaming
Requires at least: 5.0
Tested up to: 6.9
Stable tag: 2.0.2
Requires PHP: 5.6
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Create a dedicated page for your Icecast, Shoutcast, or MP3 radio. Continuous playback without interruptions.

== Description ==

Radio Player Page creates dedicated, independent pages for your radio streams, providing continuous playback without interruptions. The plugin serves a clean, standalone HTML page with an embedded React application, ensuring complete theme independence and optimal performance.

**Key Features**

* **Streaming Protocol Support** – Automatic detection and handling for Icecast, Shoutcast, MP3, HLS (.m3u8), and DASH (.mpd) formats. Uses native browser support on iOS Safari for HLS streams
* **Four Audio Visualizers** – Choose from Oscilloscope, Bars Spectrum, Amplitude Waterfall, or Spectral Particles for real-time audio visualization powered by Web Audio API
* **Eight Color Themes** – Customize appearance with Neutral, Blue, Green, Red, Orange, Yellow, Purple, or Pink color schemes
* **Custom Branding** – Upload custom background images and logos for each station (site favicon used if no custom logo provided)
* **Custom Station Titles** – Set a unique title for each stream, or use your site name as default
* **Sleep Timer** – Automatic playback stop after 30 minutes, 1 hour, or 2 hours
* **Multiple Stream Management** – Configure up to 10 independent streams, each with its own dedicated WordPress page
* **Volume Control** – Adjustable volume slider (not available on iOS devices due to system limitations)
* **Media Session API** – Displays station information and artwork on device lock screens and media controls
* **Responsive Design** – Optimized for desktop, tablet, and mobile devices
* **Performance Optimized** – Lightweight architecture with minimal HTTP requests

**Technical Details**

The player interface is built with React 19, TypeScript, and Material-UI, providing a modern, accessible user experience. The plugin uses Vite for asset bundling and includes proper cache busting through manifest-based asset loading.

== Installation ==

1. Upload the `radio-player-page` folder to the `/wp-content/plugins/` directory, or install the plugin through the WordPress Plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Navigate to **Settings → Radio Player Page Settings**.
4. For each stream:
   * Enter your streaming URL (Icecast, Shoutcast, HLS, DASH, or MP3)
   * Select the WordPress page where the player should appear
   * Optionally customize: title, theme color, visualizer type, background image, and logo
5. Click **Save Changes** and visit the assigned page

**Important Notes**

* Each station requires both a valid stream URL and an assigned WordPress page

== Frequently Asked Questions ==

= Will the player conflict with my theme? =

No. Player pages are completely independent of your WordPress theme, served as standalone HTML pages without loading theme styles or scripts.

= Do I need to configure anything on the WordPress page? =

No. Once you assign a page to a stream in the plugin settings, no additional configuration is needed on the page itself. The plugin intercepts page requests using WordPress template redirect hooks and serves a standalone HTML page with the player. The page content, template, and any existing settings are bypassed, ensuring the player displays correctly without any page-level configuration.

= Where can I get support or report issues? =

Visit the WordPress Support Forum for help, feature requests, and to report any bugs.

= What is the sleep timer feature? =

The sleep timer allows you to automatically stop playback after a set duration. Available options are 30 minutes, 1 hour, or 2 hours. The timer only runs while playback is active and can be cancelled at any time.

= Can I use this for commercial radio stations? =

Yes. The plugin is free and open-source, suitable for both commercial and non-commercial radio stations.

= Why is the volume control not available on my iOS device? =

Volume control is not available on iOS devices due to system limitations. iOS devices use the system volume controls instead.

= Where can I view the full source code? =

The source code is hosted on GitHub. See the repository for contributions and issue tracking.

== Screenshots ==

1. Player page example with blue theme color and Oscilloscope visualizer
2. Player page example with yellow theme color and Amplitude Waterfall visualizer
3. Player page example with green theme color and Bars Spectrum visualizer
4. Admin settings for managing stations

== Changelog ==

= 2.0.2 =
* Added player interface translations for Swedish, Dutch, Mexican Spanish, and Romanian
* Fixed the logic determining when to use translation files
* Ensured code compatibility starting from PHP 5.6

= 2.0.1 =
* Added player customization options - per-station configuration background images and logos
* Added theme color selection - choose from eight color themes (Neutral, Blue, Green, Red, Orange, Yellow, Purple, Pink) for each stream
* Added visualizer selection - choose from four audio visualizers (Oscilloscope, Bars Spectrum, Amplitude Waterfall, Spectral Particles) for each stream
* Added Media Session API integration - displays station information and artwork on device lock screens and media controls

= 1.2.1 =
* Added support for HLS (.m3u8) and DASH (.mpd) streaming using hls.js and dash.js
* Improved streaming protocol detection and handling

= 1.2.0 =
* Added support for multiple streams (up to 10)
* Added optional custom stream title field
* Improved Settings screen with dynamic streaming management interface
* Added backward compatibility migration from single-stream version
* Enhanced user experience with better form validation and page selection
