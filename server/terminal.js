const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const os = require("os");

const JWT_SECRET = process.env.JWT_SECRET || "secret";
const WORKSPACE_BASE = path.join(os.tmpdir(), "codevideo-terminals");

function setupTerminalWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/terminal" });

  let usePty = true;
  let pty;
  try {
    pty = require("node-pty");
  } catch {
    usePty = false;
  }

  wss.on("connection", (ws, req) => {
    // --- Authenticate via JWT token in query string ---
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.send("\x1b[31m[Authentication required: no token provided]\x1b[0m\r\n");
      ws.close();
      return;
    }

    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch {
      ws.send("\x1b[31m[Authentication failed: invalid or expired token]\x1b[0m\r\n");
      ws.close();
      return;
    }

    // --- Create per-user workspace directory ---
    const userDir = path.join(WORKSPACE_BASE, userId);
    try {
      fs.mkdirSync(userDir, { recursive: true });
    } catch {
      // best effort
    }

    const shell = process.platform === "win32"
      ? "cmd.exe"
      : (process.env.SHELL || "/bin/bash");

    ws.send(`\x1b[32m[Connected — user: ${userId.slice(0, 8)}...]\x1b[0m\r\n`);

    if (usePty) {
      try {
        const term = pty.spawn(shell, [], {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd: userDir,
          env: { ...process.env, TERM: "xterm-256color", USER_WORKSPACE: userDir },
        });

        term.onData((data) => {
          if (ws.readyState === ws.OPEN) ws.send(data);
        });

        term.onExit(() => {
          if (ws.readyState === ws.OPEN) ws.close();
        });

        ws.on("message", (data) => term.write(data.toString()));
        ws.on("close", () => { try { term.kill(); } catch {} });
        ws.on("error", () => { try { term.kill(); } catch {} });

        return;
      } catch (e) {
        ws.send(`\x1b[33m[PTY unavailable, using basic shell]\x1b[0m\r\n`);
      }
    }

    // Fallback spawn
    const proc = spawn(shell, [], {
      cwd: userDir,
      env: { ...process.env, TERM: "xterm-256color", USER_WORKSPACE: userDir },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (d) => { if (ws.readyState === ws.OPEN) ws.send(d.toString()); });
    proc.stderr.on("data", (d) => { if (ws.readyState === ws.OPEN) ws.send(d.toString()); });
    proc.on("exit", () => { if (ws.readyState === ws.OPEN) ws.close(); });

    ws.on("message", (data) => proc.stdin.write(data.toString()));
    ws.on("close", () => { try { proc.kill(); } catch {} });
    ws.on("error", () => { try { proc.kill(); } catch {} });
  });

  return wss;
}

module.exports = { setupTerminalWebSocket };
