import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/900.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/600.css';
// Dashboard top bar face, shared by every series.
import '@fontsource/saira/800.css';
import './app/licensed-fonts.css';
import './app/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
