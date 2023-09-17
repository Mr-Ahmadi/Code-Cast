import styled from "styled-components";
import PropTypes from 'prop-types';
import Icons from "./Icons";

import { AiOutlineFile } from "react-icons/ai";

const StyledFile = styled.div`
  cursor: pointer;
  padding-left: 20px;
  display: flex;
  align-items: center;
  span {
    margin-left: 5px;
  }
`;

const File = ({ name }) => {
  let ext = name.split(".")[1];

  return (
    <StyledFile>
      {Icons[ext] || <AiOutlineFile />}
      <span>{name}</span>
    </StyledFile>
  );
};

File.propTypes = {
  name: PropTypes.string.isRequired
}


export default File