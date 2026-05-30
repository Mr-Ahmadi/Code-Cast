class Lecture {
  #byteArray = null;
  #recorder = null;
  #chunks = [];
  #recording = false;
  #paused = false;
  #mimeType = "audio/webm;codecs=opus";

  get isRecording() { return this.#recording; }
  get isPaused() { return this.#paused; }
  get mimeType() { return this.#mimeType; }

  startRecord() {
    if (this.#recording) return Promise.resolve();
    return navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/aac",
      ];
      const supported = preferred.find(t => MediaRecorder.isTypeSupported(t));
      this.#mimeType = supported || "";
      this.#recorder = new MediaRecorder(stream, this.#mimeType ? { mimeType: this.#mimeType } : undefined);
      this.#chunks = [];
      this.#recorder.ondataavailable = (e) => { this.#chunks.push(e.data); };
      this.#recorder.start();
      this.#recording = true;
      this.#paused = false;
    });
  }

  pauseRecord() {
    if (this.#recording && this.#recorder && this.#recorder.state === "recording") {
      this.#recorder.pause();
      this.#paused = true;
    }
  }

  resumeRecord() {
    if (this.#recording && this.#recorder && this.#recorder.state === "paused") {
      this.#recorder.resume();
      this.#paused = false;
    }
  }

  stopRecord() {
    return new Promise((resolve) => {
      if (this.#recording && this.#recorder && this.#recorder.state !== "inactive") {
        this.#recorder.onstop = () => {
          const blob = new Blob(this.#chunks, { type: this.#mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            this.#byteArray = new Uint8Array(reader.result);
            this.#recording = false;
            this.#paused = false;
            this.#chunks = [];
            this.#recorder.stream.getTracks().forEach(t => t.stop());
            console.log("Lecture: audio captured, bytes:", this.#byteArray.length, "mime:", this.#mimeType);
            resolve(this.#byteArray);
          };
          reader.readAsArrayBuffer(blob);
        };
        if (this.#recorder.state === "paused") {
          this.#recorder.resume();
          this.#recorder.stop();
        } else {
          this.#recorder.stop();
        }
      } else {
        this.#recording = false;
        this.#paused = false;
        resolve(null);
      }
    });
  }

  getAudioData() { return this.#byteArray; }

  playBytes() {
    if (!this.#byteArray) return null;
    const blob = new Blob([this.#byteArray], { type: this.#mimeType });
    const url = window.URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    return audio;
  }
}

export default Lecture;