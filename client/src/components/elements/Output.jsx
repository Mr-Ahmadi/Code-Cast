import PropTypes from 'prop-types';

const Output = ({ value }) => {
    return (
        <div className="output-container">
            <h4>Result</h4>
            <br />
            <span>
                {value}
            </span>
        </div>
    )
}

Output.propTypes = {
    value: PropTypes.string
}

export default Output