import { useState, useEffect } from "react";
import { BellRing, CheckCircle2, XCircle, Info } from "lucide-react";
import { getMyNotifications } from "../services/api.js";
import EmptyState from "../components/EmptyState.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await getMyNotifications();
        setNotifications(data.items || []);
      } catch (err) {
        setError(err.message || "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">System alerts and passenger updates.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Loading notifications..." />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState 
            icon={BellRing}
            title="No notifications yet"
            description="Payment updates will appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((notif, i) => {
              const isSuccess = notif.event_type === "PaymentSucceeded" || notif.title?.toLowerCase().includes("confirmed");
              const isFail = notif.event_type === "PaymentFailed" || notif.title?.toLowerCase().includes("unsuccessful") || notif.title?.toLowerCase().includes("failed");
              
              const Icon = isSuccess ? CheckCircle2 : (isFail ? XCircle : Info);
              const iconColor = isSuccess ? "text-emerald-500" : (isFail ? "text-red-500" : "text-blue-500");
              const bgColor = notif.notification_status === "UNREAD" ? "bg-slate-50" : "bg-white";

              return (
                <li key={i} className={`p-4 hover:bg-slate-50 transition-colors ${bgColor}`}>
                  <div className="flex gap-4 items-start">
                    <div className={`mt-0.5 ${iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{notif.title}</p>
                      <p className="mt-1 text-sm text-slate-600 break-words">{notif.message}</p>
                      {notif.created_at && (
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
