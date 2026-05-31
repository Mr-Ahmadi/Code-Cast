const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Record = require("../models/Record");
const Workspace = require("../models/Project");

const authenticated = require("../middlewares/authenticated");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "secret";

const createToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: 3 * 24 * 60 * 60,
  });
};

router.get("/checkauth", authenticated, async (req, res) => {
  const workspaces = await Workspace.findAll({
    where: { userId: res.locals.user.id },
    attributes: ["id", "name", "files"],
    order: [["name", "ASC"]],
  });
  const records = await Record.findAll({
    where: { userId: res.locals.user.id },
    attributes: ["id", "name", "workspaceId"],
    order: [["name", "ASC"]],
  });
  const recordsByWs = {};
  for (const r of records) {
    const wsId = r.workspaceId || "none";
    if (!recordsByWs[wsId]) recordsByWs[wsId] = [];
    recordsByWs[wsId].push([r.name, r.id]);
  }
  const workspacesList = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    files: w.files,
    records: recordsByWs[w.id] || [],
  }));
  if (recordsByWs["none"]) {
    workspacesList.push({ id: null, name: "Unorganized", files: {}, records: recordsByWs["none"] });
  }
  res.status(200).json({
    email: res.locals.user.email,
    workspaces: workspacesList,
  });
});

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (password.match(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/)) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(password, salt);
      await User.create({ email, password: hashedPassword, verified: true });
      res.status(201).json({ message: "Sign up successful" });
    } else {
      res.status(400).json({ message: "Invalid Password" });
    }
  } catch (err) {
    if (err.name === "SequelizeValidationError") {
      res.status(400).json({ message: "User validation failed" });
    } else if (err.name === "SequelizeUniqueConstraintError") {
      res.status(409).json({ message: "Email already exists" });
    } else {
      res.status(500).json({ message: "Unknown server error" });
    }
  }
});

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.login({ email, password });
    const token = createToken(user.id);
    res.cookie("jwt", token, {
      httpOnly: false,
      withCredentials: true,
      maxAge: 3 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json({ message: "Sign in successful" });
  } catch (err) {
    if (err.message === "Incurrect email/password") {
      res.status(400).json({ message: "Incurrect email/password" });
    } else {
      res.status(500).json({ message: "Unknown server error" });
    }
  }
});

module.exports = router;
