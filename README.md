# Radio Player Page

[![Version](https://img.shields.io/badge/version-2.0.2-blue.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress Plugin](https://img.shields.io/wordpress/plugin/v/radio-player-page.svg)](https://wordpress.org/plugins/radio-player-page/)
[![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-blue)](https://wordpress.org/plugins/radio-player-page/)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-blue)](https://www.php.net/)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

[View on WordPress.org](https://wordpress.org/plugins/radio-player-page) • [Report Issues](https://github.com/sjimhdez/radio-player-page/issues) • [Documentation](https://wordpress.org/plugins/radio-player-page/)

---

## Overview

Radio Player Page is a WordPress plugin that provides dedicated standalone pages for audio stream playback. The plugin serves independent HTML pages containing a React-based player application, completely decoupled from the active WordPress theme.

## Architecture

### Core Components

**PHP Backend** (`radio-player-page.php`, `admin-page.php`, `compatibility.php`)

- Plugin initialization and WordPress integration
- Settings management via WordPress Settings API
- Template redirect hook for standalone page rendering
- Backward compatibility layer for version migrations
- Manifest-based asset loading from Vite build output

**React Frontend** (`player/` directory)

- TypeScript-based React 19 application
- Material-UI component library
- Vite build system with code splitting
- Web Audio API integration for real-time visualization
- Media Session API for native device controls

### Data Flow

```
WordPress Page Request
  ↓
template_redirect hook
  ↓
radplapag_get_station_for_current_page()
  ↓
radplapag_output_clean_page()
  ↓
Reads manifest.json → Loads fingerprinted assets
  ↓
Outputs standalone HTML with window.* globals
  ↓
React app initializes from window.STREAM_URL, etc.
```

### Asset Loading System

The plugin uses Vite's manifest-based asset loading:

- Build produces `manifest.json` with fingerprinted filenames
- PHP reads manifest to determine correct asset paths
- Assets follow naming: `radio-player-page-{version}.{ext}`
- Automatic cache busting via content hashes

## Features

### Streaming Protocol Support

- **HLS (.m3u8)**: Uses hls.js library on non-iOS devices; native support on iOS Safari
- **DASH (.mpd)**: Uses dash.js MediaPlayer
- **Icecast/Shoutcast**: Native HTML5 audio element
- **MP3/OGG**: Standard audio streams via HTML5 audio

Protocol detection is URL-based (file extension). Libraries are lazy-loaded only when needed.

### Audio Visualization

Four visualizers powered by Web Audio API:

- **Oscilloscope**: Time-domain waveform visualization
- **Bars Spectrum**: Frequency-domain bar chart
- **Amplitude Waterfall**: Time-based amplitude visualization
- **Spectral Particles**: Frequency-driven particle system

Visualizers are code-split and lazy-loaded to reduce initial bundle size.

### Configuration

Per-station settings (up to 10 stations):

- Stream URL (required)
- WordPress page assignment (required)
- Station title (optional, defaults to site name)
- Theme color (8 options: neutral, blue, green, red, orange, yellow, purple, pink)
- Visualizer type (4 options)
- Background image (optional)
- Logo image (optional, falls back to site favicon)

### Platform-Specific Behavior

- **iOS**: Volume control disabled (uses system volume); native HLS support
- **Other platforms**: Full volume control; HLS via hls.js library

## Technology Stack

| Component     | Version | Purpose                          |
| ------------- | ------- | -------------------------------- |
| React         | 19.2.1  | UI framework                     |
| TypeScript    | 5.8.3   | Type safety                      |
| Vite          | 6.3.5   | Build tool and dev server        |
| Material-UI   | 7.1.1   | Component library                |
| hls.js        | 1.6.15  | HLS streaming support            |
| dashjs        | 5.1.0   | DASH streaming support           |
| i18next       | 25.3.2  | Internationalization             |
| Web Audio API | Native  | Audio analysis for visualization |

## Project Structure

```
radio-player-page/
├── radio-player-page.php      # Main plugin file, template redirect
├── admin-page.php              # Settings page UI and management
├── compatibility.php           # Version migration and backward compatibility
├── player/                     # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/      # Main player UI components
│   │   │   └── visualizers/   # Audio visualization components
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── use-audio-player.tsx      # Playback management
│   │   │   ├── use-audio-visualizer.tsx  # Web Audio API integration
│   │   │   ├── use-can-visualize.tsx     # Browser capability detection
│   │   │   ├── use-is-ios.tsx            # iOS detection
│   │   │   └── use-media-session.tsx     # Media Session API
│   │   ├── config/
│   │   │   ├── i18n.ts        # Internationalization setup
│   │   │   ├── theme.ts       # Material-UI theme configuration
│   │   │   └── visualizers.ts # Visualizer registry and lazy loading
│   │   ├── locales/           # Translation files (en-US, es, ru-RU)
│   │   ├── types/             # TypeScript type definitions
│   │   ├── App.tsx            # Root component
│   │   └── main.tsx           # Application entry point
│   ├── dist/                  # Build output (generated)
│   ├── vite.config.ts         # Vite configuration
│   └── package.json           # Dependencies and scripts
└── readme.txt                 # WordPress.org readme format
```

## Installation

### Requirements

- WordPress 5.0+
- PHP 7.4+
- Node.js 20.x (development only)
- Valid streaming URL

### Setup

1. Install plugin to `/wp-content/plugins/radio-player-page/`
2. Activate via WordPress admin
3. Navigate to **Settings → Radio Player Page Settings**
4. Configure stations:
   - Enter stream URL
   - Select WordPress page
   - Optionally customize appearance
5. Save and visit assigned page

## Development

### Prerequisites

- Node.js 20.x
- npm or compatible package manager

### Build Commands

```bash
cd player
npm install
npm run build          # Production build
npm run dev            # Development server (standalone)
npm run dev:build      # Watch mode for WordPress testing
npm run lint           # ESLint code quality check
```

### Development Workflows

**Standalone Development**

- Run `npm run dev` in `player/` directory
- Access at `http://localhost:5173`
- Uses mock `window.*` globals from `index.html`
- Hot Module Replacement enabled

**WordPress Integration**

- Run `npm run dev:build` for watch mode
- Rebuilds to `dist/` on file changes
- Test in local WordPress instance
- Manifest.json updated automatically

### Code Organization

**Hooks**

- `use-audio-player.tsx`: Manages audio element, protocol detection, library loading
- `use-audio-visualizer.tsx`: Web Audio API connection, data extraction
- `use-can-visualize.tsx`: Browser capability detection
- `use-is-ios.tsx`: Platform detection
- `use-media-session.tsx`: Media Session API configuration

**Visualizers**

- Lazy-loaded via dynamic imports
- Cached after first load
- Metadata available synchronously for initial render
- Code-split to reduce bundle size

**Theming**

- Material-UI theme system
- 8 predefined color palettes
- Dark mode only
- Per-station theme selection

## Internationalization

Supported locales:

- English (en-US)
- Spanish (es)
- Russian (ru-RU)
- Dutch (nl-NL)
- Romanian (ro-RO)
- Spanish - Mexico (es-MX)
- Swedish (sv-SE)

Detection order:

1. HTML `lang` attribute
2. localStorage cache
3. Navigator language preference

To add languages: create locale file in `player/src/locales/` and register in `player/src/config/i18n.ts`.

## Backward Compatibility

The plugin includes migration logic for older versions:

- v1.1.2 (single station) → v1.2.0+ (multiple stations)
- Automatic format conversion on plugin load
- Database version tracking via `radplapag_db_version` option

## API Reference

### WordPress Hooks

**Actions**

- `template_redirect`: Intercepts page requests for player pages

**Filters**

- None currently exposed

### JavaScript Globals

Set by PHP before React initialization:

- `window.STREAM_URL`: Audio stream URL
- `window.SITE_TITLE`: Station title or site name
- `window.BACKGROUND_IMAGE`: Background image URL (optional)
- `window.LOGO_IMAGE`: Logo image URL (optional)
- `window.THEME_COLOR`: Theme color identifier
- `window.VISUALIZER`: Visualizer type identifier

### PHP Functions

**Public API**

- `radplapag_get_settings()`: Retrieves plugin settings array
- `radplapag_get_station_for_current_page()`: Gets station config for current page

**Internal**

- `radplapag_output_clean_page()`: Renders standalone HTML page
- `radplapag_sanitize_settings()`: Validates and sanitizes settings input

## Security Considerations

- Stream URLs validated via `esc_url_raw()`
- Visualizer values whitelist-validated
- Settings sanitized via WordPress Settings API
- Media attachment IDs validated as integers
- All output escaped via WordPress escaping functions

## Browser Support

- Modern browsers with Web Audio API support
- iOS Safari 10+ (native HLS)
- Chrome, Firefox, Edge (latest versions)
- Web Audio API required for visualization features

## License

GPLv2 or later

## Contributing

1. Fork repository
2. Create feature branch
3. Follow TypeScript and ESLint rules
4. Test in both standalone and WordPress contexts
5. Submit pull request

### Coding Standards

- TypeScript for all React code
- WordPress PHP coding standards for PHP files
- ESLint configuration in `eslint.config.js`
- Prettier for code formatting (see `.prettierrc`)
