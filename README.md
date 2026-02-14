# Radio Player Page

[![Version](https://img.shields.io/badge/version-3.2.0-blue.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)](https://wordpress.org/plugins/radio-player-page/)
[![PHP](https://img.shields.io/badge/PHP-5.6%2B-blue)](https://www.php.net/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

Dedicated player pages for your radio streams, with program scheduling and continous playback.

[View on WordPress.org](https://wordpress.org/plugins/radio-player-page) · [Report Issues](https://github.com/sjimhdez/radio-player-page/issues) · [Documentation](https://wordpress.org/plugins/radio-player-page/)

---

## Table of Contents

- [Description](#description)
- [Standalone Player Pages](#standalone-player-pages)
- [Broadcast Management](#broadcast-management)
- [Listener Experience](#listener-experience)
- [Built for Modern Web Performance](#built-for-modern-web-performance)
- [Quick Start](#quick-start)
- [Documentation for Developers](#documentation-for-developers)

---

## Description

**Radio Player Page** provides **dedicated, standalone player pages** for your radio streams on WordPress. It lets you create a full weekly program schedule, manage your broadcasts, and present everything on pages that guarantee reliable, theme-independent listening.

**The key differentiator:** Each station lives on its own independent HTML page, completely bypassing your WordPress theme. This ensures **zero theme conflicts, optimal performance, and one clear URL** per station.

---

## Standalone Player Pages

### Standalone Player Pages

Each station lives on its own independent HTML page, completely bypassing your WordPress theme. This ensures:

- **Zero theme conflicts** – No theme scripts or styles interfere with playback
- **Optimal performance** – Minimal HTTP requests, fast loading times
- **Clean URLs** – One dedicated URL per station
- **Reliable playback** – Continuous streaming without interruptions

### Full Program Scheduling

Create a weekly lineup with named shows and optional logos. The player intelligently displays the current and next program, with timezone-aware calculations and overlap prevention.

- Define programs with names, optional short and extended descriptions, and optional logos
- Assign programs to time slots across the week
- Automatic detection of current and upcoming programs
- Visual display of active program in the player
- Upcoming program announcements (shows 10 minutes before start)
- Validates for time overlaps and conflicts; supports programs that cross midnight
- Timezone-aware calculations based on your WordPress timezone

### Universal Stream Compatibility

Works seamlessly with Icecast, Shoutcast, HLS (.m3u8), DASH (.mpd), and MP3 streams. Automatic protocol detection with native iOS Safari support for HLS.

- **Icecast & Shoutcast** – Traditional radio streaming protocols
- **HLS (.m3u8)** – Adaptive streaming with automatic quality adjustment
- **DASH (.mpd)** – Modern adaptive streaming standard
- **MP3 streams** – Standard audio streaming

**Smart protocol detection:** Automatically detects the stream format and uses the appropriate player. iOS Safari uses native HLS support; other browsers load the necessary libraries only when needed.

---

## Broadcast Management

### Multi-Station Control

Manage up to **10 independent stations** from a single WordPress installation, each with its own stream, schedule, and branding.

- Its own streaming URL
- A dedicated WordPress page
- Independent branding and configuration
- Separate program schedules (optional)

Perfect for radio networks, multi-channel stations, or managing multiple streams from one WordPress installation.

### Emission Timezone Clock

Keep a global audience informed. When your station's timezone differs from the listener's, a discreet clock shows the station's local time and the offset.

- **Timezone clock** displays the station's local time
- **Time difference indicator** shows the offset from the listener's timezone
- Only appears when playback is active and timezones differ
- Helps international audiences understand program timing

### Media Session API

Professional integration with device lock screens and media controls, displaying station art and info.

- **Lock screen controls** – Station name and artwork on mobile devices
- **Desktop media controls** – Shows station info in system media controls
- **Play/pause synchronization** – Controls work seamlessly across devices
- **Artwork display** – Station logo appears in notifications and controls

---

## Listener Experience

### Informed Listening

The player clearly shows **what's on air now and what's coming next**.

### Visual Customization

Choose from **8 color themes** (Neutral, Blue, Green, Red, Orange, Yellow, Purple, Pink) and **4 real-time audio visualizers** (powered by Web Audio API) to match your station's brand:

- **Oscilloscope** – Classic waveform display (default)
- **Bars Spectrum** – Frequency bars visualization
- **Amplitude Waterfall** – Cascading amplitude display
- **Spectral Particles** – Dynamic particle effects

Visualizers are lazy-loaded for optimal performance and only activate when audio is playing.

### Station Branding

Upload custom background images and logos for each station. Personalize each station with unique titles, backgrounds, and logos.

### Convenience Features

- **Sleep timer** – Automatic playback stop (30 min, 1 h, 2 h) with visual countdown; cancels if you pause manually
- **Volume control** – Adjustable slider (not available on iOS due to system limitations)
- **Responsive design** – Optimized for desktop, tablet, and mobile
- **Social sharing** – Open Graph and Twitter Card meta tags for rich link previews on Facebook, Twitter/X, LinkedIn, WhatsApp, and similar platforms

### Multilingual Interface

Player interface available in **10 languages:** English (US), Spanish, Spanish (Mexico), Russian, Dutch, Romanian, Swedish, Galician, Danish, German. Automatic language detection based on browser settings, with fallback to English.

---

## Built for Modern Web Performance

The player is a self-contained application built with **React 19, TypeScript, and Vite**, ensuring a fast, accessible, and maintainable experience. It uses manifest-based asset loading for seamless updates.

---

## Quick Start

**Requirements:** WordPress 5.0+, PHP 5.6+, and a valid streaming URL.

1. Upload the `radio-player-page` folder to the `/wp-content/plugins/` directory, or install the plugin through the WordPress Plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Navigate to **Settings → Radio Player Page Settings**.
4. For each station:
   - Enter your **Streaming URL** (Icecast, Shoutcast, HLS, DASH, or MP3).
   - Select the **WordPress page** where the player should appear.
   - Optionally customize: title, theme color, visualizer type, background image, and logo.
5. Click **Save Changes** and visit the assigned page.

**Important:** Each station requires both a valid streaming URL and an assigned WordPress page. No configuration is needed on the page itself—the plugin intercepts page requests and serves the player when that page is requested.

---

## Documentation for Developers

### Requirements

- **WordPress** 5.0+
- **PHP** 5.6+
- **Node.js** 20.x (development only; see `player/.nvmrc`)

**Uninstall:** When the plugin is uninstalled (not just deactivated), `uninstall.php` removes the option `radplapag_settings` from the database (and from each site on multisite) and flushes the object cache. Data is not removed on deactivation.

### Architecture and Data Flow

The plugin uses WordPress `template_redirect` to intercept requests for pages assigned to a station. It then outputs a minimal HTML document that loads the React player and injects configuration via three global variables. The React app combines and validates them with `useConfig()`.

```
WordPress page request
  → template_redirect
  → radplapag_get_station_for_current_page()
  → radplapag_output_clean_page()
  → Reads manifest.json, loads fingerprinted assets
  → Outputs HTML with:
      window.RADPLAPAG_CONFIG   (streamUrl, theme, visualizer, timezoneOffset; no schedule/programs)
      window.RADPLAPAG_PROGRAMS (array of { name, logoUrl? })
      window.RADPLAPAG_SCHEDULE (weekly schedule: day → [{ program_id, start, end }, ...])
  → React: useConfig() → ResolvedConfig
  → Components use useConfig() for config, schedule, and programs
```

Asset paths come from Vite's `manifest.json` (content-hashed filenames) for cache busting.

### Technology Stack

| Component     | Purpose                        |
| ------------- | ------------------------------ |
| React         | UI framework                   |
| TypeScript    | Type safety                    |
| Vite          | Build tool and dev server      |
| Material-UI   | Component library              |
| hls.js        | HLS streaming (non-iOS)        |
| dashjs        | DASH streaming                 |
| i18next       | Internationalization           |
| date-fns      | Date/time formatting           |
| Web Audio API | Audio analysis for visualizers |

Node 20.x is used for development (`player/.nvmrc`, `player/package.json`).

### Project Structure

```
radio-player-page/
├── radio-player-page.php      # Main plugin file, template redirect
├── uninstall.php              # Removes radplapag_settings on uninstall (multisite-aware)
├── includes/
│   └── radplapag-settings.php # Shared settings (radplapag_get_settings)
├── admin/                      # Loaded when is_admin()
│   ├── admin.php               # Bootstrap, hooks
│   ├── sanitize-settings.php   # Sanitization and validation
│   ├── settings-page.php       # Settings UI and JS strings
│   ├── css/, js/               # Admin styles and form logic
├── player/                     # React frontend
│   ├── src/                    # Components, hooks, config, locales, types, utils
│   ├── dist/                   # Build output (generated)
│   ├── vite.config.ts
│   └── package.json
├── scripts/                    # run-eslint, run-wp-plugin-check, run-php-versions-check, build-release-zip
└── readme.txt                  # WordPress.org readme format
```

### Development

From the `player/` directory:

```bash
npm install
npm run build          # Production build to dist/
npm run dev            # Standalone dev server (http://localhost:5173), mock globals in index.html
npm run dev:build      # Watch mode; rebuilds to dist/ for testing in WordPress
npm run lint           # ESLint
```

**Standalone:** `npm run dev` uses mock `window.*` globals from `player/index.html` and hot reload.  
**WordPress:** Use `npm run dev:build` and load the player via the assigned page; manifest and assets are read from `dist/`.

The project uses [pre-commit](https://pre-commit.com/) for WordPress plugin check, PHP versions check, and ESLint. See [.github/workflows/test.yml](.github/workflows/test.yml) for CI. Scripts in `scripts/` can be run manually (e.g. `./scripts/run-eslint.sh`, `./scripts/build-release-zip.sh --build`).

### API Reference

**WordPress**

- **Action** `template_redirect`: Intercepts requests for player pages.
- **Filters:** None exposed.

**JavaScript globals** (set by PHP before React; combined in React via `useConfig()`):

- **`window.RADPLAPAG_CONFIG`** – `streamUrl`, `siteTitle`, `backgroundImage`, `logoImage`, `themeColor`, `visualizer`, `timezoneOffset` (WordPress timezone, hours from UTC).
- **`window.RADPLAPAG_PROGRAMS`** – Array of `{ name, description?, extendedDescription?, logoUrl? }`. Optional.
- **`window.RADPLAPAG_SCHEDULE`** – Weekly schedule: `{ monday?: [{ program_id, start, end }], ... }`. `program_id` is index into `RADPLAPAG_PROGRAMS`; times are `"HH:MM"` (24-hour). Optional.

**PHP (public)**

- `radplapag_get_settings()` – Returns the full plugin settings array (stations, each with optional `programs` and `schedule`).
- `radplapag_get_station_for_current_page()` – Returns the station config for the current page, or `false`.

### Internationalization

Player UI locales: en-US, es, es-MX, ru-RU, nl-NL, ro-RO, sv-SE, gl-ES, da-DK, de-DE / de_DE. Detection: HTML `lang` → localStorage → navigator. For German (de_DE), terminology follows the [WordPress German glossary](https://translate.wordpress.org/locale/de/default/glossary/) where applicable.

**Adding a new language:** (1) Add a JSON file in `player/src/locales/` with the same keys as `en-US.json`. (2) Import it and register the locale in `player/src/config/i18n.ts` (use both hyphen and underscore keys if the locale has a region, e.g. `de-DE` and `de_DE`, so WordPress `lang` and browser codes both work). (3) Update this README. Source strings are English (en-US). For locales with an official WordPress glossary (e.g. de_DE), use the [glossary and style guide](https://make.wordpress.org/polyglots/handbook/translating/glossaries-and-style-guides-per-locale/) when translating.

### Security and Browser Support

- Stream URLs validated with `esc_url_raw()`; visualizer and theme values whitelisted; settings sanitized via the WordPress Settings API; attachment IDs validated as integers; output escaped with WordPress escaping functions.
- Modern browsers with Web Audio API support; iOS Safari 10+ (native HLS); Chrome, Firefox, Edge (recent versions). Visualization requires Web Audio API.

### License

GPLv2 or later.
