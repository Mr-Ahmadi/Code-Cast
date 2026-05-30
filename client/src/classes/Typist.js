import { diffChars } from "diff";
import axios from "axios";

class Typist {
  #changesList = [];
  #breakPoints = [];
  #recordingMode;
  #firstValue;
  recordName;
  #recordID;

  loadStatus;
  #currValue;

  #startTime;
  recording;
  #paused = false;
  #pauseStartTime = 0;

  #playTimeouts = [];
  #playbackRunning = false;
  audioUrl = null;
  #audioEl = null;
  #blobUrl = null;

  #flatChangesCache = null;
  #durationCache = null;

  constructor(_recordID = null) {
    this.#recordID = _recordID;
    this.loadStatus = false;
    this.recording = false;
    this.#currValue = "";

    if (_recordID !== null) this.#recordingMode = false;
    else this.#recordingMode = true;
  }

  async #initAudio() {
    if (!this.audioUrl) return;
    try {
      const url = this.audioUrl.startsWith("data:")
        ? this.audioUrl
        : `data:audio/webm;codecs=opus;base64,${this.audioUrl}`;
      const res = await fetch(url);
      const blob = await res.blob();
      this.#blobUrl = URL.createObjectURL(blob);
      console.log("Typist: blob URL created, size:", blob.size, "type:", blob.type);
    } catch (e) {
      console.warn("Typist: failed to decode audio:", e);
    }
  }

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
      this.#breakPoints = data.breakPoints || [];
      this.#firstValue = data.firstValue || "";
      this.recordName = data.name || "";
      this.#changesList = data.changes || [];
      this.audioUrl = data.voice || null;
      console.log("Typist.load: audioUrl set?", !!this.audioUrl, "length:", this.audioUrl?.length);
      if (this.audioUrl) {
        await this.#initAudio();
      }
      this.loadStatus = true;
      this.#invalidateCaches();
    } else {
      throw new Error("Failed to load record");
    }
  }

  #invalidateCaches() {
    this.#flatChangesCache = null;
    this.#durationCache = null;
  }

  #getFlatChanges() {
    if (this.#flatChangesCache) return this.#flatChangesCache;
    this.#flatChangesCache = [];
    for (let batchIdx = 0; batchIdx < this.#changesList.length; batchIdx++) {
      const batch = this.#changesList[batchIdx];
      for (let localIdx = 0; localIdx < batch.length; localIdx++) {
        this.#flatChangesCache.push({
          millis: batch[localIdx].millis,
          type: batch[localIdx].type,
          index: batch[localIdx].index,
          value: batch[localIdx].value,
          batchIdx,
          localIdx,
        });
      }
    }
    return this.#flatChangesCache;
  }

  #rebuildFullState() {
    let value = this.#firstValue;
    const flat = this.#getFlatChanges();
    const saved = this.#currValue;
    this.#currValue = value;
    for (const change of flat) {
      this.#changeString(change);
    }
    const result = this.#currValue;
    this.#currValue = saved;
    return result;
  }

  getDuration() {
    if (this.#durationCache !== null) return this.#durationCache;
    const flat = this.#getFlatChanges();
    this.#durationCache = flat.length ? flat[flat.length - 1].millis : 0;
    return this.#durationCache;
  }

  getStateAt(progress) {
    if (!this.loadStatus) return "";
    const totalDuration = this.getDuration();
    if (totalDuration === 0) return this.#firstValue;
    const targetMillis = Math.round(progress * totalDuration);
    return this.#buildStateUpTo(targetMillis);
  }

  #buildStateUpTo(targetMillis) {
    const flat = this.#getFlatChanges();
    if (!flat.length) return this.#firstValue;

    const lastIdx = flat.length - 1;

    if (flat[lastIdx].millis <= targetMillis) {
      return this.#rebuildFullState();
    }

    let lo = 0, hi = lastIdx, targetFlatIdx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (flat[mid].millis <= targetMillis) {
        targetFlatIdx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (targetFlatIdx < 0) return this.#firstValue;

    const targetBatch = flat[targetFlatIdx].batchIdx;
    const startValue = targetBatch > 0 && this.#breakPoints[targetBatch - 1]
      ? this.#breakPoints[targetBatch - 1]
      : this.#firstValue;

    const saved = this.#currValue;
    this.#currValue = startValue;

    const batchStartFlat = flat.findIndex(
      f => f.batchIdx === targetBatch && f.localIdx === 0
    );

    for (let i = batchStartFlat; i <= targetFlatIdx; i++) {
      this.#changeString(flat[i]);
    }

    const result = this.#currValue;
    this.#currValue = saved;
    return result;
  }

  // --- Recording ---

  startRecord(_startTime, _firstValue, _recordName) {
    if (!this.recording && this.#recordingMode) {
      this.recordName = _recordName;
      this.#firstValue = _firstValue;
      this.#startTime = _startTime;
      this.recording = true;
      this.#paused = false;
    }
  }

  pauseRecord() {
    if (this.recording && !this.#paused && this.#recordingMode) {
      this.#paused = true;
      this.#pauseStartTime = Date.now();
    }
  }

  resumeRecord() {
    if (this.recording && this.#paused && this.#recordingMode) {
      const pauseDuration = Date.now() - this.#pauseStartTime;
      this.#startTime += pauseDuration;
      this.#paused = false;
    }
  }

  get isPaused() { return this.#paused; }

  stopRecord() {
    if (this.recording && this.#recordingMode) {
      this.recording = false;
      this.#paused = false;
      return this.#sendData(this.#changesList);
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

  pushChanges(oldValue, newValue) {
    if (this.recording && !this.#paused && this.#recordingMode) {
      const _changes = diffChars(oldValue, newValue);

      if (this.#changesList.length % 100 === 0) {
        if (this.#changesList.length) {
          this.#breakPoints.push(oldValue);
          this.#sendData(this.#changesList.slice(0, 100), oldValue);
        }
      }

      const changes = [];
      let counter = 0;

      for (let i = 0; i < _changes.length; i++) {
        if (
          Object.prototype.hasOwnProperty.call(_changes[i], "added") &&
          Object.prototype.hasOwnProperty.call(_changes[i], "removed")
        ) {
          if (_changes[i]["added"]) {
            changes.push({
              millis: Date.now() - this.#startTime,
              type: 1,
              index: counter,
              value: _changes[i].value,
            });
            counter += _changes[i].count;
          } else {
            changes.push({
              millis: Date.now() - this.#startTime,
              type: 0,
              index: counter,
              value: _changes[i].value,
            });
          }
        } else {
          counter += _changes[i].count;
        }
      }
      this.#changesList.push(changes);
    }
  }

  // --- Playback ---

  #changeString({ type, index, value }) {
    if (type == 1) {
      this.#currValue =
        this.#currValue.slice(0, index) + value + this.#currValue.slice(index);
      return this.#currValue;
    } else {
      this.#currValue =
        this.#currValue.slice(0, index) +
        this.#currValue.slice(index + value.length);
      return this.#currValue;
    }
  }

  runChanges(func, onProgress, speed = 1, startFromMillis = 0) {
    if (this.recording || !this.loadStatus) return;

    this.#playbackRunning = true;

    const flat = this.#getFlatChanges();
    if (!flat.length) return;

    let seekIdx = -1;

    if (startFromMillis > 0) {
      let lo = 0, hi = flat.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (flat[mid].millis <= startFromMillis) {
          seekIdx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      const initialState = this.#buildStateUpTo(startFromMillis);
      this.#currValue = initialState;
      func(initialState);
    } else {
      this.#currValue = this.#firstValue;
      func(this.#currValue);
      seekIdx = -1;
    }

    if (this.#blobUrl) {
      if (!this.#audioEl) {
        console.log("runChanges: creating audio from blob URL");
        try {
          this.#audioEl = new Audio(this.#blobUrl);
        } catch (e) {
          console.warn("runChanges: failed to create Audio:", e);
        }
      }
      if (this.#audioEl) {
        this.#audioEl.playbackRate = speed;
        this.#audioEl.currentTime = startFromMillis / 1000;
        this.#audioEl.play().catch((err) => {
          console.warn("Audio play failed:", err);
        });
      }
    }

    const startIndex = seekIdx + 1;
    const totalChanges = flat.length;
    const completedBase = seekIdx + 1;

    for (let i = startIndex; i < flat.length; i++) {
      const change = flat[i];
      const delay = Math.max(0, (change.millis - startFromMillis) / speed);
      const timeout = setTimeout(() => {
        if (!this.#playbackRunning) return;
        const str = this.#changeString(change);
        func(str);
        if (onProgress) {
          const completed = completedBase + (i - startIndex + 1);
          onProgress(Math.min(completed / totalChanges, 1));
        }
        if (i === flat.length - 1) {
          this.#playbackRunning = false;
          if (onProgress) onProgress(1);
        }
      }, delay);
      this.#playTimeouts.push(timeout);
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

  hasAudio() { return !!this.#blobUrl; }

  getRecordID() { return this.#recordID; }

  exportData() {
    return {
      version: 1,
      name: this.recordName,
      firstValue: this.#firstValue,
      changes: this.#changesList,
      breakPoints: this.#breakPoints,
      audio: this.audioUrl,
      duration: this.getDuration(),
    };
  }

  async loadFromData(data) {
    this.#recordingMode = false;
    this.#changesList = data.changes || [];
    this.#breakPoints = data.breakPoints || [];
    this.#firstValue = data.firstValue || "";
    this.recordName = data.name || "Untitled";
    this.audioUrl = data.audio || null;
    this.loadStatus = true;
    this.#invalidateCaches();
    if (this.audioUrl) {
      await this.#initAudio();
    }
  }

  // --- Data persistence ---

  #sendData(selectedChanges, breakPoint = null) {
    let data = JSON.stringify({
      firstValue: this.#recordID ? null : this.#firstValue,
      changes: selectedChanges,
      breakPoint: breakPoint,
      name: this.recordName,
      id: this.#recordID,
    });
    let config = {
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
        } else if (status !== 200) {
          return;
        }

        this.#changesList = this.#changesList.filter((item) => {
          return selectedChanges.indexOf(item) === -1;
        });
        this.#invalidateCaches();
      })
      .catch(() => {});
  }
}

export default Typist;