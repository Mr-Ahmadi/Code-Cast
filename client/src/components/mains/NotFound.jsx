import PropTypes from 'prop-types';
import { Link } from 'react-router-dom'
import { FiHome, FiLogIn } from "react-icons/fi";

const NotFound = ({ auth }) => {
    return (
        <div className="partial-container">
            <h2 className="partial-title">Not Found</h2>
            <div className="error">
                <div className="error-title" aria-hidden="true">404</div>
                <h4>This page does not exist.</h4>
                <h3>
                    {auth
                        ? <Link to='/' className="error-link" aria-label="Go to main page"><FiHome size={14} aria-hidden="true" /> Main Page</Link>
                        : <Link to='/signin' className="error-link" aria-label="Go to sign in"><FiLogIn size={14} aria-hidden="true" /> Sign In</Link>
                    }
                </h3>
            </div>
        </div>
    )
}

NotFound.propTypes = {
    auth: PropTypes.bool
}

export default NotFound