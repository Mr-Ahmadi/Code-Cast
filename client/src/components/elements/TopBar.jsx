import { useContext, useState } from "react";
import { GlobalContext } from '../../contexts/GlobalStates'
import { init as initRecord, stop as stopRecord, play as runRecord } from "../../functions/record";
import RecordsList from "./RecordsList";


const TopBar = () => {
    const { startRecording, recording, stopRecording, setRecordName, recordName } = useContext(GlobalContext);
    const [recordsDisplay, setRecordsDisplay] = useState(false)

    return (
        <>
            <div className="top-bar">
                <div>
                    <button className="btn-primary btn-small" onClick={() => {

                    }}>Execute Code</button>
                </div>
                <div>
                    <button className="btn-primary btn-small" onClick={() => {
                        if (!recording) {
                            initRecord(recordName);
                            startRecording();
                        } else {
                            stopRecord();
                            stopRecording();
                        }
                    }}>Start New Record</button>
                    <button className="btn-primary btn-small" onClick={() => {
                        runRecord()
                    }}>Play</button>
                </div>
                <div>
                    <input type="text" className="text-input" defaultValue={"Untitled"} onChange={ev => setRecordName(ev.target.value)} />
                    <button className="btn-primary btn-small" onClick={() => {
                        setRecordsDisplay(true)
                    }}>Open</button>
                </div>
            </div>
            <RecordsList display={recordsDisplay} setDisplay={setRecordsDisplay}/>
        </>
    )
}

export default TopBar