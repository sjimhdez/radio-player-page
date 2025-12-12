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

### Key Highlights

- 🎵 **Up to 10 Stations** – Manage multiple radio streams independently
- 🎨 **4 Audio Visualizers** – Choose from Oscilloscope, Bars Spectrum, Amplitude Waterfall, or Spectral Particles
- 🎨 **8 Color Themes** – Customize appearance with Neutral, Blue, Green, Red, Orange, Yellow, Purple, or Pink
- 🖼️ **Custom Branding** – Upload background images and logos for each station
- ⏰ **Sleep Timer** – Automatic playback stop after 30 min, 1 hour, or 2 hours
- 📱 **Media Session API** – Native lock screen controls and artwork display
- 🌍 **Multi-Language** – Built-in support for English, Spanish, and Russian
- 🚀 **Modern Stack** – React 19, TypeScript, Vite, Material-UI

## ✨ Features

### Core Functionality

- **Multiple Station Management** – Configure up to 10 independent radio stations, each with its own dedicated WordPress page
- **Real-Time Audio Visualization** – Four distinct visualizers powered by Web Audio API:
  - **Oscilloscope (Waves)** – Classic waveform visualization showing time-domain audio data
  - **Bars Spectrum** – Frequency-domain visualization with animated bars
  - **Amplitude Waterfall** – Time-based visualization displaying amplitude changes
  - **Spectral Particles** – Dynamic particle system responding to frequency data
- **Streaming Protocol Support** – Automatic detection and handling for:
  - Icecast and Shoutcast streams
  - MP3 direct streams
  - HLS (HTTP Live Streaming) with `.m3u8` extension
  - DASH (Dynamic Adaptive Streaming over HTTP) with `.mpd` extension
- **Custom Branding** – Upload custom background images and logos for each station
- **Custom Station Titles** – Set a unique title for each stream, or use your site name as default
- **Sleep Timer** – Set automatic playback stop after 30 minutes, 1 hour, or 2 hours
- **Volume Control** – Adjustable volume slider (not available on iOS devices due to system limitations)
- **Media Session API** – Displays station information and artwork on device lock screens and media controls
- **Responsive Design** – Optimized for desktop, tablet, and mobile devices
- **Internationalization** – Built-in support for English, Spanish, and Russian with automatic locale detection

### Architecture & Performance

- **Theme Independence** – Player pages run completely independently of your WordPress theme
- **Vite Manifest-Based Asset Loading** – Automatic fingerprinting and cache busting for all assets
- **Template Redirect Hook** – Intercepts page requests at the WordPress template level for maximum efficiency
- **Early Exit Pattern** – Player page exits before WordPress enqueues additional styles or scripts
- **Backward Compatible** – Automatic migration from v1.1 (single station) to v2.1.1 (multiple stations)

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
2. For each stream you want to configure:
   - Enter your streaming URL (Icecast, Shoutcast, HLS, DASH, or MP3)
   - Select the WordPress page where the player should appear
   - Optionally add a custom stream title
   - Choose a theme color (8 options available)
   - Select a visualizer type (4 options available)
   - Optionally upload a background image and logo
3. Click **Save Changes**
4. Visit the assigned page to see the player in action

### Requirements

- **WordPress** 5.0 or higher
- **PHP** 7.4 or higher
- **Node.js** 20.x (for development and building only)
- A valid streaming URL (Icecast, Shoutcast, HLS, DASH, or MP3)

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

The plugin includes built-in i18n support with three languages:

- **English (en-US)** – Default fallback language
- **Spanish (es)** – Automatic detection for Spanish locales
- **Russian (ru-RU)** – Automatic detection for Russian locales

Language detection follows this order:

1. HTML `lang` attribute (set by WordPress)
2. Browser localStorage cache
3. Navigator language preference

To add additional languages, create a new locale file in `player/src/locales/` and register it in `player/src/config/i18n.ts`.

## 📸 Screenshots

1. **Mobile Interface** – Radio Player Page displayed on a mobile device, showing the clean, minimal interface optimized for mobile listening with responsive design.

2. **Desktop Player** – Radio Player Page on a desktop device, featuring one of the four available audio visualizers and full player controls including play/pause, volume, and sleep timer.

3. **Admin Settings** – Plugin Settings screen, showing the interface for managing up to 10 radio stations with customization options for each stream.

4. **Visualizer Selection** – Visualizer selection in the admin interface, displaying the four available visualization options: Oscilloscope, Bars Spectrum, Amplitude Waterfall, and Spectral Particles.

5. **Theme Customization** – Theme color selection dropdown showing all eight available color schemes for customizing the player appearance.

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

## 🐛 Support & Issues

- **Bug Reports** – [GitHub Issues](https://github.com/sjimhdez/radio-player-page/issues)
- **WordPress Forum** – [Plugin Support](https://wordpress.org/support/plugin/radio-player-page/)
- **Plugin Directory** – [wordpress.org/plugins/radio-player-page](https://wordpress.org/plugins/radio-player-page)

## 📚 Documentation

For detailed setup instructions, configuration options, and troubleshooting, visit the [official plugin page](https://wordpress.org/plugins/radio-player-page/).

## 🙏 Acknowledgments

- Built with [React](https://react.dev/)
- UI components powered by [Material-UI](https://mui.com/)
- Streaming support via [hls.js](https://github.com/video-dev/hls.js/) and [dashjs](https://github.com/Dash-Industry-Forum/dash.js)
- Internationalization with [i18next](https://www.i18next.com/)
- Build tooling by [Vite](https://vitejs.dev/)

## 📢 Stay Updated

Follow the developer for announcements, updates, and community news about Radio Player Page and related projects.
