import React, { useEffect, useState } from "react";
import type { ToastEventDetail, ToastKind } from "../services/toast";

type ToastItem = ToastEventDetail & { id: string; createdAt: number };

const EVENT_NAME = "acemock:toast";

function cls(kind: ToastKind) {
  if (kind === "success") return "bg-emerald-600";
  if (kind === "error") return "bg-red-600";
  return "bg-slate-900";
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (ev: Event) => {
      const e = ev as CustomEvent<ToastEventDetail>;
      const detail = e.detail;
      if (!detail?.message) return;

      const item: ToastItem = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: Date.now(),
        kind: detail.kind ?? "info",
        message: detail.message,
        durationMs: detail.durationMs ?? 3500,
      };

      setItems((prev) => [item, ...prev].slice(0, 3));

      const t = window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }, item.durationMs);

      return () => window.clearTimeout(t);
    };

    window.addEventListener(EVENT_NAME, onToast as any);
    return () => window.removeEventListener(EVENT_NAME, onToast as any);
  }, []);

  if (!items.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-3 w-[340px] max-w-[calc(100vw-2rem)]">
      {items.map((t) => (
        <div
          key={t.id}
          className={`${cls(t.kind)} text-white rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3`}
        >
          <div className="flex-1">
            <div className="text-[11px] font-black uppercase tracking-widest opacity-90">
              {t.kind}
            </div>
            <div className="text-sm font-semibold leading-snug">{t.message}</div>
          </div>
          <button
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-white/80 hover:text-white font-black px-2"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

