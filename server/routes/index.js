const express = require("express");
const Record = require("../models/Record");
const User = require("../models/User");
const Workspace = require("../models/Project");
const authenticated = require("../middlewares/authenticated");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_FILES = {
  "index.html": { language: "html", firstValue: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Project</title>\n</head>\n<body>\n</body>\n</html>" },
  "style.css": { language: "css", firstValue: "" },
  "script.js": { language: "javascript", firstValue: "" },
};

const router = express.Router();

router.get("/loaddata/:id", authenticated, async (req, res) => {
  try {
    const record = await Record.findOne({
      where: { id: req.params.id, userId: res.locals.user.id },
      attributes: ["changes", "breakPoints", "firstValue", "name", "voice", "files", "fileTimeline", "pauseResumePoints"],
    });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    const { changes, breakPoints, firstValue, name, voice, files, fileTimeline, pauseResumePoints } = record;
    res.status(200).json({ changes, breakPoints, firstValue, name, voice, files, fileTimeline, pauseResumePoints, id: record.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/savedata", authenticated, async (req, res) => {
  const { id, name, files, fileTimeline,
    changes, firstValue, breakPoint, voice,
    file, fileChanges, fileBreakPoint, firstFileValue, fileLanguage, workspaceId, pauseResumePoints } = req.body;

  try {
    if (id === null) {
      const recordData = {
        changes: changes || [],
        userId: res.locals.user.id,
        name,
        breakPoints: breakPoint ? [breakPoint] : [],
        firstValue: firstValue || "",
        voice: voice || null,
        files: files || {},
        fileTimeline: fileTimeline || [],
        workspaceId: workspaceId || null,
        pauseResumePoints: pauseResumePoints || [],
      };
      if (files && Object.keys(files).length > 0) {
        recordData.firstValue = null;
        recordData.changes = [];
        recordData.breakPoints = [];
      }
      const record = await Record.create(recordData);
      return res.status(201).json({ id: record.id });
    }

    const record = await Record.findOne({
      where: { id, userId: res.locals.user.id },
    });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    if (files && Object.keys(files).length > 0) {
      for (const [name, fd] of Object.entries(files)) {
        if (record.files && record.files[name]) {
          if (fd.changes && fd.changes.length) {
            record.files[name].changes = [...(record.files[name].changes || []), ...fd.changes];
          }
          if (fd.breakPoints && fd.breakPoints.length) {
            record.files[name].breakPoints = fd.breakPoints;
          }
        } else {
          record.files = record.files || {};
          record.files[name] = fd;
        }
      }
      record.fileTimeline = fileTimeline || [];
      if (pauseResumePoints) {
        record.pauseResumePoints = pauseResumePoints;
      }
    } else if (file) {
      record.files = record.files || {};
      record.files[file] = record.files[file] || {
        language: fileLanguage || "javascript",
        firstValue: firstFileValue || "",
        changes: [],
        breakPoints: [],
      };
      if (fileChanges) {
        record.files[file].changes = [...(record.files[file].changes || []), ...fileChanges];
      }
      if (fileBreakPoint) {
        record.files[file].breakPoints = [...(record.files[file].breakPoints || []), fileBreakPoint];
      }
      if (firstFileValue && !record.files[file].firstValue) {
        record.files[file].firstValue = firstFileValue;
      }
      if (fileLanguage) {
        record.files[file].language = fileLanguage;
      }
      if (fileTimeline) {
        record.fileTimeline = fileTimeline;
      }
    } else {
      if (breakPoint !== null && breakPoint !== undefined) {
        record.breakPoints = [...(record.breakPoints || []), breakPoint];
      }
      record.changes = [...(record.changes || []), ...(changes || [])];
      if (pauseResumePoints) {
        record.pauseResumePoints = pauseResumePoints;
      }
    }

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

// --- Workspace routes ---

router.get("/workspace/list", authenticated, async (req, res) => {
  try {
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
    const result = workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      files: w.files,
      records: recordsByWs[w.id] || [],
    }));
    if (recordsByWs["none"]) {
      result.push({ id: null, name: "Unorganized", files: {}, records: recordsByWs["none"] });
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/workspace/create", authenticated, async (req, res) => {
  try {
    const { name } = req.body;
    const count = await Workspace.count({ where: { userId: res.locals.user.id } });
    if (count >= 5) {
      return res.status(403).json({ message: "Project limit reached. Maximum 5 projects per user." });
    }
    const ws = await Workspace.create({
      userId: res.locals.user.id,
      name: name || "Untitled Project",
      files: DEFAULT_FILES,
    });
    res.status(201).json({ id: ws.id, name: ws.name, files: ws.files });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/workspace/:id/records", authenticated, async (req, res) => {
  try {
    const ws = await Workspace.findOne({
      where: { id: req.params.id, userId: res.locals.user.id },
    });
    if (!ws) return res.status(404).json({ message: "Workspace not found" });
    const records = await Record.findAll({
      where: { workspaceId: req.params.id, userId: res.locals.user.id },
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
    res.status(200).json({
      workspace: { id: ws.id, name: ws.name, files: ws.files },
      records: records.map((r) => [r.name, r.id]),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/workspace/:id", authenticated, async (req, res) => {
  try {
    const ws = await Workspace.findOne({
      where: { id: req.params.id, userId: res.locals.user.id },
    });
    if (!ws) return res.status(404).json({ message: "Workspace not found" });
    await Record.destroy({ where: { workspaceId: req.params.id, userId: res.locals.user.id } });
    await ws.destroy();
    res.json({ message: "Workspace deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
