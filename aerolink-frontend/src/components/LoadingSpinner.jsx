/**
 * components/LoadingSpinner.jsx
 * Accessible spinner for async actions.
 */
export default function LoadingSpinner({ size = "md", label = "Loading…" }) {
  const sizeClass = size === "sm" ? "h-4 w-4 border-2" : size === "lg" ? "h-10 w-10 border-4" : "h-6 w-6 border-2";
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-label={label}>
      <span
        className={`${sizeClass} animate-spin rounded-full border-blue-600 border-t-transparent`}
      />
      {size !== "sm" && <span className="text-sm text-slate-500">{label}</span>}
    </span>
  );
}
