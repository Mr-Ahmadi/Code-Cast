const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const User = require("../models/User");

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (password.match(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/)) {
      const salt = bcrypt.genSaltSync(10);
      hashedPassword = bcrypt.hashSync(password, salt);
      await new User({ email, password: hashedPassword }).save();
      res.status(201).json({ message: "Sign up successful" });
    } else {
      res.status(400).json({ message: "Invalid Password" });
    }
  } catch (err) {
    if (err.message.includes("User validation failed")) {
      res.status(400).json({ message: "User validation failed" });
    } else if (err.code === 11000) {
      res.status(409).json({ message: "Email already exists" });
    } else {
      res.status(500).json({ message: "Unknown server error" });
    }
  }
});

module.exports = router;