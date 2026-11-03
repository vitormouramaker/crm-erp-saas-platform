import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // Importar
import App from './App.tsx'
import './styles/global.css'
import { installAuthenticatedFetch } from './utils/authenticatedFetch.ts'

installAuthenticatedFetch()

document.documentElement.lang = 'pt-BR'
document.documentElement.setAttribute('translate', 'no')
document.documentElement.classList.add('notranslate')
document.body?.setAttribute('translate', 'no')
document.body?.classList.add('notranslate')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter> {/* Adicionar o provider do roteador aqui */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
