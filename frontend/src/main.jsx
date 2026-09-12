import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./shell/App.jsx";
import { AuthProvider } from "./shared/store.jsx";
import { TxProvider } from "./shared/components/TxProcessing.jsx";
import "./shared/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TxProvider>
          <App />
        </TxProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
