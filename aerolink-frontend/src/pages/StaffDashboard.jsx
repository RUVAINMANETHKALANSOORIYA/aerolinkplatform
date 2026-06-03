import { useState, useEffect, useMemo } from "react";
import { Plane, Users, Luggage, Activity, AlertTriangle, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getFlights } from "../services/api.js";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function StaffDashboard() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await getFlights();
        const rawFlights = Array.isArray(data) ? data : (data.items || []);
        setFlights(rawFlights);
      } catch (err) {
        setError("Unable to load flight data for dashboard metrics.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const stats = useMemo(() => {
    let totalSeats = 0;
    let availableSeats = 0;
    let lowAvailabilityCount = 0;
    const routes = new Set();

    flights.forEach(f => {
      const avail = Number(f.available_seats || 0);
      const total = Number(f.total_seats || f.available_seats || 0);
      availableSeats += avail;
      totalSeats += total;
      routes.add(`${f.origin}-${f.destination}`);

      // Definition of low availability: less than 20% seats remaining and total > 0
      if (total > 0 && avail / total <= 0.2) {
        lowAvailabilityCount++;
      }
    });

    return {
      totalFlights: flights.length,
      availableSeats,
      routesInOperation: routes.size,
      lowAvailabilityCount
    };
  }, [flights]);

  const quickLinks = [
    { name: "Manage Flights", icon: Plane, path: "/dashboard/flights", color: "text-sky-500", bg: "bg-sky-50" },
    { name: "Baggage Operations", icon: Luggage, path: "/dashboard/baggage", color: "text-indigo-500", bg: "bg-indigo-50" },
    { name: "System Health", icon: Activity, path: "/dashboard/health", color: "text-emerald-500", bg: "bg-emerald-50" },
  ];

  const getFlightStatus = (avail, total) => {
    if (total > 0 && avail === 0) return "Sold Out";
    if (total > 0 && avail / total <= 0.2) return "Limited Seats";
    return "Available";
  };

  const getFlightStatusBadgeType = (status) => {
    if (status === "Available") return "CHECKED_IN"; // maps to green in StatusBadge roughly
    if (status === "Limited Seats") return "DELAYED"; // maps to amber
    if (status === "Sold Out") return "ERROR"; // doesn't exist natively, let's use a custom logic or map to something red
    return "UNKNOWN";
  };

  // Custom badge for flight availability to match instructions
  const AvailabilityBadge = ({ status }) => {
    if (status === "Available") return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Available</span>;
    if (status === "Limited Seats") return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Limited Seats</span>;
    if (status === "Sold Out") return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Sold Out</span>;
    return <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">{status}</span>;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control Tower</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor flights, bookings and operational activity across AeroLink.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-100 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Metrics */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <LoadingSpinner label="Loading operational metrics..." />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Flights" value={stats.totalFlights} icon={Plane} colorClass="text-slate-600" bgClass="bg-slate-100" />
          <StatCard title="Available Seats" value={stats.availableSeats} icon={Users} colorClass="text-sky-600" bgClass="bg-sky-50" />
          <StatCard title="Routes in Operation" value={stats.routesInOperation} icon={Activity} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
          <StatCard title="Low Seat Flights" value={stats.lowAvailabilityCount} icon={AlertTriangle} colorClass="text-amber-600" bgClass="bg-amber-50" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content: Active Flights */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Flight Operations</h2>
            <Link to="/dashboard/flights" className="text-sm font-semibold text-sky-600 hover:text-sky-500 flex items-center gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-8 flex justify-center">
                <LoadingSpinner label="Loading flights..." />
              </div>
            ) : flights.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No active flights found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {flights.slice(0, 5).map((flight, idx) => {
                  const avail = Number(flight.available_seats || 0);
                  const total = Number(flight.total_seats || flight.available_seats || 0);
                  const status = getFlightStatus(avail, total);

                  return (
                    <div key={flight.flight_id || idx} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <Plane className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 font-mono">{flight.flight_no || flight.flight_number}</span>
                            <AvailabilityBadge status={status} />
                          </div>
                          <div className="text-sm text-slate-500 mt-0.5 font-medium">
                            {flight.origin} to {flight.destination} • ${flight.price}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{avail} <span className="text-slate-500 font-normal">seats left</span></p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links Sidebar */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link 
                  key={link.name}
                  to={link.path}
                  className="group flex items-center justify-between p-4 bg-white rounded-xl shadow-sm ring-1 ring-slate-200 hover:shadow-md hover:ring-slate-300 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${link.bg} ${link.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium text-slate-900">{link.name}</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-sky-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
