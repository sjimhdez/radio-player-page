# Radio Player Page

[![Version](https://img.shields.io/badge/version-3.3.1-blue.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress](https://img.shields.io/badge/WordPress-6.6%2B-blue)](https://wordpress.org/plugins/radio-player-page/)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-blue)](https://www.php.net/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

Dedicated player pages for your radio stations, with program scheduling and continuous playback.

[View on WordPress.org](https://wordpress.org/plugins/radio-player-page) · [Report Issues](https://github.com/sjimhdez/radio-player-page/issues) · [Documentation](https://wordpress.org/plugins/radio-player-page/)

---

## Table of Contents

- [Description](#description)
- [Standalone Player Pages](#standalone-player-pages)
- [Broadcast Management](#broadcast-management)
- [Listener Experience](#listener-experience)
- [WordPress Blocks](#wordpress-blocks)
- [Built for Modern Web Performance](#built-for-modern-web-performance)
- [Quick Start](#quick-start)
- [Documentation for Developers](#documentation-for-developers)

---

## Description

**Radio Player Page** provides **dedicated, standalone player pages** for your radio streams on WordPress. It lets you create a full weekly schedule, manage your broadcasts, and present everything on pages designed for reliable playback without theme conflicts.

**The key differentiator:** Each station lives on its own independent HTML page, completely bypassing your WordPress theme. This ensures **zero theme conflicts, optimal performance, and one clear URL** per station.

Radio stations and radio shows are managed as WordPress custom post types (**RPP → Stations** and **RPP → Radio Shows**), and the plugin ships two WordPress blocks so schedule and show information can also be displayed inside normal WordPress content.

---

## Standalone Player Pages

Each station lives on its own independent HTML page, completely bypassing your WordPress theme. This ensures:

- **Zero theme conflicts** – No theme scripts or styles interfere with playback
- **Optimal performance** – Minimal HTTP requests, fast loading times
- **Clean URLs** – One dedicated URL per station
- **Reliable playback** – Continuous streaming without interruptions

### Full Weekly Schedule

Create a weekly lineup with named radio shows and optional logos. The player intelligently displays the current and next radio show, with timezone-aware calculations and overlap prevention.

- Define radio shows with names, optional short and extended descriptions, and optional logos
- Assign radio shows to time slots across the week
- Automatic detection of current and upcoming radio shows
- Visual display of the active radio show in the player
- Upcoming show announcements (shown 10 minutes before start)
- Validates for time overlaps and conflicts; supports radio shows that cross midnight
- Timezone-aware calculations based on your WordPress timezone
- Mark any time slot as a rerun, shown to listeners in the schedule and now-playing displays

### Universal Stream Compatibility

Works seamlessly with Icecast, Shoutcast, HLS (.m3u8), DASH (.mpd), and MP3 streams. Automatic protocol detection with native iOS Safari support for HLS.

- **Icecast & Shoutcast** – Traditional radio streaming protocols
- **HLS (.m3u8)** – Adaptive streaming with automatic quality adjustment
- **DASH (.mpd)** – Modern adaptive streaming standard
- **MP3 streams** – Standard audio streaming

**Smart protocol detection:** Automatically detects the stream format and uses the appropriate player. iOS Safari uses native HLS support; other browsers load the necessary libraries only when needed.

---

## Broadcast Management

### Multi-Station Support

Manage **multiple independent stations** from a single WordPress installation, each with its own stream, schedule, and branding.

- Each station has its own streaming URL
- A dedicated WordPress page
- Independent branding and configuration
- Separate weekly schedules (optional)

Perfect for radio networks, multi-channel stations, or managing multiple streams from one WordPress installation.

### Broadcast Timezone Clock

Keep a global audience informed. When your station's timezone differs from the listener's, a discreet clock shows the station's local time and the offset.

- **Timezone clock** displays the station's local time
- **Time difference indicator** shows the offset from the listener's timezone
- Always visible when timezones differ (independent of playback state)
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

### Welcome Audio

Optionally upload an MP3 for each station that plays once before the live stream starts, the first time a listener presses play.

### Convenience Features

- **Sleep timer** – Automatic playback stop (30 min, 1 h, 2 h) with visual countdown; cancels if you pause manually
- **Volume control** – Adjustable slider (not available on iOS due to system limitations)
- **Responsive design** – Optimized for desktop, tablet, and mobile
- **Social sharing** – Open Graph and Twitter Card meta tags for rich link previews on Facebook, Twitter/X, LinkedIn, WhatsApp, and similar platforms

### Multilingual Interface

Player interface available in **11 languages:** English (US), Spanish, Spanish (Mexico), Russian, Dutch, Romanian, Swedish, Galician, Danish, German, Portuguese (Brazil). Automatic language detection based on browser settings, with fallback to English.

---

## WordPress Blocks

Two WordPress blocks let you surface schedule and radio show information inside regular WordPress content, using the Block Editor:

- **Radio Schedule block** (`radplapag/schedule`) – Displays the complete weekly schedule for a selected radio station, with configurable day ordering and optional descriptions.
- **Radio Shows List block** (`radplapag/programs-list`) – Displays all radio shows for a selected station, including featured images, descriptions, and broadcast times.

Both blocks read live from the same radio station and radio show data used by the player pages, so there is nothing to keep in sync manually.

---

## Built for Modern Web Performance

The player is a self-contained application built with **React 19, TypeScript, and Vite**, ensuring a fast, accessible, and maintainable experience. It uses manifest-based asset loading for seamless updates.

---

## Quick Start

**Requirements:** WordPress 6.6+, PHP 7.4+, and a valid streaming URL.

1. Upload the `radio-player-page` folder to the `/wp-content/plugins/` directory, or install the plugin through the WordPress Plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Go to **RPP → Stations** in the admin menu. Click **Add New** to create a station.
4. For each station:
   - Enter your **Streaming URL** (Icecast, Shoutcast, HLS, DASH, or MP3).
   - Select the **WordPress page** where the player should appear.
   - Optionally customize: title, theme color, visualizer type, background image, logo, and welcome audio.
5. Publish or update the station and visit the assigned page. Optionally use **RPP → Radio Shows** to create radio shows and build the weekly schedule on each station.

**Important:** Each station requires both a valid streaming URL and an assigned WordPress page. No configuration is needed on the page itself—the plugin intercepts page requests and serves the player when that page is requested.

---

## Documentation for Developers

### Requirements

- **WordPress** 6.6+
- **PHP** 7.4+
- **Node.js** 20.x (development only; see `player/.nvmrc`)

**Uninstall:** When the plugin is uninstalled (not just deactivated), `uninstall.php` removes all station and radio show CPT posts and flushes the object cache. Data is not removed on deactivation.

### Data Model

Since version 3.3.0, stations and radio shows are stored as WordPress custom post types rather than in a single settings option:

- **`radplapag_station`** – One post per station: stream URL, assigned WordPress page, title, theme color, visualizer choice, background/logo/welcome audio attachment IDs, and the weekly schedule (stored as post meta).
- **`radplapag_program`** – One post per radio show: name, short/extended description, optional logo.
- Editing, deleting, or publishing either CPT requires the `manage_options` capability, not the default post-type capabilities.
- Sites upgrading from a pre-3.3.0 installation are migrated automatically and one-way from the legacy `radplapag_settings` option into CPT posts.

### Architecture and Data Flow

The plugin uses WordPress `template_redirect` to intercept requests for pages assigned to a station. It then outputs a minimal HTML document that loads the React player and injects configuration via three global variables. The React app combines and validates them with `useConfig()`.

```
WordPress page request
  → template_redirect
  → radplapag_get_station_for_current_page()
  → radplapag_output_clean_page()
  → Reads manifest.json, loads fingerprinted assets
  → Outputs HTML with:
      window.RADPLAPAG_CONFIG   (streamUrl, siteTitle, themeColor, visualizer,
                                  backgroundImage, logoImage, introAudioUrl, timezoneOffset)
      window.RADPLAPAG_PROGRAMS (array of { id, name, description?, extendedDescription?, logoUrl? })
      window.RADPLAPAG_SCHEDULE (weekly schedule: day → [{ program_id, start, end, is_rerun? }, ...])
  → React: useConfig() → ResolvedConfig
  → Components use useConfig() for config, schedule, and radio shows
```

`program_id` in the schedule is the radio show's post ID (as a string), matched against `id` in `RADPLAPAG_PROGRAMS` — this relational split avoids duplicating radio show data across every schedule slot.

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
├── radio-player-page.php          # Main plugin file, template redirect, block registration
├── uninstall.php                  # Removes CPT posts on uninstall (multisite-aware)
├── includes/
│   ├── radplapag-station-cpt.php  # radplapag_station CPT registration
│   ├── radplapag-program-cpt.php  # radplapag_program CPT registration
│   ├── radplapag-stations.php     # Read path: radplapag_get_stations(), radplapag_get_config()
│   ├── radplapag-upgrade.php      # DB version gate, triggers migration
│   ├── radplapag-schedule-block.php
│   ├── radplapag-programs-list-block.php
│   ├── data/                      # Radplapag_Station_Config, Radplapag_Program_Config
│   └── migration/                 # Legacy settings-option → CPT one-way migrator
├── admin/                         # Loaded when is_admin()
│   ├── admin.php                  # Bootstrap, hooks, menu
│   ├── admin-strings.php          # JS localization (radplapag_get_admin_strings)
│   ├── css/, js/                  # Admin styles and form logic
├── blocks/
│   ├── schedule/                  # Radio Schedule block (block.json, render.php, build/)
│   └── programs-list/             # Radio Shows List block (block.json, render.php, build/)
├── player/                        # React frontend
│   ├── src/                       # Components, hooks, config, locales, types, utils
│   ├── dist/                      # Build output (generated, committed)
│   ├── vite.config.ts
│   └── package.json
├── scripts/                       # run-eslint, run-wp-plugin-check, run-php-versions-check, build-release-zip
└── readme.txt                     # WordPress.org readme format
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

`player/dist/` and each block's `build/` directory are generated but committed — CI fails if they're stale, so rebuild and commit after touching `player/src` or `blocks/*/src`.

CI runs on GitHub Actions via [.github/workflows/test.yml](.github/workflows/test.yml): PHP syntax (7.4 and 8.4), player lint/build, WordPress block builds, and Plugin Check (on push to `main` or PRs that touch PHP/admin/readme). Scripts in `scripts/` mirror those checks locally (e.g. `./scripts/run-eslint.sh`, `./scripts/run-wp-plugin-check.sh`, `./scripts/run-php-versions-check.sh`, `./scripts/build-release-zip.sh --build`).

### API Reference

**WordPress**

- **Action** `template_redirect`: Intercepts requests for player pages.
- **Filters:** None exposed.

**JavaScript globals** (set by PHP before React; combined in React via `useConfig()`):

- **`window.RADPLAPAG_CONFIG`** – `streamUrl`, `siteTitle`, `backgroundImage`, `logoImage`, `introAudioUrl` (optional welcome audio, played once before the live stream on first play), `themeColor`, `visualizer`, `timezoneOffset` (WordPress timezone, hours from UTC).
- **`window.RADPLAPAG_PROGRAMS`** – Array of `{ id, name, description?, extendedDescription?, logoUrl? }`. Optional.
- **`window.RADPLAPAG_SCHEDULE`** – Weekly schedule: `{ monday?: [{ program_id, start, end, is_rerun? }], ... }`. `program_id` is the radio show's post ID (as a string), matched against `id` in `RADPLAPAG_PROGRAMS`; times are `"HH:MM"` (24-hour); `is_rerun` marks the slot as a rerun. Optional.

**PHP (public)**

- `radplapag_get_config()` – Returns config array with key `stations` (ordered list from CPT).
- `radplapag_get_stations()` – Returns the ordered list of published station configs.
- `radplapag_get_station_for_current_page()` – Returns the station config for the current page, or `false`.

### Internationalization

Player UI locales: en-US, es, es-MX, ru-RU, nl-NL, ro-RO, sv-SE, gl-ES, da-DK, de-DE / de_DE, pt-BR / pt_BR. Detection: HTML `lang` → localStorage → navigator. For German (de_DE) and Portuguese Brazil (pt_BR), terminology follows the [WordPress German glossary](https://translate.wordpress.org/locale/de/default/glossary/) and [WordPress Portuguese Brazil glossary](https://translate.wordpress.org/locale/pt-br/default/glossary/) where applicable.

**Adding a new language:** (1) Add a JSON file in `player/src/locales/` with the same keys as `en-US.json`. (2) Import it and register the locale in `player/src/config/i18n.ts` (use both hyphen and underscore keys if the locale has a region, e.g. `de-DE` and `de_DE`, so WordPress `lang` and browser codes both work). (3) Update this README. Source strings are English (en-US). For locales with an official WordPress glossary (e.g. de_DE), use the [glossary and style guide](https://make.wordpress.org/polyglots/handbook/translating/glossaries-and-style-guides-per-locale/) when translating.

### Security and Browser Support

- Stream URLs validated with `esc_url_raw()`; visualizer and theme values whitelisted; station meta saved in CPT with `radplapag_sanitize_station_schedule()`; attachment IDs validated as integers; output escaped with WordPress escaping functions.
- Modern browsers with Web Audio API support; iOS Safari 10+ (native HLS); Chrome, Firefox, Edge (recent versions). Visualization requires Web Audio API.

### License

GPLv2 or later.
