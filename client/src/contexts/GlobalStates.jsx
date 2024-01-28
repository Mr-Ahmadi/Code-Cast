import { createContext, useReducer } from "react";
import AppReducer from "./AppReducer"
import PropTypes from "prop-types";

const initialState = {
    recording: false,
    auth: null
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

    function setAuthUnknown() {
        dispatch({
            type: "STOP_RECORDING",
            payload: {}
        })
    }
    function setAuthFailed() {
        dispatch({
            type: "STOP_RECORDING",
            payload: {}
        })
    }
    function setAuthTrue() {
        dispatch({
            type: "STOP_RECORDING",
            payload: {}
        })
    }
    function setAuthFalse() {
        dispatch({
            type: "STOP_RECORDING",
            payload: {}
        })
    }

    return (
        <GlobalContext.Provider value={{
            recording: state.recording,
            startRecording,
            stopRecording,
            auth: state.auth,
            setAuthUnknown,
            setAuthFailed,
            setAuthTrue,
            setAuthFalse,
        }}>
            {children}
        </GlobalContext.Provider>
    );
};

GlobalProvider.propTypes = {
    children: PropTypes.object
}