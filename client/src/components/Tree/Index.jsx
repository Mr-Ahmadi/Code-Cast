import TreeRecursive from "./TreeRecursive"
import styled from "styled-components";
import PropTypes from 'prop-types';
import Folder from "./Folder"
import File from "./File"

const StyledTree = styled.div`
  line-height: 1.5;
  width: 360px;
  background-color: rgb(37,37,38);
    color: white;
`;

const Tree = ({ data, children }) => {
    const isImparative = data && !children;

    return (
        <StyledTree>
            {isImparative ? <TreeRecursive data={data} /> : children}
        </StyledTree>
    );
};

Tree.File = File;
Tree.Folder = Folder;

Tree.propTypes = {
    data: PropTypes.array,
    children: PropTypes.object
}

export default Tree