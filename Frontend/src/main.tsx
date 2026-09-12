import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { setupFetchInterceptor } from './services/mockApi';
import './tailwind.css';
import './index.css';

// Initialize mock server interceptor for /shipments/sync endpoint
setupFetchInterceptor();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
