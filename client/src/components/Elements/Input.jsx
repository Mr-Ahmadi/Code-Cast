import styled from "styled-components";

const Input = styled.input`
    display: block;
    width: 98%;
    margin-bottom:5px;
    border: none;
    border-bottom: 2px solid #9cdcfe;
    outline: none;
    font-size: 16px;
    color: #d4d4d4;
    background-color: transparent;
    &:focus {
      border-color: #264f78;
    }
  `;

export default Input;