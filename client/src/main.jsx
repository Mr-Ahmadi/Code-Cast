import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './components/App'
import { GlobalProvider } from "./contexts/GlobalStates";
import { ModeProvider } from "./contexts/ModeContext";
import { HashRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ModeProvider>
        <GlobalProvider>
          <App />
        </GlobalProvider>
      </ModeProvider>
        </HashRouter>
  </React.StrictMode>,
)
