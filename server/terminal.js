const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const os = require("os");

const JWT_SECRET = process.env.JWT_SECRET || "secret";
const WORKSPACE_BASE = path.join(os.tmpdir(), "codecast-terminals");

// Resource limits for user processes
const CPU_LIMIT_SEC = parseInt(process.env.CVID_CPU_LIMIT || "30", 10);  // max 30s CPU
const MEM_LIMIT_MB = parseInt(process.env.CVID_MEM_LIMIT || "256", 10);  // max 256MB
const PROC_LIMIT = parseInt(process.env.CVID_PROC_LIMIT || "50", 10);     // max 50 processes

function shellWithLimits(shell, userDir, extraEnv) {
  // On Unix, wrap the shell with ulimit to enforce resource limits
  const limitCmd = `ulimit -t ${CPU_LIMIT_SEC} -m ${MEM_LIMIT_MB * 1024} -u ${PROC_LIMIT} 2>/dev/null; exec "${shell}"`;
  return {
    file: "/bin/sh",
    args: ["-c", limitCmd],
    cwd: userDir,
    env: { ...process.env, TERM: "xterm-256color", USER_WORKSPACE: userDir, ...extraEnv },
  };
}

function handleMessage(raw, ptyProcess, childProc) {
  const str = raw.toString();
  // Check for JSON control messages
  if (str.startsWith("{")) {
    try {
      const msg = JSON.parse(str);
      if (msg.type === "resize" && ptyProcess && typeof ptyProcess.resize === "function") {
        const cols = Math.max(msg.cols || 80, 1);
        const rows = Math.max(msg.rows || 24, 1);
        ptyProcess.resize(cols, rows);
      }
    } catch {}
    return;
  }
  if (ptyProcess) {
    ptyProcess.write(str);
  } else if (childProc && childProc.stdin) {
    childProc.stdin.write(str);
  }
}

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

    // --- Create per-user workspace directory (sandboxed) ---
    const userDir = path.join(WORKSPACE_BASE, userId);
    fs.mkdirSync(userDir, { recursive: true });

    const shell = process.platform === "win32"
      ? "cmd.exe"
      : (process.env.SHELL || "/bin/bash");

    ws.send(`\x1b[32m[Connected — user: ${userId.slice(0, 8)}...]\x1b[0m\r\n`);

    if (usePty && process.platform !== "win32") {
      try {
        const opts = shellWithLimits(shell, userDir, {});
        const term = pty.spawn(opts.file, opts.args, {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd: opts.cwd,
          env: opts.env,
        });

        term.onData((data) => {
          if (ws.readyState === ws.OPEN) ws.send(data);
        });

        term.onExit(() => {
          if (ws.readyState === ws.OPEN) ws.close();
        });

        ws.on("message", (raw) => handleMessage(raw, term, null));
        ws.on("close", () => { try { term.kill(); } catch {} });
        ws.on("error", () => { try { term.kill(); } catch {} });

        return;
      } catch (e) {
        ws.send(`\x1b[33m[PTY unavailable, using basic shell]\x1b[0m\r\n`);
      }
    }

    // Fallback spawn with resource limits
    const opts = shellWithLimits(shell, userDir, {});
    const proc = spawn(opts.file, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    try { os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}

    proc.stdout.on("data", (d) => { if (ws.readyState === ws.OPEN) ws.send(d.toString()); });
    proc.stderr.on("data", (d) => { if (ws.readyState === ws.OPEN) ws.send(d.toString()); });
    proc.on("exit", () => { if (ws.readyState === ws.OPEN) ws.close(); });

    ws.on("message", (raw) => handleMessage(raw, null, proc));
    ws.on("close", () => { try { proc.kill(); } catch {} });
    ws.on("error", () => { try { proc.kill(); } catch {} });
  });

  return wss;
}

module.exports = { setupTerminalWebSocket };
