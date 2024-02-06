import { useContext } from "react";
import { GlobalContext } from '../../contexts/GlobalStates'
import { init as initRecord, stop as stopRecord, run as runRecord } from "../../functions/record";


const TopBar = () => {
    const { startRecording, recording, stopRecording } = useContext(GlobalContext);

    return (
        <div className="top-bar">
            <button className="btn-primary btn-small" onClick={() => {
                if (!recording) {
                    initRecord();
                    startRecording();
                } else {
                    stopRecord();
                    stopRecording();
                }
            }}>Record</button>
            <button className="btn-primary btn-small" onClick={() => {
                runRecord()
            }}>Run</button>
        </div>
    )
}

export default TopBar