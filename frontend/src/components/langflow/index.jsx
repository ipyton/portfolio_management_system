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

const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_MINIMAX_API_URL || "";
const apiKey = import.meta.env.VITE_MINIMAX_API_KEY || "";
const modelName = import.meta.env.VITE_MINIMAX_MODEL || "MiniMax-M2.5";
const systemPrompt = import.meta.env.VITE_MINIMAX_SYSTEM_PROMPT || "";
const widgetTitle = "PiggyBank AI Assistant";

// Define the number historical chatting messages should be considered.
const OFFSET = 1;

function createMessage(role, content = "", images = []) {
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  return { id: uid, role, content, images };
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

function parseContent(content) {
  const images = [];
  let text = "";

  const pushImage = (candidate) => {
    if (typeof candidate !== "string") return;
    const value = candidate.trim();
    if (!value) return;
    images.push(value);
  };

  const pushText = (candidate) => {
    if (typeof candidate === "string") text += candidate;
  };

  const handleNode = (item) => {
    if (typeof item === "string") {
      pushText(item);
      return;
    }
    if (!item || typeof item !== "object") return;

    if (item.type === "image_url") {
      pushImage(item.image_url?.url || item.image_url || item.url);
      return;
    }
    if (item.type === "image") {
      pushImage(item.url || item.image_url?.url || item.image_url);
      return;
    }
    if (typeof item.text === "string") {
      pushText(item.text);
      return;
    }
    if (typeof item.content === "string") {
      pushText(item.content);
      return;
    }
    if (item.image_url) {
      pushImage(item.image_url?.url || item.image_url);
    }
  };

  if (Array.isArray(content)) {
    content.forEach(handleNode);
  } else if (typeof content === "string") {
    pushText(content);
  } else if (content && typeof content === "object") {
    handleNode(content);
  }

  return { text, images };
}

function extractAssistantDelta(payload) {
  if (!payload || typeof payload !== "object") {
    return { text: "", images: [], statusCode: null, statusMsg: "" };
  }

  const statusCode = payload?.base_resp?.status_code ?? null;
  const statusMsg = payload?.base_resp?.status_msg || "";

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const deltaContent = parseContent(choice?.delta?.content);
  if (deltaContent.text || deltaContent.images.length > 0) {
    return { ...deltaContent, statusCode, statusMsg };
  }

  const messageContent = parseContent(choice?.message?.content);
  if (messageContent.text || messageContent.images.length > 0) {
    return { ...messageContent, statusCode, statusMsg };
  }

  return { ...parseContent(payload?.output_text || payload?.text || ""), statusCode, statusMsg };
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
    if (!apiUrl) return "Missing `VITE_API_URL` or `VITE_MINIMAX_API_URL`.";
    if (!apiKey) return "Missing `VITE_MINIMAX_API_KEY`.";
    return "";
  }, []);

  const sendMessage = async () => {
    const userText = draft.trim();
    if (!userText || isStreaming) return;

    if (envMissingText) {
      setError(envMissingText);
      return;
    }

    const userMessage = createMessage("user", userText);
    const assistantMessage = createMessage("assistant");
    const chatHistory = [...messages, userMessage];
    const recentTwoMessages = chatHistory.slice(-OFFSET);
    const requestMessages = recentTwoMessages.map((item) => ({
      role: item.role,
      content: item.content,
    }));

    if (systemPrompt.trim()) {
      requestMessages.unshift({ role: "system", content: systemPrompt.trim() });
    }

    setDraft("");
    setError("");
    setIsStreaming(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    let streamedText = "";
    let streamedImages = [];
    let streamBuffer = "";

    const updateAssistant = () => {
      const cleanedText = sanitizeAssistantText(streamedText);
      const uniqueImages = Array.from(new Set(streamedImages));
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id ? { ...item, content: cleanedText, images: uniqueImages } : item,
        ),
      );
    };

    const processPayloadText = (payloadText) => {
      if (!payloadText || payloadText === "[DONE]") return;

      let payload;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        return;
      }

      const delta = extractAssistantDelta(payload);
      if (delta.statusCode && delta.statusCode !== 0) {
        throw new Error(delta.statusMsg || "MiniMax service is busy. Please retry.");
      }

      if (delta.text) streamedText += delta.text;
      if (delta.images.length > 0) streamedImages = [...streamedImages, ...delta.images];
      updateAssistant();
    };

    const processStreamEvent = (rawEventText) => {
      if (!rawEventText) return;
      const lines = rawEventText.split(/\r?\n/);
      const dataLines = lines
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) {
        const fallback = rawEventText.trim();
        if (fallback) processPayloadText(fallback);
        return;
      }

      for (const line of dataLines) {
        processPayloadText(line);
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
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: modelName,
          messages: requestMessages,
          temperature: 0.1,
          stream: true,
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

      updateAssistant();
    } catch (requestError) {
      let apiErrorText = requestError?.message || "Request failed.";
      if (typeof apiErrorText === "string") {
        try {
          const parsedError = JSON.parse(apiErrorText);
          apiErrorText =
            parsedError?.base_resp?.status_msg ||
            parsedError?.error?.message ||
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
            ? { ...item, content: "I could not generate a response this time.", images: [] }
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
            width: { xs: "calc(100vw - 24px)", sm: 420 },
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
              return (
                <Stack key={item.id} direction="row" spacing={1} justifyContent={isUser ? "flex-end" : "flex-start"}>
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
                      maxWidth: "84%",
                      borderRadius: 2.25,
                      border: "1px solid",
                      borderColor: isUser ? "primary.main" : "divider",
                      bgcolor: isUser ? "primary.main" : "background.paper",
                      color: isUser ? "primary.contrastText" : "text.primary",
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
              <Chip size="small" label="Temp 0.1" variant="outlined" />
            </Stack>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
