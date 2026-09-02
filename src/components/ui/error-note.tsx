const VARIANT_CLASSES = {
  page: "mt-6 border-l-4 border-l-red-400 bg-red-50 px-4 py-2 font-mono text-xs text-red-700",
  form: "border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700",
} as const;

export function ErrorNote({
  variant,
  children,
  className = "",
}: {
  variant: keyof typeof VARIANT_CLASSES;
  children: React.ReactNode;
  className?: string;
}) {
  if (variant === "page") {
    return (
      <div className={`${VARIANT_CLASSES.page} ${className}`.trim()}>! {children}</div>
    );
  }
  return <p className={`${VARIANT_CLASSES.form} ${className}`.trim()}>{children}</p>;
}
