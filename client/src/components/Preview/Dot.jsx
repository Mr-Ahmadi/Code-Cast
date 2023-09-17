import styled from "styled-components";
import PropTypes from 'prop-types';

const StyledDot = styled.span`
    margin-top: 4px;
    height: 12px;
    width: 12px;
    background-color: ${props => props.color};
    border-radius: 50%;
    display: inline-block;
`;

const Dot = ({ color = "#ED594A" }) => {
    return <StyledDot color={color} />
}

Dot.propTypes = {
    color: PropTypes.string
}

export default Dot