# Radio Player Page

[![Version](https://img.shields.io/badge/version-2.1.1-blue.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)](https://wordpress.org/plugins/radio-player-page/)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-blue)](https://www.php.net/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

> Create dedicated pages for up to 10 radio streams with real-time audio visualization, sleep timer, and full customization. Supports Icecast, Shoutcast, HLS, DASH, and MP3.

[View on WordPress.org](https://wordpress.org/plugins/radio-player-page) • [Report Issues](https://github.com/sjimhdez/radio-player-page/issues) • [Documentation](https://wordpress.org/plugins/radio-player-page/)

---

## 📖 Overview

Radio Player Page is a professional WordPress plugin that delivers a dedicated, distraction-free streaming solution for radio stations. Engineered with modern web technologies, it provides uninterrupted playback, seamless performance, and an exceptional user experience on all devices.

The plugin uniquely decouples the streaming interface from the WordPress theme, serving a clean, standalone HTML page with an embedded React application. This architectural approach ensures theme independence, zero style conflicts, and optimal performance.

## ✨ Features

### Core Functionality

- **Multiple Station Management** – Configure up to 10 independent radio stations, each with its own dedicated WordPress page
- **Real-Time Audio Visualization** – Four distinct visualizers powered by Web Audio API:
  - **Oscilloscope (Waves)** – Classic waveform visualization showing time-domain audio data
  - **Bars Spectrum** – Frequency-domain visualization with animated bars
  - **Amplitude Waterfall** – Time-based visualization displaying amplitude changes
  - **Spectral Particles** – Dynamic particle system responding to frequency data
- **Streaming Protocol Support** – Automatic detection and handling for Icecast, Shoutcast, MP3, HLS (`.m3u8`), and DASH (`.mpd`) formats
- **Customization Options** – Per-station configuration:
  - Custom titles, background images, and logos
  - 8 color themes (Neutral, Blue, Green, Red, Orange, Yellow, Purple, Pink)
  - Visualizer selection (4 options)
- **Sleep Timer** – Automatic playback stop after 30 minutes, 1 hour, or 2 hours
- **Volume Control** – Adjustable volume slider (not available on iOS devices due to system limitations)
- **Media Session API** – Native lock screen controls and artwork display
- **Responsive Design** – Optimized for desktop, tablet, and mobile devices
- **Internationalization** – Built-in support for English, Spanish, and Russian with automatic locale detection

### Architecture & Performance

- **Theme Independence** – Player pages run completely independently of your WordPress theme
- **Vite Manifest-Based Asset Loading** – Automatic fingerprinting and cache busting for all assets
- **Template Redirect Hook** – Intercepts page requests at the WordPress template level for maximum efficiency
- **Early Exit Pattern** – Player page exits before WordPress enqueues additional styles or scripts
- **Backward Compatible** – Automatic migration from v1.1 (single station) to v2.1.1 (multiple stations)
- **Modern Stack** – Built with React 19, TypeScript, Vite, and Material-UI

## 🚀 Quick Start

### Installation

1. **Download the plugin:**

   - From [WordPress Plugin Directory](https://wordpress.org/plugins/radio-player-page/)
   - Or clone this repository: `git clone https://github.com/sjimhdez/radio-player-page.git`

2. **Install in WordPress:**

   - Upload the `radio-player-page` folder to `/wp-content/plugins/`
   - Or install via WordPress admin: **Plugins → Add New → Upload Plugin**

3. **Activate the plugin:**
   - Navigate to **Plugins** in WordPress admin
   - Click **Activate** on Radio Player Page

### Configuration

1. Go to **Settings → Radio Player Page Settings**
2. For each stream:
   - Enter your streaming URL (Icecast, Shoutcast, HLS, DASH, or MP3)
   - Select the WordPress page where the player should appear
   - Optionally customize: title, theme color, visualizer type, background image, and logo
3. Click **Save Changes** and visit the assigned page

### Requirements

- **WordPress** 5.0+
- **PHP** 7.4+
- **Node.js** 20.x (development only)
- Valid streaming URL (Icecast, Shoutcast, HLS, DASH, or MP3)

## 💻 Development

### Technology Stack

| Technology      | Version | Purpose                                    |
| --------------- | ------- | ------------------------------------------ |
| **Node.js**     | 20.x    | Runtime for builds and development tools   |
| **TypeScript**  | 5.8.3   | Type safety and modern JavaScript features |
| **React**       | 19.2.1  | UI framework and component patterns        |
| **Vite**        | 6.3.5   | Build tool and dev server                  |
| **Material-UI** | 7.1.1   | Component library and theming              |
| **i18next**     | 25.3.2  | Internationalization framework             |
| **hls.js**      | 1.6.15  | HLS streaming support                      |
| **dashjs**      | 5.1.0   | DASH streaming support                     |
| **ESLint**      | 9.25.0  | Code quality and consistency               |

### Project Structure

```
radio-player-page/
├── admin-page.php              # WordPress admin interface
├── compatibility.php           # Backward compatibility layer
├── radio-player-page.php       # Main plugin file
├── readme.txt                  # WordPress.org readme
├── README.md                   # GitHub readme (this file)
└── player/                     # React frontend application
    ├── src/
    │   ├── components/
    │   │   ├── dashboard/      # Main player interface
    │   │   │   ├── index.tsx
    │   │   │   ├── PlayerControls.tsx
    │   │   │   ├── StreamInfo.tsx
    │   │   │   ├── VolumeControl.tsx
    │   │   │   ├── SleepMode.tsx
    │   │   │   └── SleepTimer.tsx
    │   │   └── visualizers/    # Audio visualizers
    │   │       ├── oscilloscope-visualizer.tsx
    │   │       ├── bar-visualizer.tsx
    │   │       ├── amplitude-waterfall-visualizer.tsx
    │   │       └── particles-visualizer.tsx
    │   ├── hooks/              # Custom React hooks
    │   │   ├── use-audio-player.tsx
    │   │   ├── use-audio-visualizer.tsx
    │   │   ├── use-can-visualize.tsx
    │   │   ├── use-is-ios.tsx
    │   │   └── use-media-session.tsx
    │   ├── config/             # Configuration files
    │   │   ├── i18n.ts
    │   │   ├── theme.ts
    │   │   └── visualizers.ts
    │   ├── locales/            # Translation files
    │   │   ├── en-US.json
    │   │   ├── es.json
    │   │   └── ru-RU.json
    │   ├── types/              # TypeScript type definitions
    │   │   ├── global.ts
    │   │   ├── player.tsx
    │   │   └── visualizers.tsx
    │   ├── App.tsx             # Root application component
    │   ├── main.tsx            # Application entry point
    │   └── index.css           # Global styles
    ├── dist/                   # Built assets (generated)
    ├── index.html              # Standalone dev entry
    ├── vite.config.ts          # Vite configuration
    ├── tsconfig.json           # TypeScript configuration
    ├── eslint.config.js        # ESLint configuration
    └── package.json            # Dependencies and scripts
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

#### 3. Production Build

Create optimized production bundles:

```bash
cd player
npm install
npm run build
```

### Available Scripts

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Start Vite dev server with HMR on port 5173              |
| `npm run dev:build` | Continuous build watch mode for WordPress testing        |
| `npm run build`     | Create production-optimized bundle with TypeScript check |
| `npm run lint`      | Run ESLint across the entire project                     |
| `npm run preview`   | Preview production build locally before deployment       |

### Custom Hooks Reference

- **`use-audio-player.tsx`** – Manages audio playback state (play/pause/stop), error handling, and stream monitoring. Supports HLS, DASH, Icecast, Shoutcast, and MP3 formats.
- **`use-audio-visualizer.tsx`** – Connects Web Audio API to visualization state, handles frequency and time-domain data extraction.
- **`use-can-visualize.tsx`** – Detects browser support for Web Audio API and handles graceful degradation.
- **`use-is-ios.tsx`** – Detects iOS devices for platform-specific behavior.
- **`use-media-session.tsx`** – Configures Media Session API for lock screen controls and artwork display.

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
    "file": "radio-player-page-2.1.1.js",
    "css": ["radio-player-page-2.1.1.css"],
    "isEntry": true
  }
}
```

## 🌐 Internationalization

Built-in support for English (en-US), Spanish (es), and Russian (ru-RU) with automatic locale detection. Language detection follows: HTML `lang` attribute → localStorage cache → Navigator preference.

To add languages, create a locale file in `player/src/locales/` and register it in `player/src/config/i18n.ts`.

## 📸 Screenshots

1. Mobile interface with responsive design
2. Desktop player with audio visualizer and controls
3. Admin settings for managing stations
4. Visualizer selection options
5. Theme color customization

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
- Follow WordPress coding standards for PHP code
- Write clear commit messages

## 📝 License

Radio Player Page is licensed under the **GNU General Public License v2.0 or later**.

See [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html) for details.

## 🐛 Support & Documentation

- **Bug Reports** – [GitHub Issues](https://github.com/sjimhdez/radio-player-page/issues)
- **WordPress Forum** – [Plugin Support](https://wordpress.org/support/plugin/radio-player-page/)
- **Documentation** – [Official Plugin Page](https://wordpress.org/plugins/radio-player-page/)

## 🙏 Acknowledgments

Built with [React](https://react.dev/), [Material-UI](https://mui.com/), [hls.js](https://github.com/video-dev/hls.js/), [dashjs](https://github.com/Dash-Industry-Forum/dash.js), [i18next](https://www.i18next.com/), and [Vite](https://vitejs.dev/).
