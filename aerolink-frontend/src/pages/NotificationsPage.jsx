import { BellRing } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">System alerts and passenger updates.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <EmptyState 
          icon={BellRing}
          title="Notifications are being connected"
          description="Payment notification events are already processed securely in the backend. Display access will be enabled after the notification service API is deployed."
        />
      </div>
    </div>
  );
}
