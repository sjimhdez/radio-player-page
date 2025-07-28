=== Radio Player Page ===
Contributors: sjimhdez  
Tags: audio, streaming, radio, player, icecast, shoutcast  
Requires at least: 5.0  
Tested up to: 6.8
Requires PHP: 7.4  
Stable tag: 1.0.2  
License: GPLv2 or later  
License URI: https://www.gnu.org/licenses/gpl-2.0.html  
Text Domain: radio-player-page  

A simple audio player for WordPress, rendering a fully standalone app in a clean, dedicated page.

== Description ==

This plugin allows you to configure a specific WordPress page to display a clean, standalone audio player powered by a reactive app.

It is intended for minimal radio playback use cases, where a full WordPress layout is unnecessary or undesirable.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Go to **Settings > Radio Player Page Settings**
4. Set your stream URL and choose the page where the player will render

== Technical Notes ==

This plugin outputs a fully custom HTML document and intentionally exits the WordPress execution flow early via `exit` in the `template_redirect` hook. This is done to provide a minimal and fully decoupled player environment, free from the WordPress theme or layout.

As a result:
- WordPress actions and filters that normally load scripts and styles (including `wp_enqueue_script()` and `wp_enqueue_style()`) are never reached.
- Any enqueued assets would be ignored, and using the enqueue system would be misleading and redundant.
- The plugin directly includes only the specific compiled files needed (based on the Vite manifest) inside the generated HTML document.

This behavior is intentional and documented both in this file and in the source code (`radio-player-page.php`), as it’s critical to the design goal of serving a clean standalone player.

The code respects all other WordPress standards and security practices, but skips the enqueue mechanism by necessity.

== Source Code ==

The React source code for the embedded player is available here:  
https://github.com/sjimhdez/radio-player-page

== Changelog ==

= 1.0.1 =
* Improved compatibility and prefixed all functions.
* Clarified plugin structure and author identity.

= 1.0.2 =
* Remove index.html as Vite entry point (WordPress generates HTML)
* Use src/main.tsx as direct entry for cleaner build process
* Add dev:build script for continuous WordPress integration
* Update Vite config and PHP manifest path
* Add development mode documentation for standalone and integrated workflows