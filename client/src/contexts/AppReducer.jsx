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

        case "SET_AUTH_TRUE":
            return {
                ...state, auth: true
            }
        case "SET_AUTH_FALSE":
            return {
                ...state, auth: false
            }
        case "SET_AUTH_UNKNOWN":
            return {
                ...state, auth: null
            }
        case "SET_AUTH_FAILED":
            return {
                ...state, auth: undefined
            }
        default: state
    }
}

export default defaultFunc;