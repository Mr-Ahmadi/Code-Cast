// import Tree from './Tree'
// import Preview from './Preview/Index'
// import Editor from './Editor/Index';
// import { styled } from 'styled-components';
// import Top from './Top/Index';
import SignUp from './views/user/SignUp';
import SignIn from './views/user/SignIn';
import { Route, Routes } from 'react-router-dom';
import { useContext } from 'react';
import { GlobalContext } from '../contexts/GlobalStates'

// const Container = styled.div`
//   width: 100%;
//   display: flex;
//   flex-wrap: no-wrap;
//   justify-content: space-between;
// `

// const structure = [
//   {
//     type: "folder",
//     name: "src",
//     childrens: [
//       {
//         type: "folder",
//         name: "Components",
//         childrens: [
//           { type: "file", name: "Modal.jsx" },
//           { type: "file", name: "Modal.css" }
//         ]
//       },
//       { type: "file", name: "index.js" },
//       { type: "file", name: "index.html" }
//     ]
//   },
//   { type: "file", name: "package.json" }
// ];

export default function App() {
  const { auth } = useContext(GlobalContext);

  return (

    < Routes >
      {auth === null && <Route path='*' element={<></>} />}
      {auth === undefined && <Route path='*' element={<></>} />}
      {auth === true && <Route path='/' element={<></>} />}
      {
        auth === false &&
        <>
          <Route path='/signin' element={<SignIn />} />
          <Route path='/signup' element={<SignUp />} />
        </>
      }
      <Route path='*' element={<></>} />
    </ Routes>
  );
}

// <>
// {/* <Container> */}
// {/* <SignUp /> */}
// {/* <Tree data={structure} />
// <Preview />
//  <div>
//  {/* <Top /> */}
// {/* <Editor /> */}
// {/* // </div> */} */}
// {/* </Container> */}
// {/* </> */}