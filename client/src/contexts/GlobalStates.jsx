import { createContext, useReducer } from "react";
import AppReducer from "./AppReducer"
import PropTypes from "prop-types";

const initialState = {
    recording: false,
    user: null,
    recordName: "Untitled",
    language: ["javascript", "18.15.0"]
};

export const GlobalContext = createContext(initialState);

export const GlobalProvider = ({ children }) => {
    const [state, dispatch] = useReducer(AppReducer, initialState);

    function startRecording() {
        dispatch({
            type: "START_RECORDING",
            payload: {}
        })
    }
    function stopRecording() {
        dispatch({
            type: "STOP_RECORDING",
            payload: {}
        })
    }
    function setUser(value) {
        dispatch({
            type: "SET_USER",
            payload: { value }
        })
    }
    function setRecordName(value) {
        dispatch({
            type: "SET_RECORD_NAME",
            payload: { value }
        })
    }
    function setLanguage(lang, version) {
        dispatch({
            type: "SET_LANGUAGE",
            payload: { lang, version }
        })
    }

    return (
        <GlobalContext.Provider value={{
            recording: state.recording,
            startRecording,
            stopRecording,
            user: state.user,
            setUser,
            recordName: state.recordName,
            setRecordName,
            language: state.language,
            setLanguage
        }}>
            {children}
        </GlobalContext.Provider>
    );
};

GlobalProvider.propTypes = {
    children: PropTypes.object
}