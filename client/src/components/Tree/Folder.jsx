import { useState } from "react";
import { AiOutlineFolder } from "react-icons/ai";
import Collapsible from "./Collapsible"
import styled from "styled-components";
import PropTypes from "prop-types";

const StyledFolder = styled.div`
  cursor: pointer;
  padding-left: 20px;
  .folder-label {
    display: flex;
    align-items: center;
    span {
      margin-left: 5px;
    }
  }
`;

const Folder = ({ name, children }) => {
  const [open, setOpen] = useState(0);

  const handleToggle = e => {
    e.preventDefault();
    setOpen(open === 1 ? 0 : 1);
  };

  return (
    <StyledFolder>
      <div className="folder-label" onClick={handleToggle}>
        <AiOutlineFolder />
        <span>{name}</span>
      </div>
      <Collapsible open={open}>{children}</Collapsible>
    </StyledFolder>
  );
};

Folder.propTypes = {
  name: PropTypes.string.isRequired,
  children: PropTypes.object
}

export default Folder