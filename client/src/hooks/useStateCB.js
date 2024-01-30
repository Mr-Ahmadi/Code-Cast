import { useState, useRef, useCallback, useEffect } from "react";

function useStateCB(initialState) {
  const [state, setState] = useState(initialState);
  const cbRef = useRef(null);

  const setStateCB = useCallback((state, cb) => {
    cbRef.current = cb;
    setState(state);
  }, []);

  useEffect(() => {
    if (cbRef.current) {
      cbRef.current(state);
      cbRef.current = null;
    }
  }, [state]);

  return [state, setStateCB];
}

export default useStateCB;
