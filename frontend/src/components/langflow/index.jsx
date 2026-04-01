import {
  Avatar,
  Badge,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Fab,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";

const apiUrl = import.meta.env.VITE_CHATBOT_API_URL || import.meta.env.VITE_API_URL || "";
const chatUserId = Number.parseInt(import.meta.env.VITE_CHATBOT_USER_ID || "1", 10);
const systemPrompt = import.meta.env.VITE_CHATBOT_SYSTEM_PROMPT || "你是专业投研助手。";
const widgetTitle = "PiggyBank AI Assistant";

function createMessage(role, content = "", images = [], graphOption = null) {
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  return { id: uid, role, content, images, graphOption };
}

function sanitizeAssistantText(input) {
  if (typeof input !== "string") return "";
  const withoutTaggedThinking = input
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think[\s\S]*$/gi, "")
    .replace(/<thinking[\s\S]*$/gi, "");

  const withoutThinkingLines = withoutTaggedThinking
    .split("\n")
    .filter((line) => !/^\s*(thinking|thought|思考|推理)\s*[:：]/i.test(line.trim()))
    .join("\n");

  return withoutThinkingLines.replace(/\n{3,}/g, "\n\n").trim();
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function AssistantChart({ option }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!option || typeof option !== "object" || Array.isArray(option)) return undefined;
    if (!chartRef.current) return undefined;

    const chart = echarts.init(chartRef.current);
    chart.setOption(option, true);
    // Ensure chart fits after bubble layout settles.
    const rafId = window.requestAnimationFrame(() => {
      chart.resize();
    });
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        chart.resize();
      });
      observer.observe(chartRef.current);
    }

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [option]);

  if (!option || typeof option !== "object" || Array.isArray(option)) return null;

  return (
    <Box
      ref={chartRef}
      sx={{
        width: "100%",
        height: { xs: 240, sm: 300 },
        mt: 1,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "background.default",
      }}
    />
  );
}

export default function LangflowWidget() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");

  const bodyRef = useRef(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, isOpen, isStreaming]);

  const envMissingText = useMemo(() => {
    if (!apiUrl) return "Missing `VITE_CHATBOT_API_URL` or `VITE_API_URL`.";
    if (Number.isNaN(chatUserId)) return "Invalid `VITE_CHATBOT_USER_ID`.";
    return "";
  }, []);
  const hasAnyChart = useMemo(
    () =>
      messages.some(
        (item) =>
          item?.graphOption &&
          typeof item.graphOption === "object" &&
          !Array.isArray(item.graphOption) &&
          Object.keys(item.graphOption).length > 0,
      ),
    [messages],
  );

  const sendMessage = async () => {
    const userText = draft.trim();
    if (!userText || isStreaming) return;

    if (envMissingText) {
      setError(envMissingText);
      return;
    }

    const userMessage = createMessage("user", userText);
    const assistantMessage = createMessage("assistant");

    setDraft("");
    setError("");
    setIsStreaming(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    let streamedText = "";
    let streamedImages = [];
    let streamedGraphOption = null;
    let streamBuffer = "";
    let streamError = "";

    const updateAssistant = () => {
      const cleanedText = sanitizeAssistantText(streamedText);
      const uniqueImages = Array.from(new Set(streamedImages));
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: cleanedText, images: uniqueImages, graphOption: streamedGraphOption }
            : item,
        ),
      );
    };

    const applyAnswerPayload = (payload) => {
      if (!payload || typeof payload !== "object") return false;
      if (typeof payload.text !== "string") return false;

      streamedText = payload.text;
      if (
        payload.containsGraph &&
        payload.graphOption &&
        typeof payload.graphOption === "object" &&
        Object.keys(payload.graphOption).length > 0
      ) {
        streamedGraphOption = payload.graphOption;
      } else {
        streamedGraphOption = null;
      }
      updateAssistant();
      return true;
    };

    const processPayloadText = (payloadText) => {
      if (!payloadText || payloadText === "[DONE]") return;
      const payload = parseJsonSafe(payloadText);
      if (payload && applyAnswerPayload(payload)) return;
      if (!payload && payloadText.trim()) {
        streamedText = payloadText.trim();
        updateAssistant();
      }
    };

    const processStreamEvent = (rawEventText) => {
      if (!rawEventText) return;
      const lines = rawEventText.split(/\r?\n/);
      let eventName = "";
      const dataLines = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      const payloadText = dataLines.join("\n").trim();

      if (!eventName) {
        const fallback = payloadText || rawEventText.trim();
        if (fallback) processPayloadText(fallback);
        return;
      }

      if (eventName === "answer_done") {
        processPayloadText(payloadText);
        return;
      }

      if (eventName === "answer_delta") {
        const payload = parseJsonSafe(payloadText);
        const delta =
          (payload && typeof payload === "object" && typeof payload.delta === "string" && payload.delta) ||
          payloadText;
        if (delta) {
          streamedText += delta;
          updateAssistant();
        }
        return;
      }

      if (eventName.endsWith("_error")) {
        const payload = parseJsonSafe(payloadText);
        const message =
          (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error) ||
          payloadText ||
          eventName;
        streamError = streamError ? `${streamError} | ${message}` : message;
        return;
      }
    };

    const handleStreamResponse = async (response) => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Streaming is not supported in this browser.");
      }

      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const events = streamBuffer.split(/\r?\n\r?\n/);
        streamBuffer = events.pop() ?? "";

        for (const eventText of events) {
          processStreamEvent(eventText);
        }
      }

      streamBuffer += decoder.decode();
      if (streamBuffer.trim()) {
        processStreamEvent(streamBuffer.trim());
      }
    };

    const handleNonstreamResponse = async (response) => {
      const rawText = await response.text();
      const trimmed = rawText.trim();
      if (!trimmed) return;

      // Some services may still return a single SSE-like block.
      if (trimmed.startsWith("data:")) {
        const events = trimmed.split(/\r?\n\r?\n/);
        for (const eventText of events) {
          if (eventText.trim()) processStreamEvent(eventText);
        }
        return;
      }

      processPayloadText(trimmed);
    };

    /* Generate AI Request Here! */
    try {
      const requestUrl = apiUrl.endsWith("/chat") ? apiUrl : `${apiUrl.replace(/\/+$/, "")}/chat`;
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          prompt: userText,
          user_id: chatUserId,
          system: systemPrompt.trim(),
        }),
      });

      if (!response.ok) {
        const failureText = await response.text();
        throw new Error(failureText || `Request failed with status ${response.status}`);
      }

      const responseType = response.headers.get("content-type") || "";
      const isStreamResponse =
        responseType.includes("text/event-stream") || responseType.includes("application/x-ndjson");

      if (isStreamResponse) {
        await handleStreamResponse(response);
      } else {
        await handleNonstreamResponse(response);
      }

      if (!streamedText && streamedImages.length === 0) {
        streamedText = "I received your message, but the response body was empty.";
      }

      if (streamError) {
        setError(`Assistant request failed: ${streamError}`);
      }
      updateAssistant();
    } catch (requestError) {
      let apiErrorText = requestError?.message || "Request failed.";
      if (typeof apiErrorText === "string") {
        try {
          const parsedError = JSON.parse(apiErrorText);
          apiErrorText =
            parsedError?.base_resp?.status_msg ||
            parsedError?.error?.message ||
            parsedError?.detail ||
            parsedError?.message ||
            apiErrorText;
        } catch {
          apiErrorText = requestError?.message || "Request failed.";
        }
      }

      setError(`Assistant request failed: ${apiErrorText}`);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: "I could not generate a response this time.", images: [], graphOption: null }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <Box sx={{ position: "fixed", right: { xs: 12, sm: 20 }, bottom: { xs: 12, sm: 20 }, zIndex: 90 }}>
      <Tooltip title={isOpen ? "Close Assistant" : "Open Assistant"}>
        <Fab color="primary" variant="extended" onClick={() => setIsOpen((prev) => !prev)}>
          {isOpen ? <CloseRoundedIcon sx={{ mr: 1 }} /> : <ForumRoundedIcon sx={{ mr: 1 }} />}
          {isOpen ? "Close" : "PiggyBank AI"}
        </Fab>
      </Tooltip>

      {isOpen && (
        <Paper
          elevation={18}
          sx={{
            width: { xs: "calc(100vw - 24px)", sm: hasAnyChart ? 640 : 420 },
            height: { xs: "min(74vh, 640px)", sm: 620 },
            mt: 1.5,
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              background: "linear-gradient(120deg, rgba(25,118,210,0.16), rgba(14,165,233,0.06))",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Avatar sx={{ bgcolor: "primary.main", width: 34, height: 34 }}>
                <SmartToyRoundedIcon fontSize="small" />
              </Avatar>
              <Box>
                <Typography fontWeight={800} sx={{ letterSpacing: 0.2 }}>
                  {widgetTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isStreaming ? "Streaming response..." : "Professional portfolio copilot"}
                </Typography>
              </Box>
              <Box sx={{ ml: "auto" }}>
                <Chip
                  size="small"
                  color={isStreaming ? "warning" : "success"}
                  label={isStreaming ? "Typing" : "Online"}
                  variant="outlined"
                />
              </Box>
            </Stack>
          </Box>
          <Divider />

          <Box
            ref={bodyRef}
            sx={{
              overflowY: "auto",
              px: 1.5,
              py: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
              bgcolor: "background.default",
            }}
          >
            {messages.length === 0 && (
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, bgcolor: "background.paper" }}>
                <Typography variant="body2" color="text.secondary">
                  Ask anything about portfolio analysis, watchlist events, or risk insights.
                </Typography>
              </Paper>
            )}

            {messages.map((item) => {
              const isUser = item.role === "user";
              const hasGraph =
                !isUser &&
                item.graphOption &&
                typeof item.graphOption === "object" &&
                !Array.isArray(item.graphOption) &&
                Object.keys(item.graphOption).length > 0;
              return (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1}
                  justifyContent={isUser ? "flex-end" : "flex-start"}
                  sx={{ width: "100%" }}
                >
                  {!isUser && (
                    <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main", mt: 0.5 }}>
                      <SmartToyRoundedIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                  )}

                  <Paper
                    elevation={0}
                    sx={{
                      px: 1.25,
                      py: 1,
                      width: hasGraph ? "auto" : undefined,
                      flex: hasGraph ? 1 : "0 1 auto",
                      maxWidth: hasGraph ? "none" : "84%",
                      minWidth: 0,
                      borderRadius: 2.25,
                      border: "1px solid",
                      borderColor: isUser ? "primary.main" : "divider",
                      bgcolor: isUser ? "primary.main" : "background.paper",
                      color: isUser ? "primary.contrastText" : "text.primary",
                      overflow: "visible",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: "pre-wrap", lineHeight: 1.55, wordBreak: "break-word" }}
                    >
                      {item.content || (item.role === "assistant" ? "..." : "")}
                    </Typography>

                    {item.images?.length > 0 && (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        {item.images.map((imageUrl) => (
                          <Box
                            key={`${item.id}-${imageUrl}`}
                            component="img"
                            src={imageUrl}
                            alt="assistant response"
                            loading="lazy"
                            sx={{
                              width: "100%",
                              borderRadius: 1.5,
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          />
                        ))}
                      </Stack>
                    )}

                    {!isUser && <AssistantChart option={item.graphOption} />}
                  </Paper>

                  {isUser && (
                    <Avatar sx={{ width: 28, height: 28, bgcolor: "grey.700", mt: 0.5 }}>
                      <PersonRoundedIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                  )}
                </Stack>
              );
            })}
          </Box>

          <Divider />
          <Box sx={{ p: 1.25 }}>
            {!!error && (
              <Typography variant="caption" color="error.main" sx={{ display: "block", mb: 1 }}>
                {error}
              </Typography>
            )}
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                minRows={isMobile ? 2 : 2}
                maxRows={6}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="你可以输入任何东西..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                size="small"
              />
              <Badge color="warning" variant="dot" invisible={!isStreaming}>
                <IconButton
                  color="primary"
                  onClick={sendMessage}
                  disabled={isStreaming || !draft.trim()}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    width: 40,
                    height: 40,
                  }}
                >
                  {isStreaming ? <CircularProgress size={18} /> : <SendRoundedIcon />}
                </IconButton>
              </Badge>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" icon={<ImageRoundedIcon />} label="Image output enabled" variant="outlined" />
              <Chip size="small" label="Gemini backend" variant="outlined" />
            </Stack>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
