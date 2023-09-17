class Lecture {
  #byteArray = null;
  #recorder = null;
  #chunks = [];
  #recording;

  constructor() {
    this.#recording = false;
  }

  startRecord() {
    if (!this.#recording) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        this.#recorder = new MediaRecorder(stream);

        this.#recorder.ondataavailable = (e) => {
          this.#chunks.push(e.data);

          if (this.#recorder.state == "inactive") {
            let blob = new Blob(this.#chunks, {
              type: "audio/webm;codecs=opus",
            });

            let reader = new FileReader();

            reader.onloadend = () => {
              this.#byteArray = new Uint8Array(reader.result);
              console.log(reader.result);
            };

            reader.readAsArrayBuffer(blob);
          }
        };

        this.#recorder.start();
        this.#recording = true;
      });
    }
  }

  stopRecord() {
    if (this.#recording) {
      this.#recorder.stop();
      console.log(this.#chunks);
      this.#recording = false;
    }
  }

  playBytes() {
    if (!this.#recording) {
      let blob = new Blob([this.#byteArray], {
        type: "audio/webm;codecs=opus",
      });
      console.log(window.URL.createObjectURL(blob));
      const audio = new Audio(window.URL.createObjectURL(blob));
      audio.play();
    }
  }
}
export default Lecture;
