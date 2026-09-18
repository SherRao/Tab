"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`disabled:cursor-not-allowed ${className}`.trim()}
    >
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
