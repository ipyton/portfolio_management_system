import { createElement, useEffect, useState } from "react";

const langflowScriptSrc =
  import.meta.env.VITE_LANGFLOW_SCRIPT_SRC ||
  "https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@v1.0.7/dist/build/static/js/bundle.min.js";
const flowId = import.meta.env.VITE_LANGFLOW_FLOW_ID || "";
const hostUrl = import.meta.env.VITE_LANGFLOW_HOST_URL || "";
const windowTitle = import.meta.env.VITE_LANGFLOW_WINDOW_TITLE || "Portfolio Assistant";

export default function LangflowWidget() {
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const markReadyWhenDefined = async () => {
      try {
        await customElements.whenDefined("langflow-chat");
        if (!isCancelled) {
          setIsScriptReady(true);
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadError("Langflow widget failed to initialize.");
        }
      }
    };

    const existingScript = document.querySelector(
      `script[data-langflow-script="${langflowScriptSrc}"]`,
    );

    if (existingScript) {
      markReadyWhenDefined();
      return () => {
        isCancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = langflowScriptSrc;
    script.async = true;
    script.dataset.langflowScript = langflowScriptSrc;
    script.onload = () => {
      markReadyWhenDefined();
    };
    script.onerror = () => {
      setLoadError("Langflow script failed to load.");
    };

    document.body.appendChild(script);
    return () => {
      isCancelled = true;
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  if (!flowId || !hostUrl) {
    return (
      <aside className="langflow-fallback" aria-live="polite">
        <p className="langflow-fallback-title">Langflow pending</p>
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
            chat_position: "top-left",
            style: {
              position: "fixed",
              top: "auto",
              left: "auto",
              right: "max(12px, env(safe-area-inset-right))",
              bottom: "max(12px, env(safe-area-inset-bottom))",
              zIndex: 70,
              maxWidth: "calc(100vw - 20px)",
              maxHeight: "calc(100vh - 20px)",
            },
          })
        : (
          <aside className="langflow-fallback" aria-live="polite">
            <p className="langflow-fallback-title">Loading assistant</p>
            <p>Preparing the embedded Langflow widget.</p>
          </aside>
        )}
    </div>
  );
}
