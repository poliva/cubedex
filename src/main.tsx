import React from 'react';
import ReactDOM from 'react-dom/client';
import './pwa-register';
import { App } from './App';
import './styles/index.css';
import { migrateLastFiveTimesToLastTimes } from './lib/storage';

migrateLastFiveTimesToLastTimes();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
