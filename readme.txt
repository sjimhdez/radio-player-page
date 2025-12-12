=== Radio Player Page ===
Contributors: sjimhdez
Tags: audio, icecast, radio player, shoutcast, streaming
Requires at least: 5.0
Tested up to: 6.9
Stable tag: 1.2.1
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Create a dedicated page for your Icecast, Shoutcast, or MP3 radio. Continuous playback without interruptions.

== Description ==

Radio Player Page creates dedicated, independent pages for your radio streams, providing continuous playback without interruptions. The plugin serves a clean, standalone HTML page with an embedded React application, ensuring complete theme independence and optimal performance.

**Streaming Protocol Support**

* Icecast and Shoutcast streams
* MP3 direct streams
* HLS with .m3u8 extension
* DASH with .mpd extension

The plugin automatically detects the stream type and uses the appropriate playback method, including native browser support on iOS Safari for HLS streams.

**Key Features**

* **Multiple Station Management** – Configure up to 10 independent radio stations, each with its own dedicated WordPress page
* **Four Audio Visualizers** – Choose from Oscilloscope (Waves), Bars Spectrum, Amplitude Waterfall, or Spectral Particles for real-time audio visualization
* **Eight Color Themes** – Customize the player appearance with Neutral, Blue, Green, Red, Orange, Yellow, Purple, or Pink color schemes
* **Custom Branding** – Upload custom background images and logos for each station
* **Custom Station Titles** – Set a unique title for each stream, or use your site name as default
* **Sleep Timer** – Set automatic playback stop after 30 minutes, 1 hour, or 2 hours
* **Volume Control** – Adjustable volume slider (not available on iOS devices due to system limitations)
* **Media Session API** – Displays station information and artwork on device lock screens and media controls
* **Responsive Design** – Optimized for desktop, tablet, and mobile devices
* **Internationalization** – Built-in support for English, Spanish, and Russian with automatic locale detection
* **Theme Independence** – Player pages run completely independently of your WordPress theme
* **Performance Optimized** – Lightweight architecture with minimal HTTP requests

**Visualizers**

The plugin includes four distinct audio visualizers powered by the Web Audio API:

* **Oscilloscope (Waves)** – Classic waveform visualization showing time-domain audio data
* **Bars Spectrum** – Frequency-domain visualization with animated bars representing audio spectrum
* **Amplitude Waterfall** – Time-based visualization displaying amplitude changes over time
* **Spectral Particles** – Dynamic particle system responding to frequency data

Each visualizer can be selected per station in the plugin settings.

**Customization Options**

For each station, you can configure:

* Stream URL (required)
* WordPress page assignment (required)
* Custom station title (optional)
* Theme color selection (8 options)
* Visualizer type (4 options)
* Background image upload
* Logo image upload

The player automatically uses your site's favicon if no custom logo is provided.

**Technical Details**

The player interface is built with React 19, TypeScript, and Material-UI, providing a modern, accessible user experience. The plugin uses Vite for asset bundling and includes proper cache busting through manifest-based asset loading.

== Installation ==

1. Upload the `radio-player-page` folder to the `/wp-content/plugins/` directory, or install the plugin through the WordPress Plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Navigate to **Settings → Radio Player Page Settings**.
4. For each stream you want to configure:
   * Enter your streaming URL (Icecast, Shoutcast, HLS, DASH, or MP3 format).
   * Select the WordPress page where the player should appear.
   * Optionally add a custom stream title (defaults to your site name if left blank).
   * Choose a theme color from the available options.
   * Select a visualizer type for audio visualization.
   * Optionally upload a background image and logo for branding.
5. Click **Save Changes**.
6. Visit the assigned page to see the player in action.

**Requirements**

* WordPress 5.0 or higher
* PHP 7.4 or higher
* A valid streaming URL (Icecast, Shoutcast, HLS, DASH, or MP3)

**Important Notes**

* Each station requires both a valid stream URL and an assigned WordPress page.
* Stream URLs must be accessible and properly formatted.
* Incomplete entries (missing URL or page) are automatically filtered during save.
* Settings are automatically migrated from older plugin versions.

== Frequently Asked Questions ==

= How many radio stations can I configure? =

You can configure up to 10 independent radio stations, each with its own dedicated WordPress page.

= What streaming protocols are supported? =

The plugin supports Icecast, Shoutcast, MP3 direct streams, HLS (.m3u8), and DASH (.mpd) formats. The plugin automatically detects the stream type and uses the appropriate playback method.

= Can I customize the player appearance? =

Yes. For each station, you can customize:
* Theme color (8 color options)
* Visualizer type (4 visualization styles)
* Background image
* Logo image
* Custom station title

The player automatically uses your site's favicon if no custom logo is provided.

= What visualizers are available? =

The plugin includes four audio visualizers:
* Oscilloscope (Waves) – Classic waveform visualization
* Bars Spectrum – Frequency-domain bar visualization
* Amplitude Waterfall – Time-based amplitude visualization
* Spectral Particles – Dynamic particle system

Each visualizer can be selected per station in the plugin settings.

= Why is the volume control not available on my device? =

Volume control is not available on iOS devices due to system limitations. iOS devices use the system volume controls instead.

= What is the sleep timer feature? =

The sleep timer allows you to automatically stop playback after a set duration. Available options are 30 minutes, 1 hour, or 2 hours. The timer only runs while playback is active and can be cancelled at any time.

= Does the player work on mobile devices? =

Yes. The player is fully responsive and optimized for desktop, tablet, and mobile devices. It uses native HLS support on iOS Safari for optimal performance.

= Can I use this for commercial radio stations? =

Yes. The plugin is free and open-source, suitable for both commercial and non-commercial radio stations.

= Will the player conflict with my theme? =

No. The player pages are completely independent of your WordPress theme. They are served as standalone HTML pages without loading theme styles or scripts, ensuring zero conflicts.

= Does the plugin support Media Session API? =

Yes. The plugin uses the Media Session API to display station information and artwork on device lock screens and media control interfaces, providing a native app-like experience.

= Where can I get support or report issues? =

Visit the WordPress Support Forum for help, feature requests, and to report any bugs.

= Where can I view the full source code? =

The source code is hosted on GitHub. See the repository for contributions and issue tracking.

== Screenshots ==

1. Radio Player Page displayed on a mobile device, showing the clean, minimal interface optimized for mobile listening with responsive design.
2. Radio Player Page on a desktop device, featuring one of the four available audio visualizers and full player controls including play/pause, volume, and sleep timer.
3. Plugin Settings screen, showing the interface for managing up to 10 radio stations with customization options for each stream.
4. Visualizer selection in the admin interface, displaying the four available visualization options: Oscilloscope, Bars Spectrum, Amplitude Waterfall, and Spectral Particles.
5. Theme color selection dropdown showing all eight available color schemes for customizing the player appearance.

== Changelog ==

= 2.1.1 =
* Added visualizer selection feature - admins can now choose between four different audio visualizers (Oscilloscope/Waves, Bars Spectrum, Amplitude Waterfall, and Spectral Particles) for each stream
* Improved visualizer system with support for time-domain and frequency-domain data
* Enhanced admin interface with visualizer selection dropdown
* Added extensible visualizer registry system for future visualizer additions

= 1.2.1 =
* Added support for HLS (.m3u8) and DASH (.mpd) streaming using hls.js and dash.js libraries
* Improved streaming protocol detection and handling

= 1.2.0 =
* Added support for multiple streams (up to 10 streams)
* Added optional custom stream title field for each stream
* Improved Settings screen with dynamic streaming management interface
* Added backward compatibility migration for existing users upgrading from single-stream version
* Enhanced user experience with better form validation and page selection
