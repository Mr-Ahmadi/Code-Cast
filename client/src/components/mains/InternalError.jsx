import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiMonitor, FiAlertTriangle } from "react-icons/fi";
import ServerSettings from '../elements/ServerSettings';
import Logo from '../elements/Logo';
import { describeServerUrl } from '../../services/serverConfig';
import { useMode, MODES } from '../../contexts/ModeContext';

/**
 * Shown when the configured endpoint cannot be reached. A wrong or offline
 * endpoint is the most likely cause, so the fix is offered right here rather
 * than behind a settings dialog the user cannot reach while signed out.
 */
const InternalError = ({ checkAuth }) => {
    const { setMode } = useMode();
    const navigate = useNavigate();

    const goOffline = () => {
        setMode(MODES.LOCAL);
        navigate('/');
    };

    return (
        <div className="auth-screen">
            <div className="auth-card" role="alert">
                <div className="auth-brand">
                    <Logo size={44} />
                    <div className="auth-brand-text">
                        <span className="auth-brand-name">Code Cast</span>
                        <span className="auth-brand-tagline">Record and replay code, with your voice</span>
                    </div>
                </div>

                <div className="conn-error-head">
                    <FiAlertTriangle size={18} className="conn-error-icon" />
                    <h2 className="auth-title">Can&rsquo;t reach the server</h2>
                </div>
                <p className="auth-subtitle">
                    No response from <code>{describeServerUrl()}</code>. Check that the
                    server is running, or point Code Cast at a different endpoint.
                </p>

                <div className="conn-error-actions">
                    <button className="btn btn-primary" onClick={checkAuth}>
                        <FiRefreshCw size={14} />
                        Retry
                    </button>
                    <button className="btn" onClick={goOffline}>
                        <FiMonitor size={14} />
                        Work offline
                    </button>
                </div>

                <div className="conn-error-server">
                    <ServerSettings compact onApplied={checkAuth} />
                </div>
            </div>
        </div>
    );
};

InternalError.propTypes = {
    checkAuth: PropTypes.func
};

export default InternalError;
