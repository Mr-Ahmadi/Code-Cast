import { createContext, useReducer } from "react";
import AppReducer from "./AppReducer"
import PropTypes from "prop-types";

const initialState = {
    recording: false,
    user: null,
    recordName: "Untitled"
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

    return (
        <GlobalContext.Provider value={{
            recording: state.recording,
            startRecording,
            stopRecording,
            user: state.user,
            setUser,
            recordName: state.recordName,
            setRecordName
        }}>
            {children}
        </GlobalContext.Provider>
    );
};

GlobalProvider.propTypes = {
    children: PropTypes.object
}