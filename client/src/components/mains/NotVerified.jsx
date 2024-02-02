import PropTypes from 'prop-types';
import newLink from '../../functions/requests/newLink';
import { useState } from 'react';


const InternalError = ({ checkAuth }) => {
    const [message, setMessage] = useState([null, null]);

    return (
        <div className="partial-container">
            <h2 className="partial-title">Varification Error</h2>
            <div className="error">
                <h1 className="hypertube">403</h1>

                {message[0] === "ERROR"
                    ? <span className="message-output">{message[1]}</span>
                    : message[0] === "SUCCESS"
                        ? <span className="message-output">{message[1]}</span>
                        : message[0] === "LOADING"
                            ? <span className="message-output">Loading...</span>
                            : <h4>Your email is <span className='text-danger'>not</span> verified</h4>}

                <h3>
                    <u onClick={checkAuth}>Reload</u>
                    <u onClick={() => newLink(setMessage)}>New Link</u>
                </h3>
            </div>
        </div>
    )
}

InternalError.propTypes = {
    checkAuth: PropTypes.func
}


export default InternalError