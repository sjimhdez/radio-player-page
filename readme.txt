=== Radio Player Page ===
Contributors: sjimhdez
Tags: audio, icecast, radio player, shoutcast, streaming
Requires at least: 5.0
Tested up to: 6.9
Stable tag: 2.0.2
Requires PHP: 5.6
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Create a dedicated page for your Icecast, Shoutcast, HLS, DASH, or MP3 radio. Continuous playback without interruptions.

== Description ==

Radio Player Page creates dedicated, independent pages for your radio stations, with continuous playback without interruptions. The plugin serves a clean, standalone HTML page with an embedded React application, ensuring complete theme independence and optimal performance.

= Core Features =

* **Standalone Player Pages** – The plugin serves each player as a completely independent HTML page, bypassing your WordPress theme entirely. No theme scripts or styles are loaded on player URLs. You get a focused listening experience and one clear URL per station.
* **Streaming Protocol Support** – Automatically detects and handles Icecast, Shoutcast, DASH (.mpd), HLS (.m3u8), and MP3 formats. iOS Safari uses native HLS support; other browsers use the appropriate library when needed.
* **Multiple Station Management** – Configure up to 10 stations, each with its own streaming URL and dedicated WordPress page.

= Broadcasting Features =

* **Program Schedule** – Optional weekly schedule with program names and optional logos. The player shows the current program and the next one when it starts in 10 minutes or less. Prevents time overlaps and supports programs that cross midnight. Uses timezone-aware calculations based on your WordPress timezone.
* **Emission Timezone Clock** – When the stream is playing and your site timezone differs from the listener's, a small clock shows the station's time and the difference.
* **Media Session API** – Station name and artwork on device lock screens and media controls.

= Visual Customization =

* **Eight Color Themes** – Neutral, Blue, Green, Red, Orange, Yellow, Purple, or Pink per station.
* **Four Audio Visualizers** – Oscilloscope, Bars Spectrum, Amplitude Waterfall, or Spectral Particles, powered by the Web Audio API.
* **Custom Branding** – Upload an optional background image and logo per station.

= User Experience Features =

* **Sleep Timer** – Stop playback automatically after 30 minutes, 1 hour, or 2 hours.
* **Responsive Design** – Works on desktop, tablet, and mobile.
* **Social Sharing** – Meta tags for rich previews when sharing player pages on social networks.

**Technical Details**

The player interface is built with React 19, TypeScript, and Material-UI, providing a modern, accessible user experience. The plugin uses Vite for asset bundling and includes proper cache busting through manifest-based asset loading.

== Installation ==

1. Upload the `radio-player-page` folder to the `/wp-content/plugins/` directory, or install the plugin through the WordPress Plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Navigate to **Settings → Radio Player Page Settings**.
4. For each station:
   * Enter your streaming URL (Icecast, Shoutcast, HLS, DASH, or MP3)
   * Select the WordPress page where the player should appear
   * Optionally customize: title, theme color, visualizer type, background image, and logo
5. Click **Save Changes** and visit the assigned page

**Important Notes**

* Each station requires both a valid streaming URL and an assigned WordPress page

== Frequently Asked Questions ==

= Do I need to configure anything on the WordPress page? =

No. Once you assign a page to a station in the plugin settings, no additional configuration is needed on the page itself. The plugin intercepts page requests using WordPress template redirect hooks and serves a standalone HTML page with the player. The page content, template, and any existing settings are bypassed, ensuring the player displays correctly without any page-level configuration.

= Where can I get support or report issues? =

Visit the [WordPress Support Forum](https://wordpress.org/support/plugin/radio-player-page/) for help, feature requests, and to report any bugs.

= Can I use this for commercial radio stations? =

Yes. The plugin is free and open-source (GPLv2 or later), suitable for both commercial and non-commercial radio stations.

= Where can I view the full source code? =

The source code is hosted on [GitHub](https://github.com/sjimhdez/radio-player-page).

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
* Added theme color selection - choose from eight color themes (Neutral, Blue, Green, Red, Orange, Yellow, Purple, Pink) for each station
* Added visualizer selection - choose from four audio visualizers (Oscilloscope, Bars Spectrum, Amplitude Waterfall, Spectral Particles) for each stream
* Added Media Session API integration - displays station information and artwork on device lock screens and media controls