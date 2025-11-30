import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import App from './App';
// CSS is loaded via <link> in index.html to avoid import errors in some environments
// import './index.css'; 

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
    // Safely resolve createRoot from either named export (standard ESM) or default export (some bundles)
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
} catch (error) {
    console.error("Failed to mount application:", error);
    rootElement.innerHTML = `<div style="color: red; padding: 20px;">
        <h1>Application Error</h1>
        <p>Failed to load application. Please check the console for details.</p>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
    </div>`;
}