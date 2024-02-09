import PropTypes from 'prop-types';

const Modal = ({ show, children }) => {
    return (
        <div className={'modal-container' + (!show ? ' hide ' : "")}>
            <div className="modal-box">
                {children}
            </div>
        </div>
    )
}

Modal.propTypes = {
    show: PropTypes.bool,
    children: PropTypes.oneOfType([PropTypes.array, PropTypes.object])
}

export default Modal