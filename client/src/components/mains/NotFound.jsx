import PropTypes from 'prop-types';
import { Link } from 'react-router-dom'

const NotFound = ({ auth }) => {
    return (
        <div className="partial-container">
            <h2 className="partial-title">Not Found</h2>
            <div className="error">
                <h1 className="hypertube">404</h1>
                <h4>You {auth ? <span className='text-success'>are</span> : <span className='text-danger'>are not</span>} already authenicated</h4>
                <h3>
                    {auth
                        ? <Link to='/'>Main Page</Link>
                        : <Link to='/signin'>Login</Link>
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