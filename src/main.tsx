import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { initializeTheme } from "./lib/themeManager";

import { TempoDevtools } from "tempo-devtools";
TempoDevtools.init();

// Initialize theme system with a random theme on first load
const selectedTheme = initializeTheme(true);
console.log(`Initialized theme: ${selectedTheme}`);

const basename = import.meta.env.BASE_URL;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
