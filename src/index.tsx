import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Logger } from './services/logger';

// Initialize Logger early to capture startup events
Logger.getInstance();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);