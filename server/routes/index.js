const express = require("express");
const Record = require("../models/Record");
const User = require("../models/User");
const authenticated = require("../middlewares/authenticated");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const router = express.Router();

router.get("/loaddata/:id", authenticated, async (req, res) => {
  try {
    const record = await Record.findOne({
      where: { id: req.params.id, userId: res.locals.user.id },
      attributes: ["changes", "breakPoints", "firstValue", "name", "voice"],
    });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    const { changes, breakPoints, firstValue, name, voice } = record;
    res.status(200).json({ changes, breakPoints, firstValue, name, voice, id: record.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/savedata", authenticated, async (req, res) => {
  const { id, name, changes, firstValue, breakPoint, voice } = req.body;

  try {
    if (id === null) {
      let record = await Record.create({
        changes: changes || [],
        userId: res.locals.user.id,
        name,
        breakPoints: breakPoint ? [breakPoint] : [],
        firstValue: firstValue || "",
        voice: voice || null,
      });

      return res.status(201).json({ id: record.id });
    }

    const record = await Record.findOne({
      where: { id, userId: res.locals.user.id },
    });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    if (breakPoint !== null && breakPoint !== undefined) {
      record.breakPoints = [...(record.breakPoints || []), breakPoint];
    }

    record.changes = [...(record.changes || []), ...changes];

    if (voice) {
      record.voice = voice;
    }

    await record.save();
    res.status(200).json({ message: "ok" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/audio/:id", authenticated, async (req, res) => {
  try {
    const { voice } = req.body;
    if (!voice) {
      return res.status(400).json({ message: "Voice data required" });
    }
    const record = await Record.findOne({
      where: { id: req.params.id, userId: res.locals.user.id },
    });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    record.voice = voice;
    await record.save();
    res.json({ message: "Audio saved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/rename/:id", authenticated, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const record = await Record.findOne({
      where: { id: req.params.id, userId: res.locals.user.id },
    });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    record.name = name.trim();
    await record.save();
    res.json({ message: "Renamed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/delete/:id", authenticated, async (req, res) => {
  try {
    const record = await Record.findOne({
      where: { id: req.params.id, userId: res.locals.user.id },
    });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    await record.destroy();
    res.json({ message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/execute", authenticated, async (req, res) => {
  try {
    const { language, sourceCode } = req.body;
    if (!language || !sourceCode) {
      return res.status(400).json({ message: "language and sourceCode required" });
    }

    let cmd, ext;
    switch (language) {
      case "javascript":
        cmd = "node";
        ext = ".js";
        break;
      case "typescript":
        cmd = `"${path.join(__dirname, "..", "node_modules", ".bin", "tsx")}"`;
        ext = ".ts";
        break;
      case "python":
        cmd = "python3";
        ext = ".py";
        break;
      default:
        return res.status(400).json({ message: `Unsupported language: ${language}` });
    }

    const tmpFile = path.join(os.tmpdir(), `cvid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    fs.writeFileSync(tmpFile, sourceCode);

    exec(`${cmd} "${tmpFile}"`, { timeout: 10000 }, (err, stdout, stderr) => {
      fs.unlink(tmpFile, () => {});
      const output = stdout + (stderr ? "\n" + stderr : "");
      res.json({
        run: {
          stdout: stdout,
          stderr: stderr,
          output: output,
          code: err ? (err.code || 1) : 0,
          signal: err ? (err.signal || null) : null,
        },
      });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
