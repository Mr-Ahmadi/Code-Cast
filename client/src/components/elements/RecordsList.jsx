import { useContext } from 'react'
import { GlobalContext } from '../../contexts/GlobalStates';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { init as initRecord, load as loadRecord } from "../../functions/record";


const RecordsList = ({ display, setDisplay }) => {
    const { user, setRecordName } = useContext(GlobalContext);
    const [selected, setSelected] = useState(null)

    return (
        <div className={'modal-container' + (!display ? ' hide ' : "")}>
            <div className="modal-box">
                <h2 className="modal-title">Records</h2>
                <hr />
                <div className='list-container'>
                    {user.records.length ? (user.records.map((record) => {
                        return <span
                            className={'file-label ' + (selected === record[1] ? "selected" : "")}
                            onClick={(ev => setSelected(ev.target.id))}
                            key={record[1]} id={record[1]}>
                            {record[0]}
                        </span>
                    })) : <h4 className="modal-title">Nothing found as a record!</h4>}
                    <span className={'file-label ' + (selected === true ? "selected" : "")}
                        onClick={(() => setSelected(true))}><code>New Record...</code></span>
                </div>
                <hr />
                <div className="bottom-row">
                    {/* <button className='btn-primary' onClick={() => {
                        setDisplay(false)
                        setSelected(null)
                    }}>Close</button> */}
                    <div>
                        <input type="text" className={"text-input " + (selected === true ? "" : "hide")} defaultValue={"Untitled"} onChange={ev => setRecordName(ev.target.value)} />
                    </div>
                    <div>
                        <button className='btn-primary' disabled={selected === null} onClick={async () => {
                            if (selected) {
                                if (selected === true) {
                                    initRecord()
                                    setDisplay(false)
                                    setSelected(null)
                                } else {
                                    loadRecord(selected)
                                    setDisplay(false)
                                    setSelected(null)
                                }
                            }
                        }}>Open</button>
                    </div>
                </div>
            </div>
        </div >
    )
}

RecordsList.propTypes = {
    display: PropTypes.bool,
    setDisplay: PropTypes.func
}

export default RecordsList 