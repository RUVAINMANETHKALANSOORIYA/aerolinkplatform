/**
 * components/EmptyState.jsx
 * Shown when a list is empty or a feature is pending.
 */
import { PackageOpen } from "lucide-react";

export default function EmptyState({ icon: Icon = PackageOpen, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-slate-100 p-4 mb-4">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm">{description}</p>}
    </div>
  );
}
