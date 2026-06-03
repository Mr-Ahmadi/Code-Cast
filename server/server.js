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

app.use("/index", indexRouter);
app.use("/user", userRouter);

const server = http.createServer(app);

setupTerminalWebSocket(server);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    server.listen(4000, () =>
      console.log("Server running on http://localhost:4000")
    );
  } catch (err) {
    console.log("Failed to connect database =>\n" + err);
  }
};

startServer();
