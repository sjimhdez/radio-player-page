# Radio Player Page

[![Version](https://img.shields.io/badge/version-2.0.2-blue.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)](https://wordpress.org/plugins/radio-player-page/)
[![PHP](https://img.shields.io/badge/PHP-5.6%2B-blue)](https://www.php.net/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

[View on WordPress.org](https://wordpress.org/plugins/radio-player-page) · [Report Issues](https://github.com/sjimhdez/radio-player-page/issues) · [Documentation](https://wordpress.org/plugins/radio-player-page/)

---

## Table of Contents

- [What Is This?](#what-is-this)
- [Who Is It For?](#who-is-it-for)
- [Core Features](#core-features)
- [Professional Broadcasting Features](#professional-broadcasting-features)
- [Visual Customization](#visual-customization)
- [User Experience Features](#user-experience-features)
- [Quick Start](#quick-start)
- [Documentation for Developers](#documentation-for-developers)

---

## What Is This?

**Radio Player Page** is an official WordPress.org plugin that creates dedicated, standalone pages for your radio streams. Each player lives on its own URL, loads as a clean HTML page, and provides continuous playback without theme or plugin conflicts.

**The key differentiator:** Player pages are fully independent—no theme styles or scripts are loaded. You get a focused listening experience, optimal performance, and one clear URL per station.

## Who Is It For?

- **Radio stations and broadcasters** who need a reliable, professional web player
- **Podcasts or live streams** requiring dedicated pages per stream
- **Any WordPress site** that needs a "radio player page" that just works, with optional program schedule and branding

---

## Core Features

### Standalone Player Pages

**The foundation:** Each player is served as a completely independent HTML page, bypassing your WordPress theme entirely. This ensures:

- **Zero theme conflicts** – No theme scripts or styles interfere with playback
- **Optimal performance** – Minimal HTTP requests, fast loading times
- **Clean URLs** – One dedicated URL per station
- **Reliable playback** – Continuous streaming without interruptions

### Universal Streaming Protocol Support

Works with virtually any streaming format:

- **Icecast & Shoutcast** – Traditional radio streaming protocols
- **HLS (.m3u8)** – Adaptive streaming with automatic quality adjustment
- **DASH (.mpd)** – Modern adaptive streaming standard
- **MP3 streams** – Standard audio streaming

**Smart protocol detection:** Automatically detects the stream format and uses the appropriate player. iOS Safari uses native HLS support; other browsers load the necessary libraries only when needed.

### Multi-Station Management

Configure up to **10 independent stations**, each with:

- Its own streaming URL
- A dedicated WordPress page
- Independent branding and configuration
- Separate program schedules (optional)

Perfect for radio networks, multi-channel stations, or managing multiple streams from a single WordPress installation.

---

## Professional Broadcasting Features

### Program Schedule System

**Complete weekly programming management:**

- Define programs with names and optional logos
- Assign programs to time slots across the week
- Automatic detection of current and upcoming programs
- Visual display of active program in the player
- Upcoming program announcements (shows 10 minutes before start)

**Smart scheduling:**

- Validates for time overlaps and conflicts
- Supports programs that cross midnight
- Timezone-aware calculations based on your WordPress timezone
- Relational data structure prevents duplicate program definitions

### Emission Timezone Awareness

When your station's timezone differs from listeners around the world:

- **Timezone clock** displays the station's local time
- **Time difference indicator** shows the offset from the listener's timezone
- Only appears when playback is active and timezones differ
- Helps international audiences understand program timing

### Media Session API Integration

Professional integration with device controls:

- **Lock screen controls** – Station name and artwork on mobile devices
- **Desktop media controls** – Shows station info in system media controls
- **Play/pause synchronization** – Controls work seamlessly across devices
- **Artwork display** – Station logo appears in notifications and controls

---

## Visual Customization

### Eight Color Themes

Choose from eight professionally designed color schemes:

**Neutral, Blue, Green, Red, Orange, Yellow, Purple, Pink**

Each theme is optimized for dark mode viewing and provides a cohesive visual experience. Select a different theme for each station to match your branding.

### Four Audio Visualizers

Real-time audio visualization powered by Web Audio API:

- **Oscilloscope** – Classic waveform display (default)
- **Bars Spectrum** – Frequency bars visualization
- **Amplitude Waterfall** – Cascading amplitude display
- **Spectral Particles** – Dynamic particle effects

Visualizers are lazy-loaded for optimal performance and only activate when audio is playing.

### Custom Branding

Personalize each station:

- **Background images** – Upload custom backgrounds per station
- **Station logos** – Custom logos displayed in the player
- **Station titles** – Set unique titles or use your site name

---

## User Experience Features

### Sleep Timer

Automatic playback stop for bedtime listening:

- **Three duration options:** 30 minutes, 1 hour, or 2 hours
- **Visual countdown** – See remaining time at a glance
- **Auto-cancel** – Timer cancels if you pause playback manually
- **Easy cancellation** – Stop the timer anytime with one click

### Volume Control

Adjustable volume slider in the player interface. Note: Volume control is not available on iOS devices due to system limitations—iOS uses system volume controls instead.

### Multilingual Interface

Player interface available in **9 languages:**

**en-US, es, es-MX, ru-RU, nl-NL, ro-RO, sv-SE, gl-ES, da-DK**

Automatic language detection based on browser settings, with fallback to English.

### Responsive Design

Optimized for all devices:

- **Desktop** – Full-featured experience with all controls
- **Tablet** – Touch-optimized interface
- **Mobile** – Streamlined layout for small screens

Works seamlessly across modern browsers and devices.

---

## Quick Start

**Requirements:** WordPress 5.0+, PHP 5.6+, and a valid streaming URL.

1. Install the plugin into `/wp-content/plugins/radio-player-page/` (or install via the WordPress Plugins screen).
2. Activate the plugin.
3. Go to **Settings → Radio Player Page Settings**.
4. Add at least one station:
   - Enter the **Streaming URL** (Icecast, Shoutcast, HLS, DASH, or MP3).
   - Select the **WordPress page** where the player should appear.
   - Optionally customize: station title, theme color, visualizer, background image, and logo.
5. Click **Save Changes** and open the assigned page in your browser.

Each station must have both a valid stream URL and an assigned page. No configuration is needed on the page itself—the plugin serves the player when that page is requested.

**Optional:** Configure program schedules, upload custom branding, and customize visual settings per station.

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
- **`window.RADPLAPAG_PROGRAMS`** – Array of `{ name, logoUrl? }`. Optional.
- **`window.RADPLAPAG_SCHEDULE`** – Weekly schedule: `{ monday?: [{ program_id, start, end }], ... }`. `program_id` is index into `RADPLAPAG_PROGRAMS`; times are `"HH:MM"` (24-hour). Optional.

**PHP (public)**

- `radplapag_get_settings()` – Returns the full plugin settings array (stations, each with optional `programs` and `schedule`).
- `radplapag_get_station_for_current_page()` – Returns the station config for the current page, or `false`.

### Internationalization

Player UI locales: en-US, es, es-MX, ru-RU, nl-NL, ro-RO, sv-SE, gl-ES, da-DK. Detection: HTML `lang` → localStorage → navigator. To add a language: add a JSON file in `player/src/locales/` and register it in `player/src/config/i18n.ts`.

### Security and Browser Support

- Stream URLs validated with `esc_url_raw()`; visualizer and theme values whitelisted; settings sanitized via the WordPress Settings API; attachment IDs validated as integers; output escaped with WordPress escaping functions.
- Modern browsers with Web Audio API support; iOS Safari 10+ (native HLS); Chrome, Firefox, Edge (recent versions). Visualization requires Web Audio API.

### License

GPLv2 or later.
