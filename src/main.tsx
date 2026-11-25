import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/index.css'
import '@fontsource/dejavu-sans'
import '@fontsource/dejavu-sans/700.css'
import '@fontsource/lato'
import '@fontsource/lato/700.css'
import '@fontsource/roboto'
import '@fontsource/roboto/700.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)


