import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import KnowledgeLab from "@/components/knowledge-lab";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KnowledgeLab />
  </StrictMode>,
);
