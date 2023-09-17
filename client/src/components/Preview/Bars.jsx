import styled from "styled-components"

const Bar = styled.div`
  width: 17px;
  height: 3px;
  background-color: #aaa;
  margin: 3px 0;
  display: block;
`

const Bars = () => {
    return (
        <>
            <Bar />
            <Bar />
            <Bar />
        </>
    )
}

export default Bars