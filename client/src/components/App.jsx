import SignUp from './mains/SignUp';
import SignIn from './mains/SignIn';
import checkAuth from '../functions/requests/checkAuth';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Loading from './Elements/Loading';
import NotFound from './mains/NotFound';
import MainPage from './mains/MainPage';
import InternalError from './mains/InternalError';
import NotVerified from './mains/NotVerified';

export default function App() {
  const location = useLocation()

  const [auth, setAuth] = useState(null)
  const [verified, setVerified] = useState(null)

  useEffect(() => {
    checkAuth(setAuth, setVerified)
    return () => {
      setAuth(null);
      setVerified(null);
    }
  }, [location])

  return (
    < Routes >
      {auth === null && <Route path='*' element={<Loading />} />}
      {auth === undefined && <Route path='*' element={
        <InternalError checkAuth={() => checkAuth(setAuth, setVerified)} />
      } />}
      {auth === true &&
        ((verified === false)
          ? <Route path='/' element={
            <NotVerified checkAuth={() => checkAuth(setAuth, setVerified)} />
          } />
          : ((verified === true)
            ? <Route path='/' element={<MainPage />} />
            : <Route path='/' element={<Loading />} />))
      }
      {auth === false &&
        <>
          <Route path='/signin' element={<SignIn />} />
          <Route path='/signup' element={<SignUp />} />
        </>
      }
      <Route path='*' element={<NotFound auth={auth} />} />
    </ Routes>
  );
}