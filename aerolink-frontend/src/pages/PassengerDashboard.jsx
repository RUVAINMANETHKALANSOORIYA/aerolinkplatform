import { Plane, Ticket, Luggage } from "lucide-react";
import { Link } from "react-router-dom";

export default function PassengerDashboard() {
  const username = localStorage.getItem("username") || "Passenger";

  const cards = [
    { name: "Available Flights", icon: Plane, path: "/dashboard/flights", desc: "Browse and book new flights", color: "text-blue-500", bg: "bg-blue-50" },
    { name: "My Bookings", icon: Ticket, path: "/dashboard/bookings", desc: "View your current reservations", color: "text-emerald-500", bg: "bg-emerald-50" },
    { name: "Baggage Tracking", icon: Luggage, path: "/dashboard/baggage", desc: "Check the status of your bags", color: "text-purple-500", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back, {username}</h1>
        <p className="mt-2 text-slate-500">Manage your journeys and track your baggage from your personal dashboard.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link 
              key={card.name} 
              to={card.path}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-blue-200"
            >
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${card.bg} mb-4`}>
                <Icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{card.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{card.desc}</p>
              <div className="mt-4 flex items-center text-sm font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                View details <span aria-hidden="true" className="ml-1">→</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  );
}
