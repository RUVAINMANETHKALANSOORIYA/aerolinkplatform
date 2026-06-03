import { Menu, LogOut, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cognitoLogout } from "../auth.js";

export default function Topbar({ setIsMobileOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem("username") || "User";
  const role = localStorage.getItem("role") || "passenger";
  const isStaff = role === "staff";

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/dashboard") return isStaff ? "Control Tower" : "Home";
    if (path.includes("/flights")) return isStaff ? "Flight Manager" : "Find Flights";
    if (path.includes("/bookings")) return isStaff ? "Bookings" : "My Bookings";
    if (path.includes("/baggage")) return isStaff ? "Baggage Operations" : "Track Baggage";
    if (path.includes("/notifications")) return "Notifications";
    if (path.includes("/health")) return "System Health";
    return "Dashboard";
  };

  const handleLogout = () => {
    cognitoLogout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 justify-between">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-slate-700 lg:hidden rounded-md hover:bg-slate-100 transition-colors"
          onClick={() => setIsMobileOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        
        {/* Page Title */}
        <h1 className="text-xl font-bold text-slate-900 hidden sm:block tracking-tight">{getPageTitle()}</h1>
      </div>

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end items-center">
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-2 ring-white shadow-sm">
              <User className="h-5 w-5" />
            </div>
            <div className="hidden md:flex md:flex-col md:items-start">
              <span className="font-semibold text-slate-900 leading-none">{username.split('@')[0]}</span>
              <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isStaff ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                {role}
              </span>
            </div>
          </div>
          
          <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
