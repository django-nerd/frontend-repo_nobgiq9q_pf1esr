import { useEffect, useMemo, useRef, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export default function ChatRoom() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting");
  const wsRef = useRef(null);
  const listRef = useRef(null);

  const wsUrl = useMemo(() => {
    // convert http(s) backend to ws(s)
    let base = BACKEND_URL.replace(/\/$/, "");
    if (!base) {
      // Fallback to current origin with /ws-api proxy if backend env not set
      base = window.location.origin.replace(/^http/, "ws");
    } else {
      base = base.replace(/^http/, "ws");
    }
    return `${base}/ws`;
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data && (data.type === "message" || data.type === "system")) {
          setMessages((prev) => [...prev, data]);
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  useEffect(() => {
    // auto scroll
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "message", text }));
    setInput("");
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
          <div className={`text-xs font-mono ${statusColor}`}>• {status}</div>
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
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl bg-slate-900/60 border border-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="Say something with a single line..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
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
