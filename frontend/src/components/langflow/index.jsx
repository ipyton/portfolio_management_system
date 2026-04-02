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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mapMaybeArray(value, mapper) {
  if (Array.isArray(value)) {
    return value.map((item) => mapper(item));
  }
  return mapper(value);
}

function buildChartPalette(isDarkMode) {
  if (isDarkMode) {
    return {
      text: "#eaf0ff",
      muted: "#a6b2cd",
      axisLine: "rgba(140, 158, 194, 0.62)",
      splitLine: "rgba(121, 168, 255, 0.22)",
      tooltipBg: "rgba(10, 13, 20, 0.96)",
      tooltipBorder: "rgba(121, 168, 255, 0.34)",
      series: ["#79a8ff", "#7bd88f", "#38bdf8", "#f59e0b", "#fb7185", "#c084fc", "#22d3ee"],
    };
  }

  return {
    text: "#1f2937",
    muted: "#4b5563",
    axisLine: "rgba(107, 114, 128, 0.55)",
    splitLine: "rgba(148, 163, 184, 0.28)",
    tooltipBg: "rgba(255, 255, 255, 0.97)",
    tooltipBorder: "rgba(148, 163, 184, 0.4)",
    series: ["#4f7bff", "#16a34a", "#0284c7", "#d97706", "#e11d48", "#7c3aed", "#0f766e"],
  };
}

function parseColorToken(colorToken) {
  if (typeof colorToken !== "string") return null;
  const token = colorToken.trim().toLowerCase();
  if (!token) return null;
  if (token === "black") {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  const hexMatch = token.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(`${hex[0]}${hex[0]}`, 16);
      const g = Number.parseInt(`${hex[1]}${hex[1]}`, 16);
      const b = Number.parseInt(`${hex[2]}${hex[2]}`, 16);
      const a = hex.length === 4 ? Number.parseInt(`${hex[3]}${hex[3]}`, 16) / 255 : 1;
      return { r, g, b, a };
    }
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  const rgbMatch = token.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    if (parts.length < 3) return null;
    const r = Number.parseFloat(parts[0]);
    const g = Number.parseFloat(parts[1]);
    const b = Number.parseFloat(parts[2]);
    const a = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
    if (![r, g, b, a].every(Number.isFinite)) return null;
    return { r, g, b, a };
  }

  return null;
}

function isTooDarkColor(colorToken) {
  const parsed = parseColorToken(colorToken);
  if (!parsed) return false;
  if (parsed.a <= 0.05) return false;
  const luminance = 0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b;
  return luminance < 70;
}

function pickReadableColor(rawColor, fallbackColor, isDarkMode) {
  if (!isDarkMode) return rawColor;
  if (typeof rawColor !== "string" || !rawColor.trim()) return fallbackColor;
  return isTooDarkColor(rawColor) ? fallbackColor : rawColor;
}

function applyColorListTheme(colors, palette, isDarkMode) {
  if (!Array.isArray(colors) || colors.length === 0) {
    return palette.series;
  }
  return colors.map((item, index) =>
    pickReadableColor(item, palette.series[index % palette.series.length], isDarkMode),
  );
}

function applyAxisTheme(axisOption, palette) {
  return mapMaybeArray(axisOption, (axisItem) => {
    if (!isPlainObject(axisItem)) return axisItem;

    const axisLine = isPlainObject(axisItem.axisLine) ? axisItem.axisLine : {};
    const axisTick = isPlainObject(axisItem.axisTick) ? axisItem.axisTick : {};
    const splitLine = isPlainObject(axisItem.splitLine) ? axisItem.splitLine : {};

    return {
      ...axisItem,
      axisLabel: {
        ...(isPlainObject(axisItem.axisLabel) ? axisItem.axisLabel : {}),
        color: palette.muted,
      },
      nameTextStyle: {
        ...(isPlainObject(axisItem.nameTextStyle) ? axisItem.nameTextStyle : {}),
        color: palette.text,
      },
      axisLine: {
        ...axisLine,
        lineStyle: {
          ...(isPlainObject(axisLine.lineStyle) ? axisLine.lineStyle : {}),
          color: palette.axisLine,
        },
      },
      axisTick: {
        ...axisTick,
        lineStyle: {
          ...(isPlainObject(axisTick.lineStyle) ? axisTick.lineStyle : {}),
          color: palette.axisLine,
        },
      },
      splitLine: {
        ...splitLine,
        lineStyle: {
          ...(isPlainObject(splitLine.lineStyle) ? splitLine.lineStyle : {}),
          color: palette.splitLine,
        },
      },
    };
  });
}

function applyLegendTheme(legendOption, palette) {
  return mapMaybeArray(legendOption, (legendItem) => {
    if (!isPlainObject(legendItem)) return legendItem;
    return {
      ...legendItem,
      textStyle: {
        ...(isPlainObject(legendItem.textStyle) ? legendItem.textStyle : {}),
        color: palette.text,
      },
      inactiveColor: palette.muted,
    };
  });
}

function applyTitleTheme(titleOption, palette) {
  return mapMaybeArray(titleOption, (titleItem) => {
    if (!isPlainObject(titleItem)) return titleItem;
    return {
      ...titleItem,
      textStyle: {
        ...(isPlainObject(titleItem.textStyle) ? titleItem.textStyle : {}),
        color: palette.text,
      },
      subtextStyle: {
        ...(isPlainObject(titleItem.subtextStyle) ? titleItem.subtextStyle : {}),
        color: palette.muted,
      },
    };
  });
}

function applySeriesDataTheme(dataOption, palette, isDarkMode, seriesIndex) {
  if (!Array.isArray(dataOption)) return dataOption;
  return dataOption.map((dataItem, dataIndex) => {
    if (!isPlainObject(dataItem)) return dataItem;
    const fallbackColor = palette.series[(seriesIndex + dataIndex) % palette.series.length];
    const itemStyle = isPlainObject(dataItem.itemStyle) ? dataItem.itemStyle : {};
    const label = isPlainObject(dataItem.label) ? dataItem.label : {};
    return {
      ...dataItem,
      color: pickReadableColor(dataItem.color, fallbackColor, isDarkMode),
      itemStyle: {
        ...itemStyle,
        color: pickReadableColor(itemStyle.color, fallbackColor, isDarkMode),
        borderColor: pickReadableColor(itemStyle.borderColor, fallbackColor, isDarkMode),
      },
      label: {
        ...label,
        color: palette.text,
      },
    };
  });
}

function applySeriesTheme(seriesOption, palette, isDarkMode) {
  if (!Array.isArray(seriesOption)) return seriesOption;
  return seriesOption.map((seriesItem, seriesIndex) => {
    if (!isPlainObject(seriesItem)) return seriesItem;

    const label = isPlainObject(seriesItem.label) ? seriesItem.label : {};
    const labelLine = isPlainObject(seriesItem.labelLine) ? seriesItem.labelLine : {};
    const lineStyle = isPlainObject(seriesItem.lineStyle) ? seriesItem.lineStyle : {};
    const itemStyle = isPlainObject(seriesItem.itemStyle) ? seriesItem.itemStyle : {};
    const areaStyle = isPlainObject(seriesItem.areaStyle) ? seriesItem.areaStyle : {};
    const fallbackColor = palette.series[seriesIndex % palette.series.length];

    return {
      ...seriesItem,
      color: pickReadableColor(seriesItem.color, fallbackColor, isDarkMode),
      label: {
        ...label,
        color: palette.text,
      },
      labelLine: {
        ...labelLine,
        lineStyle: {
          ...(isPlainObject(labelLine.lineStyle) ? labelLine.lineStyle : {}),
          color: palette.axisLine,
        },
      },
      lineStyle: {
        ...lineStyle,
        color: pickReadableColor(lineStyle.color, fallbackColor, isDarkMode),
      },
      itemStyle: {
        ...itemStyle,
        color: pickReadableColor(itemStyle.color, fallbackColor, isDarkMode),
        borderColor: pickReadableColor(itemStyle.borderColor, fallbackColor, isDarkMode),
      },
      areaStyle: {
        ...areaStyle,
        color: pickReadableColor(areaStyle.color, fallbackColor, isDarkMode),
      },
      data: applySeriesDataTheme(seriesItem.data, palette, isDarkMode, seriesIndex),
    };
  });
}

function applyVisualMapTheme(visualMapOption, palette) {
  return mapMaybeArray(visualMapOption, (visualMapItem) => {
    if (!isPlainObject(visualMapItem)) return visualMapItem;
    return {
      ...visualMapItem,
      textStyle: {
        ...(isPlainObject(visualMapItem.textStyle) ? visualMapItem.textStyle : {}),
        color: palette.text,
      },
    };
  });
}

function createThemedChartOption(option, isDarkMode) {
  if (!isPlainObject(option)) return option;

  const palette = buildChartPalette(isDarkMode);
  const tooltip = isPlainObject(option.tooltip) ? option.tooltip : {};
  const axisPointer = isPlainObject(tooltip.axisPointer) ? tooltip.axisPointer : {};
  const pointerLabel = isPlainObject(axisPointer.label) ? axisPointer.label : {};
  const radar = isPlainObject(option.radar) ? option.radar : {};

  return {
    ...option,
    darkMode: isDarkMode,
    backgroundColor: "transparent",
    color: applyColorListTheme(option.color, palette, isDarkMode),
    textStyle: {
      ...(isPlainObject(option.textStyle) ? option.textStyle : {}),
      color: palette.text,
    },
    title: applyTitleTheme(option.title, palette),
    legend: applyLegendTheme(option.legend, palette),
    xAxis: applyAxisTheme(option.xAxis, palette),
    yAxis: applyAxisTheme(option.yAxis, palette),
    angleAxis: applyAxisTheme(option.angleAxis, palette),
    radiusAxis: applyAxisTheme(option.radiusAxis, palette),
    visualMap: applyVisualMapTheme(option.visualMap, palette),
    radar: isPlainObject(option.radar)
      ? {
          ...radar,
          axisName: {
            ...(isPlainObject(radar.axisName) ? radar.axisName : {}),
            color: palette.text,
          },
          splitLine: {
            ...(isPlainObject(radar.splitLine) ? radar.splitLine : {}),
            lineStyle: {
              ...(isPlainObject(radar.splitLine?.lineStyle) ? radar.splitLine.lineStyle : {}),
              color: palette.splitLine,
            },
          },
        }
      : option.radar,
    tooltip: {
      ...tooltip,
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: {
        ...(isPlainObject(tooltip.textStyle) ? tooltip.textStyle : {}),
        color: palette.text,
      },
      axisPointer: {
        ...axisPointer,
        lineStyle: {
          ...(isPlainObject(axisPointer.lineStyle) ? axisPointer.lineStyle : {}),
          color: palette.axisLine,
        },
        label: {
          ...pointerLabel,
          color: palette.text,
          backgroundColor: palette.tooltipBg,
        },
      },
    },
    series: applySeriesTheme(option.series, palette, isDarkMode),
  };
}

function isCandlestickOption(option) {
  if (!isPlainObject(option)) return false;
  const series = Array.isArray(option.series)
    ? option.series
    : isPlainObject(option.series)
      ? [option.series]
      : [];
  return series.some((item) => {
    if (!isPlainObject(item)) return false;
    const type = String(item.type || "").toLowerCase();
    return type === "candlestick" || type === "kline" || type === "k";
  });
}

function AssistantChart({ option, isDarkMode }) {
  const chartRef = useRef(null);
  const themedOption = useMemo(
    () => createThemedChartOption(option, isDarkMode),
    [option, isDarkMode],
  );
  const isCandlestick = useMemo(() => isCandlestickOption(themedOption), [themedOption]);

  useEffect(() => {
    if (!themedOption || typeof themedOption !== "object" || Array.isArray(themedOption)) {
      return undefined;
    }
    if (!chartRef.current) return undefined;

    const chart = echarts.init(chartRef.current);
    chart.setOption(themedOption, true);
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
  }, [themedOption]);

  if (!themedOption || typeof themedOption !== "object" || Array.isArray(themedOption)) return null;

  return (
    <Box
      ref={chartRef}
      sx={{
        width: "100%",
        height: isCandlestick ? { xs: 300, sm: 420 } : { xs: 240, sm: 300 },
        mt: 1,
        border: "1px solid",
        borderColor: isDarkMode ? "rgba(121, 168, 255, 0.3)" : "divider",
        borderRadius: 1.5,
        bgcolor: isDarkMode ? "rgba(10, 13, 20, 0.92)" : "background.default",
      }}
    />
  );
}

export default function LangflowWidget({ themeMode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDarkMode = themeMode ? themeMode !== "light" : true;

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
  const hasAnyCandlestick = useMemo(
    () =>
      messages.some(
        (item) =>
          item?.graphOption &&
          typeof item.graphOption === "object" &&
          !Array.isArray(item.graphOption) &&
          Object.keys(item.graphOption).length > 0 &&
          isCandlestickOption(item.graphOption),
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
            width: {
              xs: "calc(100vw - 24px)",
              sm: hasAnyCandlestick ? 860 : hasAnyChart ? 680 : 420,
            },
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

                    {!isUser && <AssistantChart option={item.graphOption} isDarkMode={isDarkMode} />}
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
                placeholder="Could input anything here."
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
          </Box>
        </Paper>
      )}
    </Box>
  );
}
