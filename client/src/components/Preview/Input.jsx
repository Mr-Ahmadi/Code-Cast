import styled from "styled-components"

const StyledInput = styled.input`
  width: 100%;
  border-radius: 3px;
  border: none;
  background-color: white;
  margin-top: -8px;
  height: 25px;
  color: #666;
  padding: 5px;
`

const Input = () => { return (<StyledInput type="text" />) }


export default Input