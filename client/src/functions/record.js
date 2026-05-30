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

const start = async (recordName, audioEnabled = true) => {
  const firstValue = editor.current.getValue();

  if (lecture instanceof Lecture && audioEnabled) {
    try {
      await lecture.startRecord();
    } catch {
      // Mic denied silently
    }
  }
  if (typist instanceof Typist) {
    typist.startRecord(Date.now(), firstValue, recordName);
  }
};

const pause = () => {
  if (lecture instanceof Lecture) {
    lecture.pauseRecord();
  }
  if (typist instanceof Typist) {
    typist.pauseRecord();
  }
};

const resume = () => {
  if (lecture instanceof Lecture) {
    lecture.resumeRecord();
  }
  if (typist instanceof Typist) {
    typist.resumeRecord();
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
    console.log("stop: audioBytes length:", audioBytes?.length, "mime:", lecture.mimeType);
    if (audioBytes && audioBytes.length) {
      const blob = new Blob([audioBytes], { type: lecture.mimeType });
      audioDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      console.log("stop: data URL length:", audioDataUrl.length);
    }
  }
  if (typist instanceof Typist) {
    await typist.stopRecord();
    console.log("stop: recordID after stopRecord:", typist.getRecordID());
    if (audioDataUrl) {
      await typist.saveAudio(audioDataUrl);
      console.log("stop: audio saved");
    }
  }
};

const load = async (id) => {
  typist = new Typist(id);
  await typist.load(id);
  return typist.recordName;
};

const play = (onProgress, speed) => {
  if (typist instanceof Typist) {
    typist.runChanges((str) => {
      if (editor && editor.current) {
        editor.current.setValue(str);
      }
    }, onProgress, speed, 0);
  }
};

const stopPlay = () => {
  if (typist instanceof Typist) {
    typist.stopPlayback();
  }
};

const seek = (progress, onProgress, speed) => {
  if (typist instanceof Typist) {
    const targetMillis = Math.round(progress * typist.getDuration());
    typist.seek(targetMillis, (str) => {
      if (editor && editor.current) {
        editor.current.setValue(str);
      }
    }, onProgress, speed);
  }
};

const getDuration = () => {
  if (typist instanceof Typist) {
    return typist.getDuration();
  }
  return 0;
};

const getStateAt = (progress) => {
  if (typist instanceof Typist) {
    return typist.getStateAt(progress);
  }
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

export {
  setEditor, init, start, pause, resume, isPaused, push, stop, load,
  play, stopPlay, seek, getDuration, getStateAt,
  isTypistLoaded, getTypist, isAudioRecording,
  exportRecord, importFromFile,
};