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

const start = (recordName) => {
  const firstValue = editor.current.getValue();

  lecture.startRecord();
  typist.startRecord(Date.now(), firstValue, recordName);
};

const push = (oldValue, newValue) => {
  if (typist instanceof Typist) {
    typist.pushChanges(oldValue, newValue);
  }
};

const stop = () => {
  if (typist instanceof Typist) {
    typist.stopRecord();
  }
  if (lecture instanceof Lecture) {
    lecture.stopRecord();
  }
};

const load = (id) => {
  // lecture = new Lecture();
  typist = new Typist(id);
};

const play = () => {
  // if (lecture instanceof Lecture) {
  //   lecture.playBytes();
  // }
  if (typist instanceof Typist) {
    typist.runChanges((str) => {
      editor.current.setValue(str);
    });
  }
};

export { setEditor, init, start, push, stop, load, play };
