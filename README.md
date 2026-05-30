# Code Video

Record and replay code typing sessions with synchronized audio. Capture your keystrokes in a Monaco editor along with voice narration, then play back the entire session as a seamless video-like experience.

## Features

- **Typing recording** — captures every keystroke with precise timing
- **Audio recording** — optional voice narration synced with typing
- **Full playback** — replay with progress bar, speed control, skip, and seek
- **Code execution** — run Python, JavaScript, and TypeScript code inline
- **Export/Import** — save recordings as `.cvid` files for sharing or backup

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (or a remote database)

### Server

```bash
cd server
cp .env.example .env    # configure DB credentials
npm install
npm start               # runs on http://localhost:4000
```

### Client

```bash
cd client
npm install
npm run dev             # runs on http://localhost:5173
```

## Usage

1. Open the app and sign up / sign in
2. Write code in the editor
3. Click **Record** (or `Ctrl+R`) to start capturing keystrokes and audio
4. Click **Stop** when done — the recording is saved to the server
5. Click **Open** (or `Ctrl+O`) to browse recordings, then select one and press **Play** (or `Ctrl+P`)
6. Use **Export** to download a `.cvid` file, **Import** to load one

## File Format (`.cvid`)

```json
{
  "version": 1,
  "name": "My Recording",
  "firstValue": "initial code",
  "changes": [[{"millis": 0, "type": 1, "index": 0, "value": "..."}]],
  "breakPoints": ["..."],
  "audio": "data:audio/webm;codecs=opus;base64,...",
  "duration": 12345
}
```

## Tech Stack

- **Client:** React, Monaco Editor, Vite
- **Server:** Express, Sequelize, PostgreSQL
- **Auth:** JWT (httpOnly cookie)
