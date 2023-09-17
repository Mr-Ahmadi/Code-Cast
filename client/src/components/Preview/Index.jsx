import styled from "styled-components"
import Bars from "./Bars"
import Dot from "./Dot"
import Input from "./Input"
import Row from "./Row"
import Draggable from "react-draggable"

const Container = styled.div`
  top: 2.5em;
  right: 1.5em;
  z-index: 1000;
  position: absolute;
  background-color: white;
  border: 3px solid #f1f1f1;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  resize: both;
  overflow: auto;
  * {
    box-sizing: border-box;
  }
`
const Content = styled.div`
  padding: 10px;
`

const Preview = () => {
  return (
    <Draggable handle=".handle">
      <Container>
        <div className="handle">
          <Row>
            <div className="column left">
              <Dot color="#ED594A;" />
              &nbsp;
              <Dot color="#FDD800" />
              &nbsp;
              <Dot color="#5AC05A" />
            </div>
            <div className="column middle">
              <Input />
            </div>
            <div className="column right">
              <div style={{ float: "right" }}>
                <Bars />
              </div>
            </div>
          </Row>
        </div>
        <Content>
          <h3>Browser Window</h3>
          <p>How to create a detailed browser window look with CSS.</p>
        </Content>
      </Container>
    </Draggable>
  )
}

export default Preview