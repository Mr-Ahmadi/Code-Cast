import PropTypes from 'prop-types';


const InternalError = ({ checkAuth }) => {
    return (
        <div className="partial-container">
            <h2 className="partial-title">Internal Error</h2>
            <div className="error">
                <h1 className="hypertube">500</h1>
                <h4>Can <span className='text-success'>not</span> connect server</h4>
                <h3>
                    <u onClick={checkAuth} >Retry</u>
                </h3>
            </div>
        </div>
    )
}

InternalError.propTypes = {
    checkAuth: PropTypes.func
}


export default InternalError