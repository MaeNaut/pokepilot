import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LocalizationProvider } from "./i18n/LocalizationProvider";
import "./styles.css";
import { initializeAccountAuth } from "./api/accountAuth";

// Process OAuth callbacks even when the PokePilot panel has not mounted yet.
void initializeAccountAuth().catch(() => { /* Account controls show retry guidance. */ });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocalizationProvider>
      <App />
    </LocalizationProvider>
  </StrictMode>,
);
