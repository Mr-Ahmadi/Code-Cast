import Editor from '../elements/Editor';
import Output from '../elements/Output';
import Top from '../elements/TopBar';

export default function App() {

    return (
        <div className='main-container'>
            <Top />
            <Editor />
            <Output value={" > Hello world!"} />
        </div>
    );
}