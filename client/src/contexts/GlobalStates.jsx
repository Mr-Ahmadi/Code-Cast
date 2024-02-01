import { createContext, useReducer } from "react";
import AppReducer from "./AppReducer"
import PropTypes from "prop-types";

const initialState = {
    recording: false,
    auth: false
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

    function setAuth(value) {
        dispatch({
            type: "SET_AUTH",
            payload: { value }
        })
    }

    return (
        <GlobalContext.Provider value={{
            recording: state.recording,
            startRecording,
            stopRecording,
            auth: state.auth,
            setAuth
        }}>
            {children}
        </GlobalContext.Provider>
    );
};

GlobalProvider.propTypes = {
    children: PropTypes.object
}