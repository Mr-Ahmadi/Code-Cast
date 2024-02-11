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

  constructor(_recordID = null) {
    this.#recordID = _recordID;
    this.loadStatus = false;
    this.recording = false;
    this.#currValue = "";

    if (_recordID !== null) this.#loadData(_recordID);
    else this.#recordingMode = true;
  }

  startRecord(_startTime, _firstValue, _recordName) {
    if (!this.recording && this.#recordingMode) {
      this.recordName = _recordName;
      this.#firstValue = _firstValue;
      this.#startTime = _startTime;
      this.recording = true;
    }
  }
  stopRecord() {
    if (this.recording && this.#recordingMode) {
      this.recording = false;
      this.#sendData(this.#changesList);
    }
  }
  pushChanges(oldValue, newValue) {
    if (this.recording && this.#recordingMode) {
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
          // eslint-disable-next-line no-prototype-builtins
          _changes[i].hasOwnProperty("added") &&
          // eslint-disable-next-line no-prototype-builtins
          _changes[i].hasOwnProperty("removed")
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
  runChanges(func) {
    if (!this.recording && !this.#recordingMode) {
      this.#currValue = this.#firstValue;
      func(this.#currValue);

      for (let j = 0; j < this.#changesList.length; j++) {
        for (let i = 0; i < this.#changesList[j].length; i++) {
          setTimeout(() => {
            func && func(this.#changeString(this.#changesList[j][i]));
          }, this.#changesList[j][i].millis);
        }
      }
    }
  }

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
      headers: {
        "Content-Type": "application/json",
      },
      data,
      withCredentials: true,
    };

    axios
      .request(config)
      .then(({ status, data: { id } }) => {
        if (status === 201) {
          this.#recordID = id;

          this.#changesList = this.#changesList.filter((item) => {
            return selectedChanges.indexOf(item) === -1;
          });
        } else {
          console.log("Error");
        }
      })
      .catch((err) => {
        console.log("Error => " + err);
      });
  }
  #loadData(recordID) {
    let config = {
      method: "get",
      url: `index/loaddata/${recordID}`,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    };

    axios
      .request(config)
      .then(
        ({
          status,
          data: { changes, breakPoints, recordName, firstValue },
        }) => {
          if (status === 200) {
            this.#breakPoints = breakPoints;
            this.#firstValue = firstValue;
            this.recordName = recordName;
            this.#changesList = changes;
            this.#recordingMode = false;
            this.loadStatus = true;
          } else {
            console.log("Error");
          }
        }
      )
      .catch((err) => {
        console.log("Error => " + err);
      });
  }
}

export default Typist;
