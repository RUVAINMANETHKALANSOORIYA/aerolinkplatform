/**
 * components/StatusBadge.jsx
 * Colour-coded status pill for flight / booking / baggage statuses.
 */
const variants = {
  // Booking / payment statuses
  CONFIRMED:       "bg-emerald-100 text-emerald-800",
  PENDING_PAYMENT: "bg-amber-100  text-amber-800",
  PAYMENT_FAILED:  "bg-red-100    text-red-800",
  CANCELLED:       "bg-slate-100  text-slate-600",

  // Health statuses
  ok:    "bg-emerald-100 text-emerald-800",
  error: "bg-red-100    text-red-800",
  UNREAD:"bg-blue-100   text-blue-800",
  READ:  "bg-slate-100  text-slate-600",

  // Generic
  success:"bg-emerald-100 text-emerald-800",
  warning:"bg-amber-100  text-amber-800",
  danger: "bg-red-100    text-red-800",
  info:   "bg-blue-100   text-blue-800",
};

export default function StatusBadge({ status, label }) {
  const display = label ?? status;
  const cls = variants[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {display}
    </span>
  );
}
