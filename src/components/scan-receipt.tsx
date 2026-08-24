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
    <div className="receipt-card receipt-edge">
      <div className="receipt-lined p-6 pb-8">
        <h2 className="text-lg font-semibold tracking-tight">Scan a receipt</h2>
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
            className="mx-auto mt-4 max-h-48 border border-stone-200 object-contain"
          />
        )}

        {busy && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden bg-stone-200/70">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${phase === "preparing" ? 5 : Math.max(progress, 5)}%` }}
              />
            </div>
            <p className="label-mono mt-2 text-center text-stone-500">
              {phase === "preparing"
                ? "Preparing scanner…"
                : `Reading receipt… ${progress}%`}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 border-l-4 border-l-amber-400 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-800">
            ! {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="btn-ink flex-1 disabled:cursor-not-allowed"
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
            className="btn-ghost"
          >
            Enter manually
          </button>
        </div>
      </div>
    </div>
  );
}
