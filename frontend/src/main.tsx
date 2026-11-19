import React from 'react';
import { createRoot } from 'react-dom/client';

// Astryx Design System styles
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';

// PteroDesk Global styles & tokens
import './styles/globals.css';

import App from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
