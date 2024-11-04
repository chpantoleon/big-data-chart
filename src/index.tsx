import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import { CookiesProvider } from 'react-cookie';
import { SnackbarProvider } from 'notistack';
import { CssBaseline } from '@mui/material';


const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <SnackbarProvider
        preventDuplicate
        anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
      >
      <CookiesProvider defaultSetOptions={{ path: '/' }}>
        <CssBaseline />
        <App />
      </CookiesProvider>
    </SnackbarProvider>
  </React.StrictMode>
);
