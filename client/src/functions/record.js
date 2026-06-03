import Lecture from "../classes/Lecture";
import Typist from "../classes/Typist";

let typist, editor, lecture;

const setEditor = (_editor) => {
  editor = _editor;
};

const init = () => {
  lecture = new Lecture();
  typist = new Typist();
};

const start = async (recordName, audioEnabled = true, workspaceId = null) => {
  if (lecture instanceof Lecture && audioEnabled) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Audio permission timeout")), 3000));
      await Promise.race([lecture.startRecord(), timeout]);
    } catch {
      // Mic denied or timeout silently
    }
  }
  if (typist instanceof Typist) {
    const files = typist.getFiles();
    let firstFileName, firstValue, language;
    if (files.length > 0) {
      firstFileName = files[0].name;
      firstValue = editor.current?.getValue() || "";
      language = files[0].language;
    } else {
      firstFileName = "index.html";
      firstValue = editor.current?.getValue() || "";
      language = "html";
      typist.addFile(firstFileName, language, firstValue);
    }
    typist.startRecord(Date.now(), firstFileName, firstValue, language, recordName, workspaceId);
  }
};

const pause = () => {
  if (lecture instanceof Lecture) lecture.pauseRecord();
  if (typist instanceof Typist) typist.pauseRecord();
};

const resume = () => {
  if (lecture instanceof Lecture) lecture.resumeRecord();
  if (typist instanceof Typist) {
    const currentValue = editor?.current?.getValue();
    typist.resumeRecord(currentValue);
  }
};

const isPaused = () => {
  return typist instanceof Typist && typist.isPaused;
};

const push = (oldValue, newValue) => {
  if (typist instanceof Typist) {
    typist.pushChanges(oldValue, newValue);
  }
};

const stop = async () => {
  let audioDataUrl = null;
  if (lecture instanceof Lecture) {
    const audioBytes = await lecture.stopRecord();
    if (audioBytes && audioBytes.length) {
      const blob = new Blob([audioBytes], { type: lecture.mimeType });
      audioDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
  }
  let success = true;
  if (typist instanceof Typist) {
    try {
      const mode = localStorage.getItem('codevideo_mode') || 'online';
      if (mode === 'local') {
        await stopLocal(typist);
      } else {
        await typist.stopRecord();
      }
    } catch {
      success = false;
    }
    if (audioDataUrl) {
      try {
        if (success) {
          const mode = localStorage.getItem('codevideo_mode') || 'online';
          if (mode === 'local') {
            // audio already stored with record
          } else {
            await typist.saveAudio(audioDataUrl);
          }
        }
      } catch {
        success = false;
      }
    }
  }
  return success;
};

async function stopLocal(typistInstance) {
  const { default: localStore } = await import("../stores/localStore");
  const data = typistInstance.exportData();
  const projectId = typistInstance._getWorkspaceId?.() || null;
  await localStore.saveLocalRecording(projectId, typistInstance.recordName || "Untitled", data);
}

const load = async (id) => {
  const mode = localStorage.getItem('codevideo_mode') || 'online';
  if (mode === 'local') {
    const { default: localStore } = await import("../stores/localStore");
    const rec = await localStore.getLocalRecording(id);
    if (!rec) throw new Error("Recording not found");
    typist = new Typist();
    await typist.loadFromData(rec.data);
    return typist.recordName;
  }
  typist = new Typist(id);
  await typist.load(id);
  return typist.recordName;
};

const play = (onProgress, speed) => {
  if (typist instanceof Typist) {
    typist.runChanges(({ name, content, isSwitch, isResume }) => {
      if (window.__playbackHandler) {
        window.__playbackHandler(name, content, isSwitch, isResume);
      }
    }, onProgress, speed, 0);
  }
};

const stopPlay = () => {
  if (typist instanceof Typist) typist.stopPlayback();
};

const seek = (progress, onProgress, speed) => {
  if (typist instanceof Typist) {
    const targetMillis = Math.round(progress * typist.getDuration());
    typist.seek(targetMillis, ({ name, content, isSwitch, isResume }) => {
      if (window.__playbackHandler) {
        window.__playbackHandler(name, content, isSwitch, isResume);
      }
    }, onProgress, speed);
  }
};

const getDuration = () => {
  if (typist instanceof Typist) return typist.getDuration();
  return 0;
};

const getStateAt = (progress) => {
  if (typist instanceof Typist) return typist.getStateAt(progress);
  return "";
};

const isTypistLoaded = () => {
  return typist instanceof Typist && typist.isLoaded();
};

const getTypist = () => typist;

const isAudioRecording = () => {
  return lecture instanceof Lecture && lecture.isRecording;
};

const exportRecord = () => {
  if (!typist || !typist.isLoaded()) {
    console.warn("exportRecord: no loaded record");
    return;
  }
  const data = typist.exportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.name || "recording").replace(/[^a-zA-Z0-9_-]/g, "_")}.cvid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const importFromFile = async (file) => {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data.version) {
    throw new Error("Invalid .cvid file");
  }
  typist = new Typist();
  await typist.loadFromData(data);
  return typist.recordName;
};

// --- File management ---

const getFiles = () => {
  if (typist instanceof Typist) return typist.getFiles();
  return [];
};

const getActiveFile = () => {
  if (typist instanceof Typist) return typist.getActiveFile();
  return null;
};

const addFile = (name, language, content) => {
  if (typist instanceof Typist) typist.addFile(name, language, content);
};

const removeFile = (name) => {
  if (typist instanceof Typist) typist.removeFile(name);
};

const renameFile = (oldName, newName) => {
  if (typist instanceof Typist) return typist.renameFile(oldName, newName);
  return false;
};

const switchFile = (name) => {
  if (typist instanceof Typist) typist.switchFile(name);
};

const isFileOpen = (name) => {
  if (typist instanceof Typist) return typist.isFileOpen(name);
  return false;
};

const getFileLanguage = (name) => {
  if (typist instanceof Typist) return typist.getFileLanguage(name);
  return "plaintext";
};

const getFileFirstValue = (name) => {
  if (typist instanceof Typist) return typist.getFileFirstValue(name);
  return "";
};

const getFilesFinalContent = () => {
  if (typist instanceof Typist) return typist.getFilesFinalContent();
  return {};
};

export {
  setEditor, init, start, pause, resume, isPaused, push, stop, load,
  play, stopPlay, seek, getDuration, getStateAt,
  isTypistLoaded, getTypist, isAudioRecording,
  exportRecord, importFromFile,
  getFiles, getActiveFile, addFile, removeFile, renameFile, switchFile,
  isFileOpen, getFileLanguage, getFileFirstValue, getFilesFinalContent,
};
