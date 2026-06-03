import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Luggage, Plus, Search, Filter, AlertCircle, CheckCircle2, 
  Clock, Package, PlaneTakeoff, ShieldCheck, MapPin, 
  AlertTriangle, RefreshCw
} from "lucide-react";
import { getMyBaggage, getAllBaggage, createBaggage, updateBaggageStatus } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";

const VALID_STATUSES = ["CHECKED_IN", "SCREENED", "LOADED", "IN_TRANSIT", "ARRIVED", "COLLECTED", "DELAYED"];
const TIMELINE_STEPS = ["CHECKED_IN", "SCREENED", "LOADED", "IN_TRANSIT", "ARRIVED", "COLLECTED"];

export default function BaggagePage() {
  const isStaff = localStorage.getItem("role") === "staff";
  const location = useLocation();
  const navigate = useNavigate();
  
  const [bags, setBags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Modals
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [updateModalBag, setUpdateModalBag] = useState(null);

  // Form states
  const [creating, setCreating] = useState(false);
  const [regBookingId, setRegBookingId] = useState("");
  const [regTagNumber, setRegTagNumber] = useState("");
  const [regWeight, setRegWeight] = useState("");
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);

  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("CHECKED_IN");

  // Filter states (Staff)
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadBaggage = async () => {
    setLoading(true);
    setError("");
    try {
      const data = isStaff ? await getAllBaggage() : await getMyBaggage();
      setBags(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load baggage records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaggage();
  }, [isStaff]);

  useEffect(() => {
    if (isStaff && location.state?.bookingForBaggage) {
      const booking = location.state.bookingForBaggage;
      setRegBookingId(booking.id);
      setSelectedBookingDetails(booking);
      setIsRegModalOpen(true);
      // Clear location state so refresh doesn't reopen modal
      window.history.replaceState({}, document.title);
    }
  }, [isStaff, location.state]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regBookingId || !regTagNumber) return;
    setCreating(true);
    setError("");
    setSuccessMsg("");
    try {
      await createBaggage(regBookingId, regTagNumber, regWeight);
      setSuccessMsg("Baggage registered successfully.");
      setIsRegModalOpen(false);
      setRegBookingId("");
      setRegTagNumber("");
      setRegWeight("");
      setSelectedBookingDetails(null);
      loadBaggage();
    } catch (err) {
      setError(err.message || "Failed to register baggage");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateModalBag || !updateStatus) return;
    setUpdating(true);
    setError("");
    setSuccessMsg("");
    try {
      await updateBaggageStatus(updateModalBag.id || updateModalBag.baggage_id, updateStatus);
      setSuccessMsg("Baggage status updated.");
      setUpdateModalBag(null);
      loadBaggage();
    } catch (err) {
      setError(err.message || "Failed to update baggage status");
    } finally {
      setUpdating(false);
    }
  };

  // â”€â”€ STAFF COMPUTATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredBags = useMemo(() => {
    if (!isStaff) return bags;
    return bags.filter(bag => {
      const matchSearch = 
        (bag.tag_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bag.flight_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bag.booking_id || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "ALL" || bag.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bags, searchTerm, statusFilter, isStaff]);

  const stats = useMemo(() => {
    if (!isStaff) return null;
    return {
      total: bags.length,
      checkedIn: bags.filter(b => b.status === "CHECKED_IN" || b.status === "SCREENED" || b.status === "LOADED").length,
      inTransit: bags.filter(b => b.status === "IN_TRANSIT").length,
      delayed: bags.filter(b => b.status === "DELAYED").length,
    };
  }, [bags, isStaff]);

  // â”€â”€ PASSENGER TIMELINE HELPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getTimelineStepStatus = (stepIndex, currentStatus) => {
    if (currentStatus === "DELAYED") {
      // Find the last completed step if possible, but simplified: DELAYED freezes timeline visually
      // In a real app we'd track status history. Here we just color based on step.
      return "delayed"; 
    }
    const currentIndex = TIMELINE_STEPS.indexOf(currentStatus);
    if (currentIndex === -1) return "muted"; // Unknown status
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "muted";
  };


  if (!isStaff) {
    // â”€â”€ PASSENGER VIEW: Track Your Baggage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Track Your Baggage</h1>
            <p className="mt-1 text-sm text-slate-500">Real-time updates for your checked luggage.</p>
          </div>
          <button 
            onClick={loadBaggage}
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-100 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Locating baggage..." />
          </div>
        ) : bags.length === 0 ? (
          <EmptyState 
            icon={Luggage} 
            title="No Baggage Found" 
            description="You don't have any checked baggage for your current bookings." 
          />
        ) : (
          <div className="space-y-6">
            {bags.map((bag, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden transition-all hover:shadow-md">
                
                {/* Header */}
                <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                      <Luggage className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 font-mono tracking-tight">{bag.tag_number || "NO TAG"}</h3>
                        <StatusBadge status={bag.status || "UNKNOWN"} />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Flight {bag.flight_no}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {bag.origin && bag.destination ? `${bag.origin} to ${bag.destination}` : "Route Unavailable"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Updated {bag.updated_at ? new Date(bag.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Unknown"}
                    </p>
                  </div>
                </div>

                {/* Body: Timeline */}
                <div className="p-6">
                  {bag.status === "DELAYED" && (
                    <div className="mb-6 rounded-lg bg-amber-50 p-4 border border-amber-200 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-900">Baggage Delayed</h4>
                        <p className="text-sm text-amber-700 mt-1">We apologize, but this item is currently delayed. Our team is working to expedite it to its destination.</p>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    {/* Timeline Line background */}
                    <div className="absolute top-5 left-4 right-4 h-0.5 bg-slate-100 hidden sm:block" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 sm:gap-0 relative z-10">
                      {TIMELINE_STEPS.map((step, stepIdx) => {
                        const stepState = getTimelineStepStatus(stepIdx, bag.status);
                        
                        let dotClasses = "h-10 w-10 rounded-full border-4 flex items-center justify-center shrink-0 transition-colors mx-auto ";
                        let textClasses = "text-xs font-semibold mt-3 text-center ";
                        let Icon = Clock;
                        
                        if (step === "CHECKED_IN") Icon = Package;
                        if (step === "SCREENED") Icon = ShieldCheck;
                        if (step === "LOADED") Icon = PlaneTakeoff;
                        if (step === "IN_TRANSIT") Icon = PlaneTakeoff; // You can use different icons
                        if (step === "ARRIVED") Icon = MapPin;
                        if (step === "COLLECTED") Icon = CheckCircle2;

                        if (bag.status === "DELAYED") {
                           const currentIndex = TIMELINE_STEPS.indexOf("DELAYED"); // -1
                           // If delayed, we just make them all look pending except maybe checked in.
                           // For simplicity, make them amber if current, else muted.
                           dotClasses += "bg-white border-amber-200 text-amber-300";
                           textClasses += "text-slate-400";
                        } else if (stepState === "completed") {
                          dotClasses += "bg-sky-50 border-sky-500 text-sky-600";
                          textClasses += "text-slate-900";
                        } else if (stepState === "current") {
                          dotClasses += "bg-sky-600 border-sky-100 text-white shadow-md ring-4 ring-sky-50";
                          textClasses += "text-sky-700 font-bold";
                        } else {
                          dotClasses += "bg-white border-slate-200 text-slate-300";
                          textClasses += "text-slate-400";
                        }

                        return (
                          <div key={step} className="flex flex-row sm:flex-col items-center sm:justify-start gap-4 sm:gap-0">
                            <div className={dotClasses}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className={`${textClasses} sm:block w-32 sm:w-auto`}>
                              {step.replace("_", " ")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                {bag.weight_kg && (
                  <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Registered Weight</span>
                    <span className="font-semibold text-slate-700">{bag.weight_kg} kg</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // â”€â”€ STAFF VIEW: Baggage Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Baggage Operations</h1>
          <p className="mt-1 text-sm text-slate-500">Register baggage and monitor live handling progress.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadBaggage}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setIsRegModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            <Plus className="h-4 w-4" /> Register Baggage
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Bags" value={stats.total} icon={Luggage} colorClass="text-slate-600" bgClass="bg-slate-100" />
          <StatCard title="Checked/Loaded" value={stats.checkedIn} icon={Package} colorClass="text-sky-600" bgClass="bg-sky-50" />
          <StatCard title="In Transit" value={stats.inTransit} icon={PlaneTakeoff} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
          <StatCard title="Delayed" value={stats.delayed} icon={AlertTriangle} colorClass="text-amber-600" bgClass="bg-amber-50" />
        </div>
      )}

      {/* Feedback banners */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-100 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-100 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm ring-1 ring-slate-200">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by tag, flight, or booking ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
          />
        </div>
        <div className="relative w-full sm:w-64 flex-shrink-0">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Filter className="h-4 w-4 text-slate-400" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full rounded-md border-0 py-2 pl-10 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
          >
            <option value="ALL">All Statuses</option>
            {VALID_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Loading operations data..." />
          </div>
        ) : filteredBags.length === 0 ? (
          <EmptyState 
            icon={Luggage} 
            title="No Baggage Found" 
            description="Adjust your search filters or register new baggage." 
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Tag Number / ID</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Flight Route</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Weight</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Last Updated</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredBags.map((bag, i) => (
                  <tr key={bag.id || bag.baggage_id || i} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                      <div className="flex flex-col">
                        <span className="font-mono">{bag.tag_number || "No tag"}</span>
                        <span className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[120px]">{bag.id || bag.baggage_id}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      <div className="font-semibold text-slate-700">{bag.flight_no}</div>
                      <div className="text-xs">{bag.origin && bag.destination ? `${bag.origin} to ${bag.destination}` : ""}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <StatusBadge status={bag.status || "UNKNOWN"} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {bag.weight_kg ? `${bag.weight_kg} kg` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {bag.updated_at || bag.last_updated ? new Date(bag.updated_at || bag.last_updated).toLocaleString() : "-"}
                    </td>
                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        onClick={() => {
                          setUpdateModalBag(bag);
                          setUpdateStatus(bag.status || "CHECKED_IN");
                        }}
                        className="text-sky-600 hover:text-sky-900 font-semibold"
                      >
                        Update Status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      <Modal 
        isOpen={isRegModalOpen} 
        onClose={() => {
          if (!creating) {
            setIsRegModalOpen(false);
            setSelectedBookingDetails(null);
          }
        }} 
        title="Register Baggage"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          {selectedBookingDetails ? (
            <div className="rounded-md bg-emerald-50 p-4 border border-emerald-100 mb-4">
              <h4 className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Confirmed booking selected
              </h4>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-emerald-800">
                <div>
                  <span className="block text-xs font-semibold uppercase opacity-70">Passenger</span>
                  <span>{selectedBookingDetails.passenger_name || "-"}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase opacity-70">Flight</span>
                  <span>{selectedBookingDetails.flight_no}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-xs font-semibold uppercase opacity-70">Route</span>
                  <span>{selectedBookingDetails.origin} â†’ {selectedBookingDetails.destination}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 border border-blue-100 flex justify-between items-center">
              <span>Baggage can be registered only for a confirmed booking.</span>
              <button 
                type="button" 
                onClick={() => navigate("/dashboard/bookings")}
                className="text-blue-600 hover:text-blue-800 font-semibold underline text-xs whitespace-nowrap ml-2"
              >
                Select from Bookings
              </button>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium leading-6 text-slate-900">Booking ID</label>
            <input
              type="text"
              required
              value={regBookingId}
              onChange={(e) => setRegBookingId(e.target.value)}
              placeholder="e.g. uuid-..."
              className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-sm font-medium leading-6 text-slate-900">Tag Number</label>
            <input
              type="text"
              required
              value={regTagNumber}
              onChange={(e) => setRegTagNumber(e.target.value)}
              placeholder="e.g. AL-88392"
              className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
            />
          </div>
          <div>
            <label className="block text-sm font-medium leading-6 text-slate-900">Weight (kg) <span className="text-slate-400 font-normal">(Optional)</span></label>
            <input
              type="number"
              step="0.1"
              value={regWeight}
              onChange={(e) => setRegWeight(e.target.value)}
              className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsRegModalOpen(false)}
              disabled={creating}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !regBookingId || !regTagNumber}
              className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-70"
            >
              {creating ? <LoadingSpinner size="sm" label="" /> : "Register"}
            </button>
          </div>
          
          {selectedBookingDetails && (
            <div className="pt-2 border-t border-slate-100 mt-2">
               <button 
                type="button" 
                onClick={() => navigate("/dashboard/bookings")}
                className="text-sky-600 hover:text-sky-800 font-semibold text-xs"
              >
                â† Select a different Passenger Booking
              </button>
            </div>
          )}
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={!!updateModalBag}
        onClose={() => !updating && setUpdateModalBag(null)}
        title="Update Baggage Status"
      >
        {updateModalBag && (
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Tag Number</p>
                  <p className="font-mono text-slate-900 font-medium mt-1">{updateModalBag.tag_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Flight Route</p>
                  <p className="text-slate-900 font-medium mt-1">
                    {updateModalBag.flight_no} {updateModalBag.origin && updateModalBag.destination ? `(${updateModalBag.origin} to ${updateModalBag.destination})` : ""}
                  </p>
                </div>
                <div className="col-span-2 pt-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Current Status</p>
                  <StatusBadge status={updateModalBag.status} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-slate-900">New Status</label>
              <select
                required
                value={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.value)}
                className="mt-2 block w-full rounded-md border-0 py-2.5 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 font-medium"
              >
                {VALID_STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setUpdateModalBag(null)}
                disabled={updating}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-70"
              >
                {updating ? <LoadingSpinner size="sm" label="" /> : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}

