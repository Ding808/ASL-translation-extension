# Screen Recorder Browser Extension

A TypeScript browser extension that records the screen and sends the recording data to a server.

## Features

- Screen recording with chrome.desktopCapture API
- Send recorded video to a configurable server
- Visual recording indicator
- TypeScript implementation with webpack bundling

## Development Setup

1. Install dependencies:
   ```
   pnpm install
   ```

2. Generate extension icons:
   - Open `icon-generator.html` in a browser
   - Right-click on each canvas and select "Save image as..."
   - Save the icons to the `public/icons` directory as:
     - `icon16.png` (16x16)
     - `icon48.png` (48x48)
     - `icon128.png` (128x128)

3. Build the extension:
   ```
   pnpm run build
   ```

4. For development with auto-rebuild:
   ```
   pnpm run dev
   ```

## Installing the Extension

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked" and select the `dist` directory from this project
4. The extension icon should appear in your browser's toolbar

## Using the Extension

1. Click the extension icon in your browser toolbar
2. Enter the server URL where recordings will be sent
3. Click "Start Recording" and select the screen or tab you want to record
4. Click "Stop Recording" when finished
5. The recording will be sent to the specified server URL

## Server Requirements

The server should accept POST requests with form data containing a video file named "video".

## Project Structure

- `src/`: TypeScript source files
  - `background.ts`: Background service worker script
  - `content.ts`: Content script injected into pages
  - `popup.ts`: Popup UI script
- `public/`: Static files
  - `manifest.json`: Extension manifest
  - `popup.html`: Popup UI
  - `icons/`: Extension icons
- `dist/`: Build output (created by webpack)

## License

ISC