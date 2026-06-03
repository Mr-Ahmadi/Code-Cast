import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './components/App'
import { GlobalProvider } from "./contexts/GlobalStates";
import { ModeProvider } from "./contexts/ModeContext";
import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ModeProvider>
        <GlobalProvider>
          <App />
        </GlobalProvider>
      </ModeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
