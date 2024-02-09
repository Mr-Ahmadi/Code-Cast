const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Token = require("../models/Token");
const Record = require("../models/Record");

const sendEmail = require("../functions/sendEmail");

const authenticated = require("../middlewares/authenticated");

const router = express.Router();

const createToken = (id) => {
  return jwt.sign({ id }, "secret", {
    expiresIn: 3 * 24 * 60 * 60,
  });
};

router.get("/checkauth", authenticated, async (req, res) => {
  const records = [];
  for (const recordID of res.locals.user.records) {
    records.push([(await Record.findOne({ _id: recordID })).name, recordID]);
  }
  res.status(200).json({
    email: res.locals.user.email,
    verified: res.locals.user.verified,
    records,
  });
});

router.get("/newlink", authenticated, async (req, res) => {
  try {
    if (!res.locals.user.verified) {
      const newToken = crypto.randomBytes(32).toString("hex");
      const userId = res.locals.user._id;
      await Token.findOneAndUpdate(
        { userId },
        {
          $set: { token: newToken },
        }
      );
      const message = `${process.env.BASE_URL}/user/verify/${userId}/${newToken}`;
      await sendEmail(res.locals.user.email, "Verify Email", message);
      res.status(200).json({ message: "New link sent" });
    } else {
      res.status(400).json({ message: "Account already verified" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal error" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (password.match(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/)) {
      const salt = bcrypt.genSaltSync(10);
      hashedPassword = bcrypt.hashSync(password, salt);
      let user = await new User({ email, password: hashedPassword }).save();
      let token = await new Token({
        userId: user._id,
        token: crypto.randomBytes(32).toString("hex"),
      }).save();

      const message = `${process.env.BASE_URL}/user/verify/${user.id}/${token.token}`;
      await sendEmail(user.email, "Verify Email", message);

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

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.login({ email, password });
    const token = createToken(user._id);
    res.cookie("jwt", token, {
      httpOnly: false,
      withCredentials: true,
      maxAge: 3 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json({ message: "Sign in successful" });
  } catch (err) {
    if ((err.message = "Incurrect email/password")) {
      res.status(400).json({ message: "Incurrect email/password" });
    } else {
      res.status(500).json({ message: "Unknown server error" });
    }
  }
});

router.get("/verify/:id/:token", async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id });
    if (!user) return res.status(400).json({ message: "Invalid link" });

    const token = await Token.findOne({
      userId: user._id,
      token: req.params.token,
    });
    if (!token) return res.status(400).json({ message: "Invalid link" });

    await User.updateOne(
      { _id: user._id },
      {
        $set: { verified: true },
      }
    );
    await Token.findByIdAndDelete(token._id);

    res.json({ message: "email verified sucessfully" });
  } catch (err) {
    res.status(400).json({ message: err });
  }
});

module.exports = router;
