import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isTauri } from "./mock";
import "./styles.css";

// When running inside the native Tauri window we let the macOS vibrancy show
// through by keeping the document background transparent.
if (isTauri) document.body.classList.add("is-tauri");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
