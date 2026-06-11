import { diffChars } from "diff";
import axios from "axios";
import { extLang } from "../functions/fileTypes";

const BREAKPOINT_INTERVAL = 100;

class Typist {
  #files = {};
  #fileTimeline = [];
  #activeFile = null;
  #recordingMode;
  #recordID;
  #workspaceId = null;
  #workspacePath = null;
  recordName;
  loadStatus;

  #startTime;
  recording;
  #paused = false;
  #pauseStartTime = 0;
  #pauseResumePoints = [];

  #playTimeouts = [];
  #playbackRunning = false;
  #playbackCurrValues = {};
  #activePlaybackFile = null;

  audioUrl = null;
  #audioEl = null;
  #blobUrl = null;

  #flatEventsCache = null;
  #durationCache = null;

  constructor(_recordID = null) {
    this.#recordID = _recordID;
    this.loadStatus = false;
    this.recording = false;
    if (_recordID !== null) this.#recordingMode = false;
    else this.#recordingMode = true;
  }

  // --- File management ---

  getFiles() {
    return Object.entries(this.#files).map(([name, f]) => ({
      name,
      language: f.language,
    }));
  }

  getFileNames() {
    return Object.keys(this.#files);
  }

  getActiveFile() {
    return this.#activeFile;
  }

  getFileLanguage(name) {
    return this.#files[name]?.language || "plaintext";
  }

  getFileFirstValue(name) {
    return this.#files[name]?.firstValue || "";
  }

  getFileContent(name) {
    return this.#files[name]?.firstValue || "";
  }

  getFileFinalContent(name) {
    if (!this.#files[name]) return "";
    return this.#rebuildFileFullState(name);
  }

  getFilesFinalContent() {
    const result = {};
    for (const name of Object.keys(this.#files)) {
      result[name] = this.getFileFinalContent(name);
    }
    return result;
  }

  addFile(name, language, content = "") {
    if (this.#files[name]) return;
    this.#files[name] = {
      language: language || extLang(name),
      firstValue: content,
      changesList: [],
      breakPoints: [],
      _flatCache: null,
    };
    this.#invalidateCaches();
  }

  setFileContent(name, content) {
    if (!this.#files[name]) return;
    this.#files[name].firstValue = content;
    this.#invalidateCaches();
  }

  removeFile(name) {
    if (!this.#files[name]) return;
    const wasActive = this.#activeFile === name;
    delete this.#files[name];
    this.#fileTimeline = this.#fileTimeline.filter(e => e.name !== name);
    if (wasActive) {
      const keys = Object.keys(this.#files);
      this.#activeFile = keys.length ? keys[0] : null;
    }
    this.#invalidateCaches();
  }

  renameFile(oldName, newName) {
    if (!this.#files[oldName] || this.#files[newName]) return false;
    this.#files[newName] = this.#files[oldName];
    delete this.#files[oldName];
    this.#fileTimeline = this.#fileTimeline.map(e =>
      e.name === oldName ? { ...e, name: newName } : e
    );
    if (this.#activeFile === oldName) this.#activeFile = newName;
    this.#invalidateCaches();
    return true;
  }

  switchFile(name) {
    if (!this.#files[name]) return;
    if (this.recording && this.#recordingMode) {
      this.#activeFile = name;
      const last = this.#fileTimeline[this.#fileTimeline.length - 1];
      const millis = this.recording && !this.#paused
        ? Date.now() - this.#startTime
        : (last ? last.millis : 0);
      if (!last || last.name !== name) {
        this.#fileTimeline.push({ millis, name });
        this.#invalidateCaches();
      }
    } else {
      this.#activeFile = name;
    }
  }

  isFileOpen(name) {
    return !!this.#files[name];
  }

  // --- Audio ---

  async #initAudio() {
    if (!this.audioUrl) return;
    try {
      const url = this.audioUrl.startsWith("data:")
        ? this.audioUrl
        : `data:audio/webm;codecs=opus;base64,${this.audioUrl}`;
      const res = await fetch(url);
      const blob = await res.blob();
      this.#blobUrl = URL.createObjectURL(blob);
    } catch (e) {
      console.warn("Typist: failed to decode audio:", e);
    }
  }

  // --- Load / Save ---

  async load(id) {
    this.#recordID = id;
    this.#recordingMode = false;
    const config = {
      method: "get",
      url: `index/loaddata/${id}`,
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
    };
    const { status, data } = await axios.request(config);
    if (status === 200) {
      this.recordName = data.name || "";
      this.audioUrl = data.voice || null;
      if (data.files && Object.keys(data.files).length > 0) {
        this.#files = {};
        for (const [name, fd] of Object.entries(data.files)) {
          this.#files[name] = {
            language: fd.language || extLang(name),
            firstValue: fd.firstValue || "",
            changesList: fd.changes || [],
            breakPoints: fd.breakPoints || [],
            _flatCache: null,
          };
        }
        this.#fileTimeline = data.fileTimeline || [];
        if (!this.#fileTimeline.length && Object.keys(this.#files).length > 0) {
          this.#fileTimeline.push({ millis: 0, name: Object.keys(this.#files)[0] });
        }
        this.#pauseResumePoints = data.pauseResumePoints || [];
      } else {
        const legacyName = "code.js";
        this.#files[legacyName] = {
          language: "javascript",
          firstValue: data.firstValue || "",
          changesList: data.changes || [],
          breakPoints: data.breakPoints || [],
          _flatCache: null,
        };
        this.#fileTimeline = [{ millis: 0, name: legacyName }];
        this.#pauseResumePoints = data.pauseResumePoints || [];
      }
      this.#activeFile = Object.keys(this.#files)[0] || null;
      if (this.audioUrl) await this.#initAudio();
      this.loadStatus = true;
      this.#invalidateCaches();
    } else {
      throw new Error("Failed to load record");
    }
  }

  #invalidateCaches() {
    this.#flatEventsCache = null;
    this.#durationCache = null;
    for (const f of Object.values(this.#files)) {
      f._flatCache = null;
    }
  }

  #getFileFlatChanges(fileName) {
    const file = this.#files[fileName];
    if (!file) return [];
    if (file._flatCache) return file._flatCache;
    file._flatCache = [];
    for (let batchIdx = 0; batchIdx < file.changesList.length; batchIdx++) {
      const batch = file.changesList[batchIdx];
      for (let localIdx = 0; localIdx < batch.length; localIdx++) {
        file._flatCache.push({
          millis: batch[localIdx].millis,
          type: batch[localIdx].type,
          index: batch[localIdx].index,
          value: batch[localIdx].value,
          batchIdx,
          localIdx,
        });
      }
    }
    return file._flatCache;
  }

  #applyChange(str, { type, index, value }) {
    if (type === 1) {
      return str.slice(0, index) + value + str.slice(index);
    }
    return str.slice(0, index) + str.slice(index + value.length);
  }

  #firstFileFlatIndexOfBatch(fileName, targetBatch) {
    const flat = this.#getFileFlatChanges(fileName);
    let lo = 0, hi = flat.length - 1, idx = flat.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (flat[mid].batchIdx >= targetBatch) {
        idx = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return idx;
  }

  #rebuildFileFullState(fileName) {
    const file = this.#files[fileName];
    const flat = this.#getFileFlatChanges(fileName);
    if (!flat.length) return file.firstValue;

    const lastBpIdx = file.breakPoints.length - 1;
    if (lastBpIdx >= 0) {
      let str = file.breakPoints[lastBpIdx];
      const startBatch = (lastBpIdx + 1) * BREAKPOINT_INTERVAL;
      const startIdx = this.#firstFileFlatIndexOfBatch(fileName, startBatch);
      for (let i = startIdx; i < flat.length; i++) {
        str = this.#applyChange(str, flat[i]);
      }
      return str;
    }
    let str = file.firstValue;
    for (const change of flat) {
      str = this.#applyChange(str, change);
    }
    return str;
  }

  #buildFileStateUpTo(fileName, targetMillis) {
    const file = this.#files[fileName];
    if (!file) return "";
    const flat = this.#getFileFlatChanges(fileName);
    if (!flat.length) return file.firstValue;

    const lastIdx = flat.length - 1;
    if (flat[lastIdx].millis <= targetMillis) {
      return this.#rebuildFileFullState(fileName);
    }

    let lo = 0, hi = lastIdx, targetIdx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (flat[mid].millis <= targetMillis) {
        targetIdx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (targetIdx < 0) return file.firstValue;

    const targetBatch = flat[targetIdx].batchIdx;
    const bpIdx = Math.floor(targetBatch / BREAKPOINT_INTERVAL) - 1;
    const hasBp = bpIdx >= 0 && bpIdx < file.breakPoints.length;
    let str = hasBp ? file.breakPoints[bpIdx] : file.firstValue;
    const startBatch = hasBp ? (bpIdx + 1) * BREAKPOINT_INTERVAL : 0;

    const startFlatIdx = this.#firstFileFlatIndexOfBatch(fileName, startBatch);
    for (let i = startFlatIdx; i <= targetIdx; i++) {
      str = this.#applyChange(str, flat[i]);
    }
    return str;
  }

  #getActiveFileAt(millis) {
    if (!this.#fileTimeline.length) {
      const keys = Object.keys(this.#files);
      return keys.length ? keys[0] : null;
    }
    let lo = 0, hi = this.#fileTimeline.length - 1, idx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.#fileTimeline[mid].millis <= millis) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return this.#fileTimeline[idx].name;
  }

  #getFlatEvents() {
    if (this.#flatEventsCache) return this.#flatEventsCache;
    const events = [];

    for (const entry of this.#fileTimeline) {
      events.push({
        millis: entry.millis,
        type: "file",
        name: entry.name,
      });
    }

    for (const point of this.#pauseResumePoints) {
      events.push({
        millis: point.millis,
        type: "resume",
        file: point.file,
      });
    }

    for (const [name] of Object.entries(this.#files)) {
      const flat = this.#getFileFlatChanges(name);
      for (const change of flat) {
        events.push({
          millis: change.millis,
          type: "change",
          file: name,
          data: { type: change.type, index: change.index, value: change.value },
        });
      }
    }

    events.sort((a, b) => a.millis - b.millis || (a.type === "file" ? -1 : 1));
    this.#flatEventsCache = events;
    return events;
  }

  getDuration() {
    if (this.#durationCache !== null) return this.#durationCache;
    const events = this.#getFlatEvents();
    this.#durationCache = events.length ? events[events.length - 1].millis : 0;
    return this.#durationCache;
  }

  getStateAt(progress) {
    if (!this.loadStatus) return "";
    const totalDuration = this.getDuration();
    if (totalDuration === 0) {
      const f = this.#activeFile;
      if (f && this.#files[f]) return this.#files[f].firstValue;
      const keys = Object.keys(this.#files);
      return keys.length ? this.#files[keys[0]].firstValue : "";
    }
    const millis = Math.round(progress * totalDuration);
    const activeFile = this.#getActiveFileAt(millis);
    return activeFile ? this.#buildFileStateUpTo(activeFile, millis) : "";
  }

  // --- Recording ---

  startRecord(
    _startTime,
    firstFileName,
    firstValue,
    language,
    _recordName,
    _workspaceId = null,
    _workspacePath = null,
    filesSnapshot = null,
    activeFileName = null
  ) {
    if (!this.recording && this.#recordingMode) {
      this.recordName = _recordName;
      this.#workspaceId = _workspaceId;
      this.#workspacePath = _workspacePath;
      const hasFiles = Object.keys(this.#files).length > 0;

      if (!hasFiles) {
        this.#files = {};
        this.#fileTimeline = [];
        this.#activeFile = firstFileName;
        this.#files[firstFileName] = {
          language: language || extLang(firstFileName),
          firstValue: firstValue || "",
          changesList: [],
          breakPoints: [],
          _flatCache: null,
        };
        this.#fileTimeline.push({ millis: 0, name: firstFileName });
      } else {
        if (filesSnapshot && typeof filesSnapshot === "object") {
          const snapshotEntries = Object.entries(filesSnapshot);
          const snapshotSet = new Set(snapshotEntries.map(([name]) => name));

          for (const [name, content] of snapshotEntries) {
            if (!this.#files[name]) {
              this.#files[name] = {
                language: extLang(name),
                firstValue: typeof content === "string" ? content : "",
                changesList: [],
                breakPoints: [],
                _flatCache: null,
              };
            } else {
              this.#files[name].firstValue = typeof content === "string" ? content : "";
            }
          }

          for (const name of Object.keys(this.#files)) {
            if (!snapshotSet.has(name)) {
              delete this.#files[name];
            }
          }
        } else if (firstFileName && this.#files[firstFileName]) {
          this.#files[firstFileName].firstValue = firstValue || "";
        }

        const first = Object.keys(this.#files)[0] || null;
        const preferredActive = (activeFileName && this.#files[activeFileName])
          ? activeFileName
          : (this.#activeFile && this.#files[this.#activeFile])
            ? this.#activeFile
            : first;

        this.#activeFile = preferredActive;
        this.#fileTimeline = [];
        if (preferredActive) {
          this.#fileTimeline.push({ millis: 0, name: preferredActive });
        }

        for (const name of Object.keys(this.#files)) {
          const file = this.#files[name];
          file.changesList = [];
          file.breakPoints = [];
          file._flatCache = null;
        }
      }

      this.#startTime = _startTime;
      this.recording = true;
      this.#paused = false;
      this.#invalidateCaches();
    }
  }

  pauseRecord() {
    if (this.recording && !this.#paused && this.#recordingMode) {
      this.#paused = true;
      this.#pauseStartTime = Date.now();
    }
  }

  resumeRecord(editorValue) {
    if (this.recording && this.#paused && this.#recordingMode) {
      const pauseDuration = Date.now() - this.#pauseStartTime;
      this.#startTime += pauseDuration;
      const millis = Date.now() - this.#startTime;
      this.#pauseResumePoints.push({ millis, file: this.#activeFile });

      if (editorValue !== undefined) {
        const file = this.#files[this.#activeFile];
        if (file) {
          const lastState = this.#rebuildFileFullState(this.#activeFile);
          if (lastState !== editorValue) {
            this.#pushChangesWithMillis(lastState, editorValue, millis);
          }
        }
      }

      this.#paused = false;
    }
  }

  get isPaused() { return this.#paused; }

  stopRecord() {
    if (this.recording && this.#recordingMode) {
      this.recording = false;
      this.#paused = false;
      return this.#sendFinalData();
    }
    return Promise.resolve();
  }

  async saveAudio(audioBase64) {
    if (!this.#recordID) return;
    try {
      await axios.request({
        method: "patch",
        url: `index/audio/${this.#recordID}`,
        headers: { "Content-Type": "application/json" },
        data: { voice: audioBase64 },
        withCredentials: true,
      });
    } catch (err) {
      console.error("Failed to save audio:", err);
    }
  }

  #pushChangesWithMillis(oldValue, newValue, millis) {
    const file = this.#files[this.#activeFile];
    if (!file) return;

    const _changes = diffChars(oldValue, newValue);

    if (
      file.changesList.length > 0 &&
      file.changesList.length % BREAKPOINT_INTERVAL === 0
    ) {
      file.breakPoints.push(oldValue);
      this.#sendFileBatch(this.#activeFile);
    }

    const changes = [];
    let counter = 0;

    for (let i = 0; i < _changes.length; i++) {
      if (_changes[i].added) {
        changes.push({
          millis,
          type: 1,
          index: counter,
          value: _changes[i].value,
        });
        counter += _changes[i].count;
      } else if (_changes[i].removed) {
        changes.push({
          millis,
          type: 0,
          index: counter,
          value: _changes[i].value,
        });
      } else {
        counter += _changes[i].count;
      }
    }
    file.changesList.push(changes);
    file._flatCache = null;
    this.#invalidateCaches();
  }

  pushChanges(oldValue, newValue) {
    if (!this.recording || this.#paused || !this.#recordingMode) return;
    this.#pushChangesWithMillis(oldValue, newValue, Date.now() - this.#startTime);
  }

  // --- Playback ---

  runChanges(func, onProgress, speed = 1, startFromMillis = 0) {
    if (this.recording || !this.loadStatus) return;

    this.#playbackRunning = true;
    this.#activePlaybackFile = null;

    const events = this.#getFlatEvents();
    if (!events.length) return;

    let seekIdx = -1;
    if (startFromMillis > 0) {
      let lo = 0, hi = events.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (events[mid].millis <= startFromMillis) {
          seekIdx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      this.#rebuildPlaybackState(startFromMillis);
    } else {
      for (const [name, file] of Object.entries(this.#files)) {
        this.#playbackCurrValues[name] = file.firstValue;
      }
      seekIdx = -1;
    }

    const activeFile = this.#getActiveFileAt(startFromMillis);
    this.#activePlaybackFile = activeFile;
    if (activeFile) {
      func({ name: activeFile, content: this.#playbackCurrValues[activeFile] || "", isSwitch: true });
    }

    if (this.#blobUrl) {
      if (!this.#audioEl) {
        try {
          this.#audioEl = new Audio(this.#blobUrl);
        } catch (e) {
          console.warn("runChanges: failed to create Audio:", e);
        }
      }
      if (this.#audioEl) {
        this.#audioEl.playbackRate = speed;
        const startTime = startFromMillis / 1000;
        const playAudio = () => {
          if (!this.#audioEl) return;
          this.#audioEl.currentTime = startTime;
          this.#audioEl.play().catch((err) => {
            console.warn("Audio play failed:", err);
          });
        };
        if (this.#audioEl.readyState >= 1) {
          playAudio();
        } else {
          this.#audioEl.addEventListener('loadedmetadata', playAudio, { once: true });
        }
      }
    }

    const startIndex = seekIdx + 1;

    for (let i = startIndex; i < events.length; i++) {
      const event = events[i];
      const delay = Math.max(0, (event.millis - startFromMillis) / speed);
      const timeout = setTimeout(() => {
        if (!this.#playbackRunning) return;

        if (event.type === "file") {
          this.#activePlaybackFile = event.name;
          func({ name: event.name, content: this.#playbackCurrValues[event.name] || "", isSwitch: true });
        } else if (event.type === "resume") {
          this.#activePlaybackFile = event.file;
          func({ name: event.file, content: this.#playbackCurrValues[event.file] || "", isResume: true });
        } else {
          const prev = this.#playbackCurrValues[event.file] || "";
          const newVal = this.#applyChange(prev, event.data);
          this.#playbackCurrValues[event.file] = newVal;
          if (event.file === this.#activePlaybackFile) {
            func({ name: event.file, content: newVal, isSwitch: false });
          }
        }

        if (onProgress) {
          const totalDuration = this.getDuration();
          onProgress(Math.min(event.millis / (totalDuration || 1), 1));
        }
        if (i === events.length - 1) {
          this.#playbackRunning = false;
          if (onProgress) onProgress(1);
        }
      }, delay);
      this.#playTimeouts.push(timeout);
    }
  }

  #rebuildPlaybackState(targetMillis) {
    for (const name of Object.keys(this.#files)) {
      this.#playbackCurrValues[name] = this.#buildFileStateUpTo(name, targetMillis);
    }
  }

  seek(targetMillis, func, onProgress, speed) {
    if (!this.#playbackRunning) return;
    this.#playTimeouts.forEach(clearTimeout);
    this.#playTimeouts = [];
    this.runChanges(func, onProgress, speed, targetMillis);
  }

  stopPlayback() {
    this.#playbackRunning = false;
    this.#playTimeouts.forEach(clearTimeout);
    this.#playTimeouts = [];
    if (this.#audioEl) {
      this.#audioEl.pause();
      this.#audioEl = null;
    }
  }

  isLoaded() { return this.loadStatus; }

  _getWorkspaceId() { return this.#workspaceId; }
  _getWorkspacePath() { return this.#workspacePath; }

  hasAudio() { return !!this.#blobUrl; }

  getRecordID() { return this.#recordID; }

  // --- Import / Export ---

  exportData() {
    const files = {};
    for (const [name, fd] of Object.entries(this.#files)) {
      files[name] = {
        language: fd.language,
        firstValue: fd.firstValue,
        changes: fd.changesList,
        breakPoints: fd.breakPoints,
      };
    }
    return {
      version: 3,
      name: this.recordName,
      files,
      fileTimeline: this.#fileTimeline,
      pauseResumePoints: this.#pauseResumePoints,
      audio: this.audioUrl,
      duration: this.getDuration(),
      workspacePath: this.#workspacePath,
    };
  }

  async loadFromData(data) {
    this.#recordingMode = false;
    this.recordName = data.name || "Untitled";
    this.audioUrl = data.audio || null;
    this.loadStatus = true;

    if (data.version >= 2 && data.files) {
      this.#files = {};
      for (const [name, fd] of Object.entries(data.files)) {
        this.#files[name] = {
          language: fd.language || extLang(name),
          firstValue: fd.firstValue || "",
          changesList: fd.changes || [],
          breakPoints: fd.breakPoints || [],
          _flatCache: null,
        };
      }
      this.#fileTimeline = data.fileTimeline || [];
      if (!this.#fileTimeline.length && Object.keys(this.#files).length > 0) {
        this.#fileTimeline.push({ millis: 0, name: Object.keys(this.#files)[0] });
      }
    } else {
      const legacyName = "code.js";
      this.#files[legacyName] = {
        language: "javascript",
        firstValue: data.firstValue || "",
        changesList: data.changes || [],
        breakPoints: data.breakPoints || [],
        _flatCache: null,
      };
      this.#fileTimeline = [{ millis: 0, name: legacyName }];
    }
    this.#pauseResumePoints = data.pauseResumePoints || [];
    this.#activeFile = Object.keys(this.#files)[0] || null;
    this.#invalidateCaches();
    if (this.audioUrl) await this.#initAudio();
  }

  // --- Data persistence ---

  #sendFileBatch(fileName) {
    const file = this.#files[fileName];
    if (!file || !file.changesList.length) return;

    const selectedChanges = file.changesList.slice(0, BREAKPOINT_INTERVAL);
    const data = JSON.stringify({
      id: this.#recordID,
      workspaceId: this.#workspaceId,
      name: this.recordName,
      file: fileName,
      fileChanges: selectedChanges,
      fileBreakPoint: file.breakPoints.length > 0 ? file.breakPoints[file.breakPoints.length - 1] : null,
      firstFileValue: this.#recordID ? null : file.firstValue,
      fileLanguage: file.language,
      fileTimeline: this.#fileTimeline,
    });
    const config = {
      method: "post",
      url: "index/savedata",
      headers: { "Content-Type": "application/json" },
      data,
      withCredentials: true,
    };

    return axios
      .request(config)
      .then(({ status, data }) => {
        if (status === 201) {
          this.#recordID = data.id;
        }
        file.changesList = file.changesList.filter(
          (item) => selectedChanges.indexOf(item) === -1
        );
        file._flatCache = null;
        this.#invalidateCaches();
      })
      .catch((err) => {
        console.error(`Failed to save batch for "${fileName}":`, err?.response?.data || err.message);
      });
  }

  #sendFinalData() {
    const files = {};
    for (const [name, fd] of Object.entries(this.#files)) {
      files[name] = {
        language: fd.language,
        firstValue: fd.firstValue,
        changes: fd.changesList,
        breakPoints: fd.breakPoints,
      };
    }
    const data = JSON.stringify({
      id: this.#recordID,
      workspaceId: this.#workspaceId,
      name: this.recordName,
      files,
      fileTimeline: this.#fileTimeline,
      pauseResumePoints: this.#pauseResumePoints,
    });
    const config = {
      method: "post",
      url: "index/savedata",
      headers: { "Content-Type": "application/json" },
      data,
      withCredentials: true,
    };

    return axios.request(config).catch((err) => {
      const msg = err?.response?.data?.message || err.message;
      console.error("Failed to save final data:", msg);
      throw new Error(msg);
    });
  }
}

export default Typist;
