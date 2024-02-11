const defaultFunc = (state, action) => {
    switch (action.type) {
        case "START_RECORDING":
            return {
                ...state, recording: true
            }
        case "STOP_RECORDING":
            return {
                ...state, recording: false
            }
        case "SET_USER":
            return {
                ...state, user: action.payload.value
            }
        case "SET_RECORD_NAME":
            return {
                ...state, recordName: action.payload.value
            }
        case "SET_LANGUAGE":
            return {
                ...state, language: [action.payload.lang, action.payload.version]
            }
        default: state
    }
}

export default defaultFunc;