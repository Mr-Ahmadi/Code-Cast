/**
 * Resolves a payload that may be a React-style updater function.
 *
 * Callers reach for `set(prev => !prev)` out of habit; without this the updater
 * itself would be stored as the new state, which silently made the minimap and
 * explorer toggles permanently "on".
 */
const resolve = (value, previous) => (typeof value === "function" ? value(previous) : value);

const set = (state, key, action) => ({ ...state, [key]: resolve(action.payload.value, state[key]) });

const defaultFunc = (state, action) => {
    switch (action.type) {
        case "START_RECORDING":
            return { ...state, recording: true, paused: false }
        case "STOP_RECORDING":
            return { ...state, recording: false, paused: false }
        case "SET_PAUSED":
            return set(state, "paused", action)
        case "SET_USER":
            return set(state, "user", action)
        case "SET_RECORD_NAME":
            return set(state, "recordName", action)
        case "SET_PLAYING":
            return set(state, "playing", action)
        case "SET_OUTPUT":
            return set(state, "output", action)
        case "SET_TOAST":
            return set(state, "toast", action)
        case "SET_AUDIO_ENABLED":
            return set(state, "audioEnabled", action)
        case "SET_FONT_SIZE":
            return set(state, "fontSize", action)
        case "SET_SHOW_MINIMAP":
            return set(state, "showMinimap", action)
        case "SET_ACTIVE_FILE":
            return set(state, "activeFile", action)
        case "SET_PREVIEW_FILE":
            return set(state, "previewFile", action)
        case "SET_FILES":
            return set(state, "files", action)
        case "SET_SIDEBAR_OPEN":
            return set(state, "sidebarOpen", action)
        case "SET_CURRENT_WORKSPACE":
            return set(state, "currentWorkspace", action)
        case "SET_CURRENT_RECORD":
            return set(state, "currentRecord", action)
        case "SET_AUTOSAVE":
            return set(state, "autoSave", action)
        case "SET_THEME":
            return set(state, "theme", action)
        case "SET_DIRTY_FILES":
            return set(state, "dirtyFiles", action)
        case "SET_SETTINGS":
            return set(state, "settings", action)
        case "SET_SETTINGS_OPEN":
            return set(state, "settingsOpen", action)
        default:
            return state
    }
}

export default defaultFunc;
