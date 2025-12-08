# Radio Player Page

[![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)](https://wordpress.org/plugins/radio-player-page/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

**Create a dedicated page for your Icecast, Shoutcast, or MP3 radio. Continuous playback without interruptions.**

[View on WordPress.org](https://wordpress.org/plugins/radio-player-page) • [Report Issues](https://github.com/sjimhdez/radio-player-page/issues)

---

## 🎯 Overview

Radio Player Page is a professional WordPress plugin that delivers a dedicated, distraction-free streaming solution for Icecast, Shoutcast, and MP3 stations. Engineered with modern web technologies, it provides uninterrupted playback, seamless performance, and an exceptional user experience on all devices.

The plugin uniquely decouples the streaming interface from the WordPress theme, serving a clean, standalone HTML page with an embedded React application. This architectural approach ensures theme independence, zero style conflicts, and optimal performance.

## ✨ Key Benefits

- **Uninterrupted Playback** – Audio continues streaming even when users navigate away from the player page
- **Complete Theme Isolation** – The player operates independently; no WordPress styles or scripts interfere with playback
- **Performance Optimized** – Lightweight, self-contained architecture that minimizes HTTP requests and rendering overhead
- **Professional, Distraction-Free Interface** – Clean, modern design focused exclusively on audio streaming
- **Multi-Language Support** – Built-in support for English, Spanish, and Russian with automatic locale detection
- **Multiple Station Management** – Configure up to 6 radio stations with custom titles and dedicated pages
- **Modern Streaming Protocols** – Full support for HLS (.m3u8) and DASH (.mpd) adaptive streaming, alongside traditional Icecast/Shoutcast

## 🚀 Features

### Core Functionality

- **Up to 6 Stations** – Configure multiple stream sources with custom titles and assign each to a dedicated WordPress page
- **Real-Time Visualization** – Interactive waveform visualizer powered by the Web Audio API for dynamic audio feedback
- **Responsive Design** – Optimized for desktop, tablet, and mobile devices with fluid layouts
- **Independent Player Container** – Decoupled frontend rendered in an isolated `<div id="root"></div>` container
- **Site Icon Integration** – Automatically displays your WordPress site icon as the player favicon
- **Custom Page Titles** – Each station can have a custom title, or default to your site name

### Architecture & Performance

- **Vite Manifest-Based Asset Loading** – Automatic fingerprinting and cache busting for all assets
- **Modular Build System** – Assets are bundled with predictable naming convention: `radio-player-page-{version}.{ext}`
- **Template Redirect Hook** – Intercepts page requests at the WordPress template level for maximum efficiency
- **Early Exit Pattern** – Player page exits before WordPress enqueues additional styles or scripts
- **Backward Compatible** – Automatic migration from v1.1 (single station) to v1.2.1 (multiple stations)

### Technology Stack

- **React 19** – Modern, component-based architecture with latest hooks patterns
- **TypeScript** – Type-safe development ensuring maintainability and developer experience
- **Vite 6.3.5** – Lightning-fast builds, optimized bundles, and native ES modules
- **Material-UI 7.1.1** – Professional, accessible interface components with built-in theming
- **Web Audio API** – Direct browser audio processing for dynamic waveform visualization
- **hls.js & dash.js** – Industry-standard libraries for adaptive bitrate streaming
- **i18next** – Robust internationalization with automatic browser language detection

### Developer-Friendly

- **Full i18n Support** – Three locales included; extensible for additional languages
- **Clean TypeScript Codebase** – Custom hooks for audio handling, visualization, and capability detection
- **Production-Ready** – Battle-tested configuration, automated builds, and linting with ESLint
- **Dual Development Workflows** – Standalone React development or integrated WordPress testing

## 📋 Requirements

- **WordPress** 5.0 or higher
- **Node.js** 20.x (for development and building)
- **PHP** 7.4 or higher

## 🔧 Installation

### Quick Setup

1. Download the plugin from the [WordPress Plugin Directory](https://wordpress.org/plugins/radio-player-page/)
2. Upload the `radio-player-page` folder to `/wp-content/plugins/`
3. Navigate to **Plugins** and activate **Radio Player Page**
4. Go to **Settings → Radio Player Page Settings** to configure your streams

### Configuration Steps

1. Add up to 6 radio stations with their respective stream URLs
2. Assign each station to a dedicated WordPress page
3. Optionally customize the station title for each stream (defaults to your site name if left blank)
4. Save and navigate to the player page to test playback

### Important Notes

- Each station requires both a valid stream URL and an assigned page
- Stream URLs must be accessible URLs (checked with `esc_url_raw()`)
- Incomplete entries (missing URL or page) are automatically filtered during save
- Settings are automatically migrated from older versions

## 💻 Development

### Architecture Overview

The plugin follows a clear separation of concerns:

```
WordPress Backend (PHP)          →  React Frontend (TypeScript)
├── radio-player-page.php         ├── React 19 Application
├── admin-page.php                ├── Material-UI Components
├── compatibility.php             ├── Custom React Hooks
└── Template Redirect Hook    →   └── Web Audio API Integration
```

**Key Architectural Features:**

- The main PHP file registers the template redirect hook that intercepts page requests
- The admin page provides a clean interface for managing stations (up to 6 entries)
- Compatibility layer automatically migrates settings from v1.1 to v1.2.0+
- React app receives `STREAM_URL` and `SITE_TITLE` via `window` globals injected by PHP
- Vite manifest ensures proper asset loading with fingerprinting

### Project Structure

```
player/                 # React frontend application
├── src/
│   ├── components/
│   │   ├── dashboard/           # Main player interface
│   │   │   ├── index.tsx                # Dashboard container
│   │   │   ├── PlayerControls.tsx       # Play/Pause/Loading logic
│   │   │   ├── StreamInfo.tsx           # Title and Status display
│   │   │   └── VolumeControl.tsx        # Volume slider
│   │   └── visualizers/
│   │       └── oscilloscope-visualizer.tsx   # Web Audio API visualizer
│   ├── hooks/
│   │   ├── use-audio-player.tsx      # Core audio playback logic
│   │   ├── use-audio-visualizer.tsx  # Visualization state management
│   │   └── use-can-visualize.tsx     # Browser capability detection
│   ├── config/
│   │   ├── i18n.ts              # i18next setup with 3 locales
│   │   └── theme.ts             # Material-UI theme customization
│   ├── locales/
│   │   ├── en-US.json           # English (fallback language)
│   │   ├── es.json              # Spanish
│   │   └── ru-RU.json           # Russian
│   ├── types/
│   │   ├── global.ts            # Window interface augmentation
│   │   ├── player.tsx           # Player state types
│   │   └── visualizers.tsx      # Visualizer types
│   ├── App.tsx                  # Root application component
│   ├── main.tsx                 # Application entry point
│   ├── App.css                  # Global styles
│   └── index.css                # Base styles
├── index.html                   # Standalone dev entry (uses mock window vars)
├── vite.config.ts               # Build configuration with fingerprinting
├── tsconfig.json                # TypeScript root configuration
├── tsconfig.app.json            # App-specific TypeScript config
├── tsconfig.node.json           # Node/build tool TypeScript config
├── eslint.config.js             # ESLint rules
└── package.json                 # Dependencies and scripts
```

### Development Workflows

#### 1. Standalone Development (Hot Module Replacement)

Perfect for iterating on React components without WordPress:

```bash
cd player
npm install
npm run dev
```

Access the app at `http://localhost:5173`. The `index.html` file provides mock `window.STREAM_URL` and `window.SITE_TITLE` for testing.

#### 2. WordPress Integration (Watch Mode)

Test changes directly in a local WordPress environment:

```bash
cd player
npm install
npm run dev:build
```

This watches for source changes and rebuilds assets into `dist/`, which you can then test inside a running WordPress instance.

### Available Scripts

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Start Vite dev server with HMR on port 5173              |
| `npm run dev:build` | Continuous build watch mode for WordPress testing        |
| `npm run build`     | Create production-optimized bundle with TypeScript check |
| `npm run lint`      | Run ESLint across the entire project                     |
| `npm run preview`   | Preview production build locally before deployment       |

### Build & Asset System

The Vite build system produces:

- **Fingerprinted Assets** – Filenames include version hash for cache busting
- **Manifest-Based Loading** – PHP reads `manifest.json` to find correct asset paths
- **Chunk Code Splitting** – Automatically optimizes bundle size with intelligent chunking
- **Entry Point Pattern** – Single entry `src/main.tsx` for clean compilation

**Naming Convention:** `radio-player-page-{version}.{ext}`

Example manifest.json entry:

```json
{
  "src/main.tsx": {
    "file": "radio-player-page-1.2.1.js",
    "css": ["radio-player-page-1.2.1.css"],
    "isEntry": true
  }
}
```

### Technology Versions

| Technology  | Version | Purpose                                    |
| ----------- | ------- | ------------------------------------------ |
| Node.js     | 20.x    | Runtime for builds and development tools   |
| TypeScript  | 5.8.3   | Type safety and modern JavaScript features |
| React       | 19.1.0  | UI framework and component patterns        |
| Vite        | 6.3.5   | Build tool and dev server                  |
| Material-UI | 7.1.1   | Component library and theming              |
| i18next     | 25.3.2  | Internationalization framework             |
| ESLint      | 9.25.0  | Code quality and consistency               |

### Custom Hooks Reference

- **`use-audio-player.tsx`** – Manages audio playback state (play/pause/stop), error handling, and stream monitoring
- **`use-audio-visualizer.tsx`** – Connects Web Audio API to visualization state, handles frequency data extraction
- **`use-can-visualize.tsx`** – Detects browser support for Web Audio API and handles graceful degradation

## 🌐 Internationalization

The plugin includes built-in i18n support with three languages:

- **English (en-US)** – Default fallback language
- **Spanish (es)** – Automatic detection for Spanish locales
- **Russian (ru-RU)** – Automatic detection for Russian locales

Language detection follows this order:

1. HTML `lang` attribute (set by WordPress)
2. Browser localStorage cache
3. Navigator language preference

To add additional languages, create a new locale file in `player/src/locales/` and register it in `player/src/config/i18n.ts`.

## 📚 Documentation

For detailed setup instructions, configuration options, and troubleshooting, visit the [official plugin page](https://wordpress.org/plugins/radio-player-page/).

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Commit your changes (`git commit -am 'Add improvement'`)
4. Push to the branch (`git push origin feature/improvement`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for all React code
- Follow ESLint rules: `npm run lint`
- Test both workflows (standalone and WordPress integration)
- Update translations if adding new UI text
- Ensure backward compatibility with older settings format

## 📝 License

Radio Player Page is licensed under the **GNU General Public License v2.0 or later**. See [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html) for details.

## 🐛 Support & Issues

- **Bug Reports** – [GitHub Issues](https://github.com/sjimhdez/radio-player-page/issues)
- **WordPress Forum** – [Plugin Support](https://wordpress.org/support/plugin/radio-player-page/)
- **Plugin Directory** – [wordpress.org/plugins/radio-player-page](https://wordpress.org/plugins/radio-player-page)

## 📢 Stay Updated

Follow the developer on [Bluesky](https://bsky.app) for announcements, updates, and community news about Radio Player Page and related projects.
