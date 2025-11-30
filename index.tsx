import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Safely resolve createRoot from either named export (standard ESM) or default export (some bundles)
// We check if ReactDOMClient exists before accessing properties to avoid Uncaught TypeError
const createRoot = ReactDOMClient?.createRoot || (ReactDOMClient as any)?.default?.createRoot;

if (!createRoot) {
    console.error("ReactDOMClient exports:", ReactDOMClient);
    throw new Error("Failed to resolve createRoot from react-dom/client");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);