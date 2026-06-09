const defaultFunc = (state, action) => {
    switch (action.type) {
        case "START_RECORDING":
            return { ...state, recording: true, paused: false }
        case "STOP_RECORDING":
            return { ...state, recording: false, paused: false }
        case "SET_PAUSED":
            return { ...state, paused: action.payload.value }
        case "SET_USER":
            return { ...state, user: action.payload.value }
        case "SET_RECORD_NAME":
            return { ...state, recordName: action.payload.value }
        case "SET_PLAYING":
            return { ...state, playing: action.payload.value }
        case "SET_OUTPUT":
            return { ...state, output: action.payload.value }
        case "SET_TOAST":
            return { ...state, toast: action.payload.value }
        case "SET_AUDIO_ENABLED":
            return { ...state, audioEnabled: action.payload.value }
        case "SET_FONT_SIZE":
            return { ...state, fontSize: action.payload.value }
        case "SET_SHOW_MINIMAP":
            return { ...state, showMinimap: action.payload.value }
        case "SET_ACTIVE_FILE":
            return { ...state, activeFile: action.payload.value }
        case "SET_FILES":
            return { ...state, files: action.payload.value }
        case "SET_SIDEBAR_OPEN":
            return { ...state, sidebarOpen: action.payload.value }
        case "SET_CURRENT_WORKSPACE":
            return { ...state, currentWorkspace: action.payload.value }
        case "SET_CURRENT_RECORD":
            return { ...state, currentRecord: action.payload.value }
        case "SET_AUTOSAVE":
            return { ...state, autoSave: action.payload.value }
        case "SET_THEME":
            return { ...state, theme: action.payload.value }
        default:
            return state
    }
}

export default defaultFunc;
