import Tree from './components/Tree'
import Preview from './components/Preview/Index'
import Editor from './components/Editor/Index';
import { styled } from 'styled-components';
import Top from './components/Top/Index';

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-wrap: no-wrap;
  justify-content: space-between;
`

const structure = [
  {
    type: "folder",
    name: "src",
    childrens: [
      {
        type: "folder",
        name: "Components",
        childrens: [
          { type: "file", name: "Modal.jsx" },
          { type: "file", name: "Modal.css" }
        ]
      },
      { type: "file", name: "index.js" },
      { type: "file", name: "index.html" }
    ]
  },
  { type: "file", name: "package.json" }
];

export default function App() {
  return (
    <>
      <Container>
        <Tree data={structure} />
        <Preview />
        <div>
          <Top />
          <Editor />
        </div>
      </Container>
    </>
  );
}
