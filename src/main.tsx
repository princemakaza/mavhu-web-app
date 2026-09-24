import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './view/styles/tokens.css';
import './view/styles/base.css';
import './view/styles/components.css';
import './view/styles/screens.css';
import './view/styles/cbz.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
