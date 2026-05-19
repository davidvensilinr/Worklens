import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@worklens/api-client-react";

// Configure the base URL for all API requests. 
// In production, this should be set to your Render Web Service URL.
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
