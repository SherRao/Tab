"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReceipt, type ReceiptDraft } from "@/lib/receipt-parse";
import { preprocessReceiptImage } from "@/lib/image-preprocess";

export type ScanOutcome =
  | { status: "success"; draft: ReceiptDraft }
  | { status: "unusable"; draft: ReceiptDraft }
  | { status: "error" };

export default function ScanReceipt({
  onDone,
  onCancel,
}: {
  onDone: (outcome: ScanOutcome) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "recognizing">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const revokeUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setPreviewUrl(null);
    }
  }, []);

  useEffect(() => revokeUrl, [revokeUrl]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setProgress(0);
      revokeUrl();
      urlRef.current = URL.createObjectURL(file);
      setPreviewUrl(urlRef.current);

      let dataUrl: string;
      try {
        setPhase("preparing");
        dataUrl = await preprocessReceiptImage(file);
      } catch {
        setPhase("idle");
        setError("Could not read that image. Try another photo.");
        return;
      }

      try {
        setPhase("recognizing");
        const Tesseract = await import("tesseract.js");
        const worker = await Tesseract.createWorker("eng", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });
        try {
          const { data } = await worker.recognize(dataUrl);
          const draft = parseReceipt(data.text);
          onDone(draft.usable ? { status: "success", draft } : { status: "unusable", draft });
        } finally {
          await worker.terminate();
        }
      } catch {
        setPhase("idle");
        setError("Scanning failed. You can re-scan or enter the expense manually.");
      }
    },
    [onDone, revokeUrl],
  );

  const busy = phase !== "idle";

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
      <h2 className="font-semibold">Scan receipt</h2>
      <p className="mt-1 text-sm text-stone-500">
        Take a photo of the receipt — everything stays on your device.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Receipt preview"
          className="mx-auto mt-4 max-h-48 rounded-lg border border-stone-200 object-contain"
        />
      )}

      {busy && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${phase === "preparing" ? 5 : Math.max(progress, 5)}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-stone-500">
            {phase === "preparing"
              ? "Preparing scanner…"
              : `Reading receipt… ${progress}%`}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? "Scanning…" : previewUrl ? "Re-scan" : "Take / choose photo"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            revokeUrl();
            onCancel();
          }}
          className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 disabled:opacity-40"
        >
          Enter manually
        </button>
      </div>
    </div>
  );
}
