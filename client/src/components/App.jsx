import { lazy, Suspense, useContext, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import checkAuth from '../functions/requests/checkAuth';
import Loading from './mains/Loading';
import { GlobalContext } from '../contexts/GlobalStates';

const SignUp = lazy(() => import('./mains/SignUp'));
const SignIn = lazy(() => import('./mains/SignIn'));
const NotFound = lazy(() => import('./mains/NotFound'));
const MainPage = lazy(() => import('./mains/MainPage'));
const InternalError = lazy(() => import('./mains/InternalError'));

export default function App() {
  const location = useLocation()
  const [auth, setAuth] = useState(null)
  const { user, setUser } = useContext(GlobalContext)

  useEffect(() => {
    checkAuth(setAuth, setUser)
    return () => {
      setAuth(null);
      setUser(null);
    }
  }, [location, setUser])

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {auth === null && <Route path='*' element={<Loading />} />}
        {auth === undefined && <Route path='*' element={
          <InternalError checkAuth={() => checkAuth(setAuth, setUser)} />
        } />}
        {auth === true &&
          ((user)
            ? <Route path='/' element={<MainPage />} />
            : <Route path='/' element={<Loading />} />)
        }
        {auth === false &&
          <>
            <Route path='/signin' element={<SignIn />} />
            <Route path='/signup' element={<SignUp />} />
          </>
        }
        <Route path='*' element={<NotFound auth={auth} />} />
      </Routes>
    </Suspense>
  );
}