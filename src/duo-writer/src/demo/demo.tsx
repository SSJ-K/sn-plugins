// Demo page: wraps the editor in a mock Standard Notes (from the template),
// so it can be tried in a plain browser. Not part of the plugin itself.
import React from 'react';
import './demo.css';
import {createRoot} from 'react-dom/client';
import DemoApp from './DemoApp';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DemoApp/>
  </React.StrictMode>
);
