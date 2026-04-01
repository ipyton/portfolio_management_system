import { createElement, useEffect, useState } from "react";

const langflowScriptSrc =
  import.meta.env.VITE_LANGFLOW_SCRIPT_SRC ||
  "https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@v1.0.7/dist/build/static/js/bundle.min.js";
const flowId = import.meta.env.VITE_LANGFLOW_FLOW_ID || "";
const hostUrl = import.meta.env.VITE_LANGFLOW_HOST_URL || "";
const windowTitle =
  import.meta.env.VITE_LANGFLOW_WINDOW_TITLE || "Portfolio Assistant";

export default function LangflowWidget() {
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const existingScript = document.querySelector(
      `script[data-langflow-script="${langflowScriptSrc}"]`,
    );

    if (existingScript) {
      setIsScriptReady(true);
      return undefined;
    }

    const script = document.createElement("script");
    script.src = langflowScriptSrc;
    script.async = true;
    script.dataset.langflowScript = langflowScriptSrc;
    script.onload = () => setIsScriptReady(true);
    script.onerror = () => {
      setLoadError("Langflow script failed to load.");
    };

    document.body.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  if (!flowId || !hostUrl) {
    return (
      <aside className="langflow-fallback" aria-live="polite">
        <p className="langflow-fallback-title">Assistant unavailable</p>
        <p>Set `VITE_LANGFLOW_FLOW_ID` and `VITE_LANGFLOW_HOST_URL` in `.env.dev`.</p>
      </aside>
    );
  }

  if (loadError) {
    return (
      <aside className="langflow-fallback error" aria-live="assertive">
        <p className="langflow-fallback-title">Langflow unavailable</p>
        <p>{loadError}</p>
      </aside>
    );
  }

  return (
    <div className="langflow-widget-shell">
      {isScriptReady
        ? createElement("langflow-chat", {
            flow_id: flowId,
            host_url: hostUrl,
            window_title: windowTitle,
          })
        : (
          <aside className="langflow-fallback" aria-live="polite">
            <p className="langflow-fallback-title">Assistant loading</p>
            <p>Connecting the embedded assistant.</p>
          </aside>
        )}
    </div>
  );
}
