import { useEffect, useMemo, useRef, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export default function ChatRoom() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting");
  const [attempt, setAttempt] = useState(0);
  const wsRef = useRef(null);
  const listRef = useRef(null);
  const textRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const manualCloseRef = useRef(false);

  const wsUrl = useMemo(() => {
    let base = BACKEND_URL.replace(/\/$/, "");
    if (!base) {
      base = window.location.origin.replace(/^http/, "ws");
    } else {
      base = base.replace(/^http/, "ws");
    }
    return `${base}/ws`;
  }, []);

  const connect = () => {
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setAttempt(0);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data && (data.type === "message" || data.type === "system")) {
            setMessages((prev) => [...prev, data]);
          }
        } catch {}
      };

      ws.onerror = () => {
        setStatus("error");
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (manualCloseRef.current) return; // don't auto-reconnect on intentional unmount
        setStatus("disconnected");
        // exponential backoff with jitter: 0.5s, 1s, 2s, 4s, 8s (max 10s)
        setAttempt((prev) => {
          const next = prev + 1;
          const baseDelay = Math.min(10000, 500 * Math.pow(2, prev));
          const jitter = Math.random() * 300;
          const delay = Math.max(300, baseDelay + jitter);
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = setTimeout(connect, delay);
          return next;
        });
      };
    } catch (e) {
      // fallback schedule
      setStatus("error");
      const delay = 1000;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(connect, delay);
    }
  };

  useEffect(() => {
    manualCloseRef.current = false;
    setStatus("connecting");
    connect();

    return () => {
      manualCloseRef.current = true;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const resizeTextarea = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 160; // about 6-8 lines visually, not a strict limit on content
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  };

  useEffect(() => {
    resizeTextarea();
  }, [input]);

  const send = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "message", text }));
    setInput("");
    // resize will run via effect
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const statusColor = {
    connecting: "text-yellow-400",
    connected: "text-emerald-400",
    disconnected: "text-rose-400",
    error: "text-red-500",
  }[status];

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-900 text-slate-100 p-4">
      <div className="w-full max-w-3xl flex-1 flex flex-col rounded-2xl border border-slate-700 bg-slate-800/60 backdrop-blur shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Anonymous Chat</h1>
          <div className="flex items-center gap-2 text-xs">
            {attempt > 0 && status !== "connected" && (
              <span className="text-slate-400">reconnecting… (try {attempt})</span>
            )}
            <span className={`font-mono ${statusColor}`}>• {status}</span>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 p-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 text-sm">
              Be the first to say something. No accounts, no names — just words.
            </div>
          )}
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={
                m.type === "system"
                  ? "text-xs text-slate-400 text-center"
                  : "max-w-[80%] rounded-xl px-4 py-2 bg-blue-500/10 border border-blue-400/20"
              }
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textRef}
              className="flex-1 resize-none rounded-xl bg-slate-900/60 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/40 leading-relaxed"
              placeholder="Type your message… Enter to send · Shift+Enter for new line"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              spellCheck={false}
            />
            <button
              onClick={send}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            No names. No phone numbers. Everyone shares one room. Keep it kind.
          </p>
        </div>
      </div>
    </div>
  );
}
