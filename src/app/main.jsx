import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ShellApp.jsx';
import { I18nProvider } from '../shared/i18n';
import '../styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
