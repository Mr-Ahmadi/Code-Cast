import { useContext } from 'react'
import { GlobalContext } from '../../contexts/GlobalStates';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { load as loadRecord } from "../../functions/record";


const RecordsList = ({ display, setDisplay }) => {
    const { user } = useContext(GlobalContext);
    const [selected, setSelected] = useState(null)

    return (
        <div className={'modal-container' + (!display ? ' hide ' : "")}>
            <div className="modal-box">
                <h2 className="modal-title">Records</h2>
                <hr />
                <div className='list-container'>
                    {user.records.length ? (user.records.map((record) => {
                        console.log(record[1])
                        return <span
                            className={'file-label ' + (selected === record[1] ? "selected" : "")}
                            onClick={(ev => setSelected(ev.target.id))}
                            key={record[1]} id={record[1]}>
                            {record[0]}
                        </span>
                    })) : <h4 className="modal-title">Nothing found as a record!</h4>}
                </div>
                <hr />
                <div className="modal-bottom">
                    <button className='btn-primary' onClick={() => {
                        setDisplay(false)
                        setSelected(false)
                    }}>Close</button>
                    <button className='btn-primary' disabled={selected === null} onClick={() => {
                        selected && loadRecord(selected)
                    }}>Open</button>
                </div>
            </div>
        </div>
    )
}

RecordsList.propTypes = {
    display: PropTypes.bool,
    setDisplay: PropTypes.func
}

export default RecordsList 