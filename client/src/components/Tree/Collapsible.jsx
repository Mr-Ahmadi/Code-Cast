import styled from "styled-components";

const Collapsible = styled.div`
  height: ${p => (p.open ? "auto" : "0")};
  border-left: 1px solid rgb(88,88,88);
  overflow: hidden;
`;

export default Collapsible