import PropTypes from 'prop-types';
import { FiRefreshCw } from "react-icons/fi";

const InternalError = ({ checkAuth }) => {
    return (
        <div className="partial-container" role="alert">
            <h2 className="partial-title">Connection Error</h2>
            <div className="error">
                <div className="error-title" aria-hidden="true">500</div>
                <h4>Cannot connect to the server.
                    <br />Please check your connection and try again.</h4>
                <h3>
                    <button className="error-link" onClick={checkAuth} aria-label="Retry connection">
                        <FiRefreshCw size={14} aria-hidden="true" /> Retry
                    </button>
                </h3>
            </div>
        </div>
    )
}

InternalError.propTypes = {
    checkAuth: PropTypes.func
}

export default InternalError