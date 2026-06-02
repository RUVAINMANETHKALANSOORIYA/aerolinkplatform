import { Activity, Plane, Users, Luggage } from "lucide-react";
import { Link } from "react-router-dom";

export default function StaffDashboard() {
  const cards = [
    { name: "Flight Operations", icon: Plane, path: "/dashboard/flights", stat: "Active", color: "text-blue-500", bg: "bg-blue-50" },
    { name: "Booking Management", icon: Users, path: "/dashboard/bookings", stat: "Secure", color: "text-indigo-500", bg: "bg-indigo-50" },
    { name: "Baggage Handling", icon: Luggage, path: "/dashboard/baggage", stat: "Tracking", color: "text-purple-500", bg: "bg-purple-50" },
    { name: "System Health", icon: Activity, path: "/dashboard/health", stat: "Online", color: "text-emerald-500", bg: "bg-emerald-50" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Operations Control Centre</h1>
          <p className="mt-2 text-slate-500">Staff portal for managing AeroLink core systems.</p>
        </div>
        <div className="hidden sm:block">
           <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
             System Nominal
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link 
              key={card.name} 
              to={card.path}
              className="relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:border-slate-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.stat}</span>
              </div>
              <h3 className="text-sm font-medium text-slate-500">{card.name}</h3>
              <div className="mt-1 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                Manage →
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  );
}
