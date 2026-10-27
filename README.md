# Radio Player Page

[![Version](https://img.shields.io/badge/version-3.5.0-blue.svg)](https://wordpress.org/plugins/radio-player-page/)
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
- [Multi-Station Support](#multi-station-support)
- [Listener Experience](#listener-experience)
- [Additional Features](#additional-features)
- [WordPress Blocks](#wordpress-blocks)
- [Built for Modern Web Performance](#built-for-modern-web-performance)
- [Quick Start](#quick-start)
- [Documentation for Developers](#documentation-for-developers)

---

## Description

**Radio Player Page** provides **dedicated, standalone player pages** for your radio streams on WordPress. It lets you create a full weekly schedule, manage your broadcasts, and present everything on pages designed for reliable playback without theme conflicts.

**The key differentiator:** Each station lives on its own independent HTML page, completely bypassing your WordPress theme. This ensures **zero theme conflicts, optimal performance, and one clear URL** per station.

Radio stations and radio shows are managed as WordPress custom post types (**RPP → Stations** and **RPP → Radio Shows**), and the plugin ships three WordPress blocks so schedule, radio show, and on-air information can also be displayed inside normal WordPress content.

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

## Multi-Station Support

Manage **multiple independent stations** from a single WordPress installation, each with its own stream, schedule, and branding.

- Each station has its own streaming URL
- A dedicated WordPress page
- Independent branding and configuration
- Separate weekly schedules (optional)

Perfect for radio networks, multi-channel stations, or managing multiple streams from one WordPress installation.

---

## Listener Experience

The player clearly shows what's on air now and what's coming next, in an interface you can tailor to your station's brand and audience.

### Visual Customization

Choose from **8 color themes** (Neutral, Blue, Green, Red, Orange, Yellow, Purple, Pink) and **4 real-time audio visualizers** (powered by Web Audio API) to match your station's brand:

- **Oscilloscope** – Classic waveform display (default)
- **Bars Spectrum** – Frequency bars visualization
- **Amplitude Waterfall** – Cascading amplitude display
- **Spectral Particles** – Dynamic particle effects

Visualizers are lazy-loaded for optimal performance and only activate when audio is playing.

### Multilingual Interface

Player interface available in **14 languages:** English (US), Spanish, Spanish (Mexico), Russian, Dutch, Romanian, Swedish, Galician, Danish, German, Portuguese (Brazil), Italian, Czech, Croatian. The player follows your site language; a regional variant without its own translation uses its base language (e.g. German (Austria) → German), and any other language falls back to English.

---

## Additional Features

Smaller conveniences that round out the listener and admin experience:

- **Broadcast Timezone Clock** – When a station's timezone differs from the listener's, a discreet clock shows the station's local time and the offset; always visible, independent of playback state.
- **Media Session integration** – Station name and artwork on device lock screens and system media controls, with play/pause synced across devices.
- **Station Branding** – Custom background image and logo per station.
- **Welcome Audio** – Optional MP3 that plays once before the live stream starts, the first time a listener presses play.
- **Sleep Timer** – Automatic playback stop (30 min, 1 h, 2 h) with visual countdown; cancels if you pause manually.
- **Volume Control** – Adjustable slider (not available on iOS due to system limitations).
- **Responsive Design** – Optimized for desktop, tablet, and mobile.
- **Social Sharing** – Open Graph and Twitter Card meta tags for rich link previews on Facebook, Twitter/X, LinkedIn, WhatsApp, and similar platforms.

---

## WordPress Blocks

Three WordPress blocks let you surface schedule, radio show, and on-air information inside regular WordPress content, using the Block Editor:

- **Radio Schedule block** (`radplapag/schedule`) – Displays the complete weekly schedule for a selected radio station, with configurable day ordering and optional descriptions.
- **Radio Shows List block** (`radplapag/programs-list`) – Displays all radio shows for a selected station, including featured images, descriptions, and broadcast times.
- **Now Playing block** (`radplapag/now-playing`) – Displays the radio show currently on air for a selected station, plus the next show if it starts within 10 minutes. Renders empty on the front end when nothing is on air.

All three blocks read live from the same radio station and radio show data used by the player pages, so there is nothing to keep in sync manually.

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
- **Node.js** 26 (development only; `.nvmrc`; minimum `>=22.22.2`)

**Uninstall:** When the plugin is uninstalled (not just deactivated), `uninstall.php` removes all station and radio show CPT posts (trashed and auto-drafts included), the plugin's options, transients and internal meta, on every site of a multisite network, and flushes the object cache. Data is not removed on deactivation.

### Data Model

Since version 3.3.0, stations and radio shows are stored as WordPress custom post types rather than in a single settings option:

- **`radplapag_station`** – One post per station: stream URL, assigned WordPress page, title, theme color, visualizer choice, background/logo/welcome audio attachment IDs, and the weekly schedule (stored as post meta).
- **`radplapag_program`** – One post per radio show: name, short/extended description, optional logo.
- Editing, deleting, or publishing either CPT requires the `manage_options` capability, not the default post-type capabilities.
- Sites upgrading from a pre-3.3.0 installation are migrated automatically and one-way from the legacy `radplapag_settings` option into CPT posts.

### Architecture and Data Flow

The plugin uses WordPress `template_redirect` to intercept requests for pages assigned to a station. It then outputs a minimal HTML document that loads the React player and injects configuration via three global variables. The React app reads and validates them once, through `useConfig()` (validation and defaults live in the framework-free core, `player/src/core/config/read-config.ts`).

```
WordPress page request
  → template_redirect
  → radplapag_get_station_for_current_page()
  → radplapag_output_clean_page()
  → Reads manifest.json, loads fingerprinted assets
  → Outputs HTML with:
      window.RADPLAPAG_CONFIG   (streamUrl, siteTitle, themeColor, visualizer,
                                  backgroundImage, logoImage, introAudioUrl, timezoneOffset, timezone,
                                  hideTitle)
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
| i18next       | Internationalization (with react-i18next) |
| date-fns      | Date/time formatting           |
| Web Audio API | Audio analysis for visualizers |

Node 26 is used for development (`.nvmrc` in the root, `player/` and each block; `engines.node >=22.22.2`). The root, `player/` and each block are independent npm projects, each with its own `package.json`, lockfile and build.

Development and test tooling: PHPCS (WPCS + PHPCompatibilityWP), PHPStan, PHPUnit, ESLint, Prettier, Vitest, Playwright (Chromium + WebKit) and `@wordpress/env` (Docker).

### Project Structure

```
radio-player-page/
├── radio-player-page.php          # Main plugin file, clean player page (template_redirect), block registration
├── uninstall.php                  # Removes plugin data on uninstall (multisite-aware)
├── includes/
│   ├── radplapag-station-cpt.php  # radplapag_station CPT registration
│   ├── radplapag-program-cpt.php  # radplapag_program CPT registration
│   ├── radplapag-stations.php     # Read path: radplapag_get_stations(), radplapag_get_config()
│   ├── radplapag-upgrade.php      # DB version gate, triggers migration
│   ├── radplapag-schedule-block.php
│   ├── radplapag-programs-list-block.php
│   ├── radplapag-now-playing-block.php
│   ├── data/                      # Radplapag_Station_Config, Radplapag_Program_Config
│   ├── migration/                 # Legacy settings-option → CPT one-way migrator
│   └── src/                       # Autoloaded classes: data, schedule, station, program, player globals, migration, upgrade, wp
├── admin/                         # Loaded when is_admin()
│   ├── admin.php                  # Bootstrap, hooks, menu
│   ├── admin-strings.php          # JS localization (radplapag_get_admin_strings)
│   ├── css/, js/                  # Admin styles and form logic
├── blocks/                        # Each block is an independent npm project
│   ├── schedule/                  # Radio Schedule block (block.json, render.php, src/ → build/)
│   ├── programs-list/             # Radio Shows List block (block.json, render.php, src/ → build/)
│   └── now-playing/               # Now Playing block (block.json, render.php, src/ → build/)
├── player/                        # React frontend (independent npm project)
│   ├── src/
│   │   ├── core/                  # Framework-free core: audio, config, schedule, clock, sleep, media session, i18n
│   │   └── components/, hooks/, config/, locales/, types/, utils/
│   ├── dist/                      # Build output (generated, committed)
│   ├── vite.config.ts
│   └── package.json
├── scripts/                       # build-release-zip, fixtures and seeding, license and coverage checks, local CI mirrors
├── tests/                         # php/unit, php/integration, js, e2e, zip
└── readme.txt                     # WordPress.org readme format
```

### Development

From the plugin root (WordPress side and the whole suite):

```bash
npm install && composer install
npm run check          # PHPCS, PHPStan, PHPUnit unit, ESLint, Vitest, hook tests, player and block checks, zip list
npm run env:start      # Development site on http://localhost:8886 (wp-env, Docker; admin / password)
npm run env:start:min  # Test site on http://localhost:8890 with WP 6.6 + PHP 7.4 (env:start:latest: latest WP + PHP 8.4)
npm run test:php:integration
npm run test:e2e       # Playwright, Chromium + WebKit, on the test site
```

From the `player/` directory:

```bash
npm install
npm run build          # Production build to dist/
npm run dev            # Standalone dev server (http://localhost:5173), mock globals in index.html
npm run dev:build      # Watch mode; rebuilds to dist/ for testing in WordPress
npm run check          # Typecheck, ESLint, Prettier and Vitest with coverage
```

From each `blocks/<block>/` directory: `npm install`, `npm run build` (to `build/`) and `npm run check`.

**Standalone:** `npm run dev` uses mock `window.*` globals from `player/index.html` and hot reload.
**WordPress:** Use `npm run dev:build` and load the player via the assigned page; manifest and assets are read from `dist/`.

`player/dist/` and each block's `build/` directory are generated but committed — CI fails if they're stale, so rebuild and commit after touching `player/src` or `blocks/*/src`.

CI runs on GitHub Actions via [.github/workflows/ci.yml](.github/workflows/ci.yml) on every pull request and on pushes to `main`: PHP syntax (7.4 and 8.4), PHPCS, PHPStan, PHPUnit (unit, and integration on WP 6.6 + PHP 7.4 and latest WP + PHP 8.4), root lint and Vitest, the player and block checks with a stale-build check, licenses and `npm audit`, E2E on both environments, the release zip file list and Plugin Check on the release zip. `./scripts/build-release-zip.sh` builds the release zip locally.

### API Reference

**WordPress**

- **Action** `template_redirect`: Intercepts requests for player pages.
- **Filters:** None exposed.

**JavaScript globals** (set by PHP before React; read in React via `useConfig()`):

- **`window.RADPLAPAG_CONFIG`** – `streamUrl`, `siteTitle`, `backgroundImage`, `logoImage`, `introAudioUrl` (optional welcome audio, played once before the live stream on first play), `themeColor`, `visualizer`, `timezoneOffset` (WordPress timezone, hours from UTC at request time; fallback), `timezone` (the site's IANA zone, or `null` with a manual UTC offset; the player follows its daylight saving time while the page is open), `hideTitle` (`true` hides the station name from view; it stays as the page heading for screen readers).
- **`window.RADPLAPAG_PROGRAMS`** – Array of `{ id, name, description?, extendedDescription?, logoUrl? }`. Optional.
- **`window.RADPLAPAG_SCHEDULE`** – Weekly schedule: `{ monday?: [{ program_id, start, end, is_rerun? }], ... }`. `program_id` is the radio show's post ID (as a string), matched against `id` in `RADPLAPAG_PROGRAMS`; times are `"HH:MM"` (24-hour); `is_rerun` marks the slot as a rerun. Optional.

**PHP (public)**

- `radplapag_get_config()` – Returns config array with key `stations` (ordered list from CPT).
- `radplapag_get_stations()` – Returns the ordered list of published station configs.
- `radplapag_get_station_for_current_page()` – Returns the station config for the current page, or `false`.
- `radplapag_get_now_playing_for_station( $station_index )` – Returns the current and upcoming radio show for a station by its index in `radplapag_get_stations()`, or `null` if the index is invalid. Powers the Now Playing block.

### Internationalization

Player UI locales: en-US, es, es-MX, ru-RU, nl-NL, ro-RO, sv-SE, gl-ES, da-DK, de-DE / de_DE, pt-BR / pt_BR, it-IT / it_IT, cs, hr. The language is the site language, read from the `<html lang>` of the clean page; the browser language and `localStorage` are not used. A regional variant without its own resources falls back to its base language (`de-AT` → `de-DE`, `pt-PT` → `pt-BR`, `es-AR` → `es`), and then to en-US. The player marks the language it renders in with `lang`, also on its dialogs, menus and tooltips. For German (de_DE), Portuguese Brazil (pt_BR), and Italian (it_IT), terminology follows the [WordPress German glossary](https://translate.wordpress.org/locale/de/default/glossary/), [WordPress Portuguese Brazil glossary](https://translate.wordpress.org/locale/pt-br/default/glossary/), and [WordPress Italian glossary](https://translate.wordpress.org/locale/it/default/glossary/) where applicable.

**Adding a new language:** (1) Add a JSON file in `player/src/locales/` with the same keys as `en-US.json`. (2) Import it and register the locale in `player/src/config/i18n.ts`; the base-language fallback is derived from the registered keys, so no other configuration is needed. (3) Update this README. Source strings are English (en-US). For locales with an official WordPress glossary (e.g. de_DE), use the [glossary and style guide](https://make.wordpress.org/polyglots/handbook/translating/glossaries-and-style-guides-per-locale/) when translating.

### Security and Browser Support

- Stream URLs validated with `esc_url_raw()`; visualizer and theme values whitelisted; station meta saved in CPT with `radplapag_sanitize_station_schedule()`; attachment IDs validated as integers; output escaped with WordPress escaping functions.
- Modern browsers with Web Audio API support; iOS Safari 10+ (native HLS); Chrome, Firefox, Edge (recent versions). Visualization requires Web Audio API.

### License

GPLv2 or later.
