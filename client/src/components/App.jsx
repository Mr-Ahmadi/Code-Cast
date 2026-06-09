import { lazy, Suspense, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import checkAuth from '../functions/requests/checkAuth';
import Loading from './mains/Loading';
import { GlobalContext } from '../contexts/GlobalStates';
import { useMode, MODES } from '../contexts/ModeContext';

const SignUp = lazy(() => import('./mains/SignUp'));
const SignIn = lazy(() => import('./mains/SignIn'));
const NotFound = lazy(() => import('./mains/NotFound'));
const MainPage = lazy(() => import('./mains/MainPage'));
const InternalError = lazy(() => import('./mains/InternalError'));

export default function App() {
  const location = useLocation()
  const [auth, setAuth] = useState(null)
  const { user, setUser, theme } = useContext(GlobalContext)
  const { mode } = useMode()

  useEffect(() => {
    if (mode === MODES.LOCAL) {
      setAuth(true);
      setUser({ email: 'local@desktop', workspaces: [] });
      return;
    }
    checkAuth(setAuth, setUser)
    return () => {
      setAuth(null);
      setUser(null);
    }
  }, [location, setUser, mode])

  useLayoutEffect(() => {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.body.setAttribute('data-theme', nextTheme);
  }, [theme]);

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
