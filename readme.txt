=== Radio Player Page ===
Contributors: sjimhdez
Tags: audio, icecast, radio player, radio station, streaming
Requires at least: 5.0
Tested up to: 6.9
Stable tag: 3.1.0
Requires PHP: 5.6
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Dedicated player pages for your radio streams, with program scheduling and continuous playback.

== Description ==

Radio Player Page **provides dedicated, standalone player pages** for your radio streams on WordPress. It lets you create a full weekly program schedule, manage your broadcasts, and present everything on pages that guarantee reliable, theme-independent listening.

= Standalone Player Pages =

* **Standalone Player Pages** – Each station lives on its own independent HTML page, completely bypassing your WordPress theme. This ensures **zero theme conflicts, optimal performance, and one clear URL** per station.
* **Full Program Scheduling** – Create a weekly lineup with named shows and optional logos. The player intelligently displays the current and next program, with timezone-aware calculations and overlap prevention.
* **Universal Stream Compatibility** – Works seamlessly with Icecast, Shoutcast, HLS (.m3u8), DASH (.mpd), and MP3 streams. Automatic protocol detection with native iOS Safari support for HLS.

= Broadcast Management =

* **Multi-Station Control** – Manage up to 10 independent stations from a single WordPress installation, each with its own stream, schedule, and branding.
* **Emission Timezone Clock** – Keep a global audience informed. When your station's timezone differs from the listener's, a discreet clock shows the station's local time and the offset.
* **Media Session API** – Professional integration with device lock screens and media controls, displaying station art and info.

= Listener Experience =

* **Informed Listening** – The player clearly shows **what's on air now and what's coming next**.
* **Visual Customization** – Choose from 8 color themes and 4 real-time audio visualizers (powered by Web Audio API) to match your station's brand.
* **Station Branding** – Upload custom background images and logos for each station.
* **Convenience Features** – Sleep timer, responsive design, and social sharing meta tags for rich link previews.

**Built for Modern Web Performance**
The player is a self-contained application built with **React 19, TypeScript, and Vite**, ensuring a fast, accessible, and maintainable experience. It uses manifest-based asset loading for seamless updates.

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

= 3.1.0 =
* Added program schedule
* Added emission timezone clock