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
        default: state
    }
}

export default defaultFunc;