if (!require('buffer').SlowBuffer) {
  require('buffer').SlowBuffer = require('buffer').Buffer;
}
require("dotenv").config();
const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser");
const http = require("http");
const sequelize = require("./config/database");
const { setupTerminalWebSocket } = require("./terminal");

const userRouter = require("./routes/user");
const indexRouter = require("./routes/index");

const app = express();

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  })
);
app.use(cookieParser());

// Tracks whether the last database check succeeded, so /health can report it.
let dbReady = false;

// Unauthenticated probe so a client can validate a custom endpoint before
// anyone tries to sign in against it.
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "code-cast-server",
    version: require("./package.json").version,
    database: dbReady ? "up" : "down",
    time: new Date().toISOString(),
  });
});

app.use("/index", indexRouter);
app.use("/user", userRouter);

// A thrown error inside a route must not take the process down with it.
app.use((err, req, res, next) => {
  console.error("Unhandled route error:", err?.stack || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: "Unknown server error" });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const server = http.createServer(app);

setupTerminalWebSocket(server);

const startServer = async () => {
  // Listen regardless of the database. A client testing its endpoint needs a
  // real answer about what is wrong, and a refused connection cannot tell it
  // apart from a wrong address.
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    dbReady = true;
  } catch (err) {
    console.error(
      "Database unavailable — starting anyway; API routes will fail until it is reachable.\n" +
        err.message
    );
  }

  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Database: ${dbReady ? "connected" : "UNAVAILABLE"}`);
  });
};

startServer();
