import PropTypes from 'prop-types';
import styled from "styled-components"

const StyledRow = styled.div`
  padding: 10px;
  background: #f1f1f1;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  &:after {
    content: "";
    display: table;
    clear: both;
  }
  .column {
    float: left;
  }
  .left {
    width: 15%;
  }
  .right {
    width: 10%;
  }
  .middle {
    width: 75%;
  }
`;


const Row = ({ children }) => {
  return (
    <StyledRow>{children}</StyledRow>
  )
}

Row.propTypes = {
  children: PropTypes.array
}

export default Row