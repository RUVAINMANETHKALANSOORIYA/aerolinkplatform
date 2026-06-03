import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plane, Ticket, Luggage, Bell, ArrowRight, CheckCircle2, XCircle, Info, AlertTriangle, CreditCard, Clock } from "lucide-react";
import { getBookings, getMyNotifications, getMyBaggage } from "../services/api.js";
import StatusBadge from "../components/StatusBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function PassengerDashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username") || "Passenger";
  
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [baggage, setBaggage] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [bookingsData, notifData, baggageData] = await Promise.all([
          getBookings(true).catch(() => ({ items: [] })),
          getMyNotifications().catch(() => ({ items: [] })),
          getMyBaggage().catch(() => ({ items: [] }))
        ]);

        const allBookings = bookingsData.items || [];
        const confirmed = allBookings.find(b => b.status === "CONFIRMED");
        setBooking(confirmed || allBookings[0] || null);

        setNotifications((notifData.items || []).slice(0, 3));
        setBaggage((baggageData.items || [])[0] || null);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const actionCards = [
    { name: "Find Flights", icon: Plane, path: "/dashboard/flights", desc: "Browse available AeroLink routes and fares.", color: "text-sky-500", bg: "bg-sky-50" },
    { name: "My Bookings", icon: Ticket, path: "/dashboard/bookings", desc: "Review your booking and payment status.", color: "text-emerald-500", bg: "bg-emerald-50" },
    { name: "Track Baggage", icon: Luggage, path: "/dashboard/baggage", desc: "View live handling progress for your bags.", color: "text-indigo-500", bg: "bg-indigo-50" },
    { name: "Notifications", icon: Bell, path: "/dashboard/notifications", desc: "See important travel and payment updates.", color: "text-amber-500", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* PHASE 1: HERO */}
      <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-sm ring-1 ring-slate-200 flex flex-col sm:flex-row justify-between items-center gap-8 relative overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-sky-50 rounded-full opacity-50 blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 w-full sm:w-auto text-center sm:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome aboard{username ? `, ${username.split('@')[0]}` : ""}
          </h1>
          <p className="mt-2 text-slate-500 text-lg max-w-xl">
            Plan your journey and stay updated with AeroLink.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center sm:justify-start">
            <Link to="/dashboard/flights" className="inline-flex justify-center items-center gap-2 rounded-md bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors">
              <Plane className="h-4 w-4" /> Find Flights
            </Link>
            <Link to="/dashboard/bookings" className="inline-flex justify-center items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-colors">
              <Ticket className="h-4 w-4" /> My Bookings
            </Link>
          </div>
        </div>
        
        <div className="hidden sm:flex relative z-10 h-40 w-40 bg-sky-50/80 backdrop-blur rounded-full items-center justify-center text-sky-500 shrink-0 ring-8 ring-white shadow-inner">
          <Plane className="h-20 w-20 opacity-90 transform translate-x-1 -translate-y-1" />
        </div>
      </div>

      {/* PHASE 2: QUICK ACTIONS */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">Plan and manage your journey</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link 
                key={card.name} 
                to={card.path}
                className="group flex flex-col bg-white p-5 rounded-xl shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-sky-300"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${card.bg} mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <h3 className="text-base font-bold text-slate-900">{card.name}</h3>
                <p className="mt-1 text-sm text-slate-500 line-clamp-2">{card.desc}</p>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PHASE 3 & 4: CURRENT JOURNEY */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Your Current Journey</h2>
          
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden min-h-[300px] flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <LoadingSpinner label="Loading journey details..." />
              </div>
            ) : booking ? (
              <div className="flex flex-col h-full relative">
                {/* Accent border based on status */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${booking.status === "CONFIRMED" ? "bg-emerald-500" : booking.status === "PENDING_PAYMENT" ? "bg-amber-400" : booking.status === "PAYMENT_FAILED" ? "bg-red-500" : "bg-sky-500"}`}></div>
                
                <div className="p-6 sm:p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700 font-mono tracking-widest">
                      {booking.flight_no}
                    </span>
                    <StatusBadge status={booking.status} />
                  </div>
                  
                  <div className="text-center py-6">
                    <div className="flex items-center justify-center gap-4 sm:gap-8">
                      <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{booking.origin || "---"}</div>
                      <Plane className="h-6 w-6 sm:h-8 sm:w-8 text-slate-300" />
                      <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{booking.destination || "---"}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-center gap-8 text-sm">
                    {booking.seat_count && (
                      <div className="text-center">
                        <p className="text-slate-500 font-medium">Seats</p>
                        <p className="font-bold text-slate-900 text-lg">{booking.seat_count}</p>
                      </div>
                    )}
                    {booking.total_amount != null && (
                      <div className="text-center">
                        <p className="text-slate-500 font-medium">Total Amount</p>
                        <p className="font-bold text-slate-900 text-lg">${Number(booking.total_amount).toFixed(2)}</p>
                      </div>
                    )}
                  </div>

                  {/* Status Banner / Call to Action */}
                  {booking.status === "PENDING_PAYMENT" && (
                    <div className="mt-8 rounded-lg bg-amber-50 p-4 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-amber-900">Payment is required to confirm this booking.</h4>
                          <p className="text-sm text-amber-700 mt-1">Complete your payment to secure your seats.</p>
                        </div>
                      </div>
                      <Link to="/dashboard/bookings" className="whitespace-nowrap rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 transition-colors">
                        Pay Now
                      </Link>
                    </div>
                  )}

                  {booking.status === "CONFIRMED" && (
                    <div className="mt-8 rounded-lg bg-emerald-50 p-4 border border-emerald-100 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <h4 className="text-sm font-bold text-emerald-900">Your booking is confirmed.</h4>
                    </div>
                  )}

                  {/* Journey Overview Timeline */}
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Journey Status</h4>
                    <div className="flex items-center gap-2 sm:gap-4 justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-slate-900 hidden sm:block">Booking Created</span>
                      </div>
                      
                      <div className={`h-0.5 flex-1 ${booking.status === "CONFIRMED" ? "bg-emerald-200" : "bg-slate-200"}`}></div>
                      
                      <div className="flex items-center gap-2">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          booking.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-600" : 
                          booking.status === "PAYMENT_FAILED" ? "bg-red-100 text-red-600" : 
                          "bg-amber-100 text-amber-600"
                        }`}>
                          {booking.status === "CONFIRMED" ? <CheckCircle2 className="h-4 w-4" /> : 
                           booking.status === "PAYMENT_FAILED" ? <XCircle className="h-4 w-4" /> : 
                           <CreditCard className="h-4 w-4" />}
                        </div>
                        <span className={`text-xs sm:text-sm font-medium hidden sm:block ${
                          booking.status === "CONFIRMED" ? "text-slate-900" : 
                          booking.status === "PAYMENT_FAILED" ? "text-red-700" : 
                          "text-amber-700"
                        }`}>
                          {booking.status === "CONFIRMED" ? "Payment Confirmed" : 
                           booking.status === "PAYMENT_FAILED" ? "Payment Failed" : 
                           "Payment Pending"}
                        </span>
                      </div>
                      
                      <div className={`h-0.5 flex-1 ${booking.status === "CONFIRMED" && baggage ? "bg-emerald-200" : "bg-slate-200"}`}></div>
                      
                      <div className="flex items-center gap-2">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          booking.status === "CONFIRMED" ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-400"
                        }`}>
                          <Luggage className="h-4 w-4" />
                        </div>
                        <span className={`text-xs sm:text-sm font-medium hidden sm:block ${
                          booking.status === "CONFIRMED" ? "text-slate-900" : "text-slate-400"
                        }`}>
                          Ready for Baggage
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
                  <Link to="/dashboard/bookings" className="text-sm font-semibold text-sky-600 hover:text-sky-500 flex items-center gap-1">
                    View My Bookings <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState 
                  icon={Ticket} 
                  title="No journeys booked yet" 
                  description="Explore available flights and start your next journey." 
                  action={{ label: "Find Flights", onClick: () => navigate("/dashboard/flights") }}
                />
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR: Updates & Baggage */}
        <div className="space-y-8">
          
          {/* PHASE 5: RECENT UPDATES */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Recent Updates</h2>
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <LoadingSpinner label="" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-3">
                    <Bell className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">No recent updates</h3>
                  <p className="mt-1 text-sm text-slate-500">Important journey notifications will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notif, i) => {
                    const isSuccess = notif.event_type === "PaymentSucceeded" || notif.title?.toLowerCase().includes("confirmed");
                    const isFail = notif.event_type === "PaymentFailed" || notif.title?.toLowerCase().includes("unsuccessful") || notif.title?.toLowerCase().includes("failed");
                    
                    const Icon = isSuccess ? CheckCircle2 : (isFail ? XCircle : Info);
                    const iconColor = isSuccess ? "text-emerald-500" : (isFail ? "text-red-500" : "text-sky-500");
                    const bgAccent = isSuccess ? "bg-emerald-50" : (isFail ? "bg-red-50" : "bg-sky-50");

                    return (
                      <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex gap-4 items-start">
                        <div className={`mt-0.5 rounded-full p-2 ${bgAccent} ${iconColor} shrink-0`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">{notif.title}</p>
                          <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{notif.message}</p>
                          {notif.created_at && (
                            <p className="mt-1.5 text-xs font-medium text-slate-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {new Date(notif.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Link to="/dashboard/notifications" className="block w-full text-center py-3 text-sm font-bold text-sky-600 hover:text-sky-700 hover:bg-slate-50 border-t border-slate-100 transition-colors">
                    View All Notifications
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* PHASE 6: BAGGAGE PREVIEW */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Baggage Tracking</h2>
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <LoadingSpinner label="" />
                </div>
              ) : baggage ? (
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Luggage className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold font-mono text-slate-900">{baggage.tag_number}</p>
                        <p className="text-xs text-slate-500 font-medium">Flight {baggage.flight_no}</p>
                      </div>
                    </div>
                    <StatusBadge status={baggage.status} />
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between items-center border border-slate-100 mb-4">
                    <span className="text-slate-500 font-medium">Route</span>
                    <span className="font-bold text-slate-700">{baggage.origin} to {baggage.destination}</span>
                  </div>

                  <Link to="/dashboard/baggage" className="flex w-full justify-center items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-colors">
                    Track My Baggage
                  </Link>
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50/50">
                  <p className="text-sm font-medium text-slate-500">No baggage currently registered for your journeys.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
