# Code Cast

![Code Cast screenshot](Screenshot.png)

Record and replay code typing sessions with synchronized audio. Capture keystrokes in a Monaco editor along with voice narration, then play back the entire session as a seamless video-like experience. Runs as a web app (online) or a desktop app via Electron (local).

## Features

- **Keystroke recording** — captures every character insertion/deletion with precise timing
- **Multi-file recording** — tracks file creation, switching, and editing across an entire project
- **Audio narration** — optional microphone recording synced with typing
- **Full playback** — replay with seekable progress bar, speed control (0.5x–4x), skip buttons
- **Code execution** — run JavaScript, TypeScript, and Python code inline
- **Integrated terminal** — full xterm.js terminal (local shell via Electron PTY, or WebSocket with sandboxed resources online)
- **File explorer & tabs** — tree view sidebar and tabbed multi-file editing
- **Project management** — create, open, rename, delete projects; open arbitrary folders (local mode)
- **Project templates** — HTML/CSS/JS, React, Python, Node.js starters
- **Export/Import** — save recordings as `.cvid` files for sharing or backup
- **Two modes**:
  - **Online** — server-backed with PostgreSQL, JWT auth, cloud storage
  - **Local** — fully offline via Electron with filesystem persistence (or IndexedDB in browser)
- **Keyboard shortcuts** — `Ctrl+Enter` (run), `Ctrl+R` (record), `Ctrl+P` (play), `Ctrl+O` (open), `` Ctrl+` `` (terminal), `?` (help)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (only required for online mode)

### Server (online mode)

```bash
cd server
cp .env.example .env   # configure DB credentials
npm install
npm start               # runs on http://localhost:4000
```

### Client (web)

```bash
cd client
npm install
npm run dev             # runs on http://localhost:5173
```

### Client + Electron (desktop app)

```bash
cd client
npm install
npm run electron:dev    # starts Vite + Electron concurrently
```

To build a distributable:

```bash
npm run electron:build  # produces DMG (macOS), NSIS (Windows), AppImage (Linux)
```

## Usage

1. Open the app at http://localhost:5173 (or launch the Electron app)
2. Sign up / sign in, or click **Continue Offline** to use local mode
3. Open or create a project using the folder icon in the sidebar
4. Write code in the editor — files appear in the explorer and tabs
5. Click **Record** (or `Ctrl+R`) to start capturing keystrokes and audio
6. Click **Stop** when done — the recording is saved
7. Click **Open** (or `Ctrl+O`) to browse recordings, then select one and press **Play** (or `Ctrl+P`)
8. Use **Export** to download a `.cvid` file, **Import** to load one
9. Toggle the terminal with `` Ctrl+` `` to run shell commands

## File Format (`.cvid`)

```json
{
  "version": 3,
  "name": "My Recording",
  "files": {
    "index.js": {
      "language": "javascript",
      "firstValue": "console.log('hello');",
      "changes": [[{ "millis": 0, "type": 1, "index": 0, "value": "..." }]],
      "breakPoints": ["..."]
    }
  },
  "fileTimeline": [{ "millis": 0, "name": "index.js" }],
  "pauseResumePoints": [],
  "audio": "data:audio/webm;codecs=opus;base64,...",
  "duration": 12345
}
```

## Keyboard Shortcuts

| Shortcut       | Action               |
|----------------|----------------------|
| `Ctrl+Enter`   | Execute code         |
| `Ctrl+R`       | Start / Stop record  |
| `Ctrl+P`       | Play / Stop playback |
| `Ctrl+O`       | Open projects / recordings |
| `` Ctrl+` ``   | Toggle terminal      |
| `←` / `→`      | Skip back / forward 5s |
| `?`            | Toggle shortcuts help |

## Tech Stack

- **Client:** React, Monaco Editor, xterm.js, Dexie.js, Vite
- **Desktop:** Electron, electron-builder
- **Server:** Express, Sequelize, PostgreSQL, ws (WebSockets), node-pty
- **Auth:** JWT (cookie-based)
