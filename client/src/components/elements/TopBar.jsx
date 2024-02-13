import { useContext, useState } from "react";
import { GlobalContext } from '../../contexts/GlobalStates'
import { start as startRecord, stop as stopRecord, play as runRecord } from "../../functions/record";
import RecordsList from "./RecordsList";
import langVersions from '../../constants/langVersions.json'
import { executeCode } from "../../functions/requests/execute";
import PropTypes from 'prop-types';


const TopBar = ({ editorRef }) => {
    const { startRecording, recording, stopRecording, recordName, setLanguage, language } = useContext(GlobalContext);
    const [recordsDisplay, setRecordsDisplay] = useState(true)

    return (
        <>
            <div className="top-bar">
                <div>
                    <button className="btn-primary size-small" onClick={async () => {
                        const sourceCode = editorRef.current.getValue();
                        console.log(sourceCode)
                        if (!sourceCode) return;
                        try {
                            const { run: result } = await executeCode(language, sourceCode);
                            console.log(result)
                        } catch (error) {
                            console.log(error);
                        }
                    }}>Execute</button>
                    <select name="languages" id="selectedLang" className="select-box size-small" onChange={ev => {
                        setLanguage(ev.target.value, langVersions[ev.target.value])
                    }}>
                        {Object.keys(langVersions).map(lang => <option value={lang} key={lang}>{lang} {langVersions[lang]}</option>)}
                    </select>
                </div>
                <div>
                    <button className="btn-primary size-small" onClick={() => {
                        if (!recording) {
                            startRecord(recordName);
                            startRecording();
                        } else {
                            stopRecord();
                            stopRecording();
                        }
                    }}>Start New Record</button>
                    <button className="btn-primary size-small" onClick={() => {
                        runRecord()
                    }}>Play</button>
                </div>
                <div>
                    <button className="btn-primary size-small" onClick={() => {
                        setRecordsDisplay(true)
                    }}>Open</button>
                </div>
            </div >
            <RecordsList display={recordsDisplay} setDisplay={setRecordsDisplay} />
        </>
    )
}
TopBar.propTypes = {
    editorRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.any })
    ])
}


export default TopBar