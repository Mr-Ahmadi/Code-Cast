import Lecture from "../classes/Lecture";
import Typist from "../classes/Typist";

let typist, editor, lecture;

const setEditor = (_editor) => {
  editor = _editor;
};

const init = () => {
  const firstValue = editor.current.getValue();

  lecture = new Lecture();
  typist = new Typist();

  lecture.startRecord();
  typist.startRecord(Date.now(), firstValue);
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

const run = () => {
  if (lecture instanceof Lecture) {
    lecture.playBytes();
  }
  if (typist instanceof Typist) {
    typist.runChanges((str) => {
      editor.current.setValue(str);
    });
  }
};

export { setEditor, init, push, stop, run };
