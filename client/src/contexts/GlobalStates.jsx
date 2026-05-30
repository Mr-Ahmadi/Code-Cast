import { createContext, useReducer, useMemo, useCallback } from "react";
import AppReducer from "./AppReducer"
import checkAuth from "../functions/requests/checkAuth";
import PropTypes from "prop-types";

const initialState = {
    recording: false,
    paused: false,
    user: null,
    recordName: "Untitled",
    language: ["javascript", "18.15.0"],
    playing: false,
    output: null,
    toast: null,
    audioEnabled: false,
    fontSize: 14,
    showMinimap: true,
};

export const GlobalContext = createContext(initialState);

export const GlobalProvider = ({ children }) => {
    const [state, dispatch] = useReducer(AppReducer, initialState);

    const startRecording = useCallback(() => dispatch({ type: "START_RECORDING" }), []);
    const stopRecording = useCallback(() => dispatch({ type: "STOP_RECORDING" }), []);
    const setPaused = useCallback((value) => dispatch({ type: "SET_PAUSED", payload: { value } }), []);
    const setUser = useCallback((value) => dispatch({ type: "SET_USER", payload: { value } }), []);
    const setRecordName = useCallback((value) => dispatch({ type: "SET_RECORD_NAME", payload: { value } }), []);
    const setLanguage = useCallback((lang, version) => dispatch({ type: "SET_LANGUAGE", payload: { lang, version } }), []);
    const setPlaying = useCallback((value) => dispatch({ type: "SET_PLAYING", payload: { value } }), []);
    const setOutput = useCallback((value) => dispatch({ type: "SET_OUTPUT", payload: { value } }), []);
    const setToast = useCallback((value) => dispatch({ type: "SET_TOAST", payload: { value } }), []);
    const setAudioEnabled = useCallback((value) => dispatch({ type: "SET_AUDIO_ENABLED", payload: { value } }), []);
    const setFontSize = useCallback((value) => dispatch({ type: "SET_FONT_SIZE", payload: { value } }), []);
    const setShowMinimap = useCallback((value) => dispatch({ type: "SET_SHOW_MINIMAP", payload: { value } }), []);
    const refreshUser = useCallback(() => {
        const fakeSetAuth = () => {};
        checkAuth(fakeSetAuth, (data) => dispatch({ type: "SET_USER", payload: { value: data } }));
    }, []);

    const value = useMemo(() => ({
        recording: state.recording, startRecording, stopRecording,
        paused: state.paused, setPaused,
        user: state.user, setUser,
        recordName: state.recordName, setRecordName,
        language: state.language, setLanguage,
        playing: state.playing, setPlaying,
        output: state.output, setOutput,
        toast: state.toast, setToast,
        audioEnabled: state.audioEnabled, setAudioEnabled,
        fontSize: state.fontSize, setFontSize,
        showMinimap: state.showMinimap, setShowMinimap,
        refreshUser,
    }), [
        state.recording, state.paused, state.user, state.recordName,
        state.language, state.playing, state.output,
        state.toast, state.audioEnabled,
        state.fontSize, state.showMinimap,
        startRecording, stopRecording, setPaused, setUser, setRecordName,
        setLanguage, setPlaying, setOutput, setToast,
        setAudioEnabled, setFontSize, setShowMinimap,
        refreshUser,
    ]);

    return (
        <GlobalContext.Provider value={value}>
            {children}
        </GlobalContext.Provider>
    );
};

GlobalProvider.propTypes = { children: PropTypes.object }