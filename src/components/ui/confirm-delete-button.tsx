"use client";

import { useFormStatus } from "react-dom";

function Inner({ label, message }: { label: string; message: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="label-mono px-1 py-0.5 transition hover:text-red-600 hover:underline disabled:cursor-not-allowed"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function ConfirmDeleteButton({
  label = "Delete",
  message = "Are you sure? This cannot be undone.",
}: {
  label?: string;
  message?: string;
}) {
  return <Inner label={label} message={message} />;
}
