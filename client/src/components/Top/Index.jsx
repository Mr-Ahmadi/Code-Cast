import { useContext } from "react";
import styled from "styled-components"
import { GlobalContext } from '../../contexts/GlobalStates'
import { init as initRecord, stop as stopRecord, run as runRecord } from "../../functions/record";

const Container = styled.div`
    padding: 5px;
    background-color: rgb(45,45,45);
`
const StyledButton = styled.button`
    background-color: ${props => props.color};
    color: white;
    border: none;
    margin: 3px;
`

const Top = () => {
    const { startRecording, recording, stopRecording } = useContext(GlobalContext);

    return (
        <Container>
            <StyledButton color="rgb(241,76,76)" onClick={() => {
                if (!recording) {
                    initRecord();
                    startRecording();
                } else {
                    stopRecord();
                    stopRecording();
                }
            }}>Record</StyledButton>
            <StyledButton color="rgb(80,121,38)" onClick={() => {
                runRecord()
            }}>Run</StyledButton>
        </Container>
    )
}

export default Top