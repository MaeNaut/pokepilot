import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LocalizationProvider } from "./i18n/LocalizationProvider";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocalizationProvider>
      <App />
    </LocalizationProvider>
  </StrictMode>,
);
