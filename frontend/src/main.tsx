import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { SimulationProvider } from "./context/SimulationContext";
import { ToastProvider } from "./context/ToastContext";
import "./styles/design-tokens.css";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ToastProvider>
      <SimulationProvider>
        <App />
      </SimulationProvider>
    </ToastProvider>
  </StrictMode>,
);
