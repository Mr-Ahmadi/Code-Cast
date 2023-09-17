import { diffChars } from "diff";

class Typist {
  #changesList = [];
  #totalSaves = [];
  currentValue;
  firstValue;
  #startTime;
  #recording;

  constructor() {
    this.#recording = false;
  }

  startRecord(_startTime, _firstValue) {
    if (!this.#recording) {
      this.firstValue = _firstValue;
      this.currentValue = "";
      this.#startTime = _startTime;
      this.#recording = true;
    }
  }

  stopRecord() {
    if (this.#recording) this.#recording = false;
  }

  pushChanges(oldValue, newValue) {
    if (this.#recording) {
      const _changes = diffChars(oldValue, newValue);

      if (this.#changesList.length % 100 === 0) this.#totalSaves.push(oldValue);

      const changes = [];
      let counter = 0;

      for (let i = 0; i < _changes.length; i++) {
        if (
          _changes[i].hasOwnProperty("added") &&
          _changes[i].hasOwnProperty("removed")
        ) {
          if (_changes[i]["added"]) {
            console.log(`add ${_changes[i].value} at ${counter}`);
            changes.push({
              millis: Date.now() - this.#startTime,
              type: 1,
              index: counter,
              value: _changes[i].value,
            });
            counter += _changes[i].count;
          } else {
            console.log(`remove ${_changes[i].value} at ${counter}`);
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

  #changeString({ type, index, value }) {
    if (type == 1) {
      this.currentValue =
        this.currentValue.slice(0, index) +
        value +
        this.currentValue.slice(index);
      return this.currentValue;
    } else {
      this.currentValue =
        this.currentValue.slice(0, index) +
        this.currentValue.slice(index + value.length);
      return this.currentValue;
    }
  }

  runChanges(func) {
    if (!this.#recording) {
      this.currentValue = this.firstValue;
      func(this.currentValue);

      for (const changes of this.#changesList) {
        for (let i = 0; i < changes.length; i++) {
          setTimeout(() => {
            func && func(this.#changeString(changes[i]));
          }, changes[i].millis);
        }
      }
    }
  }
}

export default Typist;
