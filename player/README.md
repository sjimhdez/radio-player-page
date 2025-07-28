# Radio Player Page – React Frontend

**Frontend repository for the Radio Player Page plugin**

---

## Description

This directory contains the frontend application built with **React** and **TypeScript**, responsible for rendering the radio player and waveform visualizer on a dedicated WordPress page. It is fully decoupled from WordPress themes and scripts, ensuring a modern, fast, and distraction-free experience.

The app is built and bundled using **Vite**, enabling fast development and build times, as well as seamless integration with the plugin backend.

---

## Main Features

- **Minimal UI:** Clean, responsive interface focused on the listening experience.
- **Real-time Visualizer:** Waveform animation powered by the Web Audio API.
- **WordPress Decoupling:** Injected into a blank HTML shell (`<div id="root">`), with zero dependency on the active theme.
- **Modern Stack:** React 19, TypeScript, Vite, MUI.
- **Easy Maintenance:** Modular, type-safe codebase.

---

## Project Structure

- `src/` – Main React app source code
- `dist/` – Build output (do not edit manually)
- `public/` – Static assets
- `package.json` – Dependencies and scripts

---

## Available Scripts

In the `player/` directory you can run:

- `npm install` – Install dependencies
- `npm run dev` – Start the development server with hot reload
- `npm run build` – Build the production assets into `dist/`
- `npm run preview` – Preview the production build locally
- `npm run lint` – Run ESLint on the source code

---

## Main Dependencies

- **React** 19
- **TypeScript** 5
- **Vite** 6
- **Material UI** (MUI)
- **Emotion** (for styling)

---

## Development Modes

You can develop the frontend using two approaches:

- **Standalone mode (`npm run dev`):**

  Runs the React app in development mode using the `window` variables defined in `index.html`. This is ideal for working on the frontend in isolation, without needing a local WordPress instance.

  ```bash
  npm run dev
  ```

- **Integrated mode with WordPress (`npm run dev:build`):**

  Continuously builds the frontend into the `dist/` folder, so changes are immediately available in your local WordPress environment. Use this mode to test the plugin as it will run in production.

  ```bash
  npm run dev:build
  ```

Both modes support hot reload and efficient development. Choose the workflow that best fits your needs.

---

## Technical Notes

- The build generates JS and CSS files that are injected by the plugin backend into the dedicated page.
- No reliance on WordPress hooks or styles.
- The visualizer uses the Web Audio API to obtain real-time stream data.

---

## License

GPLv2 or later. See the LICENSE file for details.

---

## Credits

Developed by [sjimhdez](https://github.com/sjimhdez) for the Radio Player Page plugin.
