import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App.js";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("ScoutPass root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
