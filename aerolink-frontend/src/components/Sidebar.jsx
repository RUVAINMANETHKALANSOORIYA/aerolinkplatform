import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Plane, 
  Ticket, 
  Luggage, 
  Bell, 
  Activity,
  ShieldAlert
} from "lucide-react";

export default function Sidebar({ isMobileOpen, setIsMobileOpen }) {
  const role = localStorage.getItem("role") || "passenger";
  const isStaff = role === "staff";

  const navItems = [
    { name: isStaff ? "Control Tower" : "Home", path: "/dashboard", end: true, icon: LayoutDashboard },
    { name: isStaff ? "Flight Manager" : "Find Flights", path: "/dashboard/flights", icon: Plane },
    { name: isStaff ? "Bookings" : "My Bookings", path: "/dashboard/bookings", icon: Ticket, hideForStaff: true },
    { name: isStaff ? "Baggage Operations" : "Baggage Tracking", path: "/dashboard/baggage", icon: Luggage },
    { name: "Notifications", path: "/dashboard/notifications", icon: Bell, passengerOnly: true },
    { name: "System Health", path: "/dashboard/health", icon: Activity, staffOnly: true },
  ];

  const filteredNav = navItems.filter(item => {
    if (item.passengerOnly && isStaff) return false;
    if (item.staffOnly && !isStaff) return false;
    if (item.hideForStaff && isStaff) return false;
    return true;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-auto lg:z-auto shadow-xl
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-16 shrink-0 items-center px-6 bg-slate-950/50 border-b border-slate-800">
          <Plane className="h-6 w-6 text-sky-400 mr-3" />
          <span className="text-lg font-bold text-white tracking-wide">AeroLink</span>
        </div>

        <div className="flex flex-col gap-1 p-4">
          <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mt-2">
            {isStaff ? 'Staff Portal' : 'Passenger Portal'}
          </div>
          
          <nav className="flex-1 space-y-1">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  end={item.end}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) => `
                    group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-sky-600 text-white shadow-sm' 
                      : 'hover:bg-slate-800/80 hover:text-white'}
                  `}
                >
                  <Icon className={`mr-3 h-5 w-5 shrink-0 ${item.isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-300'}`} />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {isStaff && (
          <div className="absolute bottom-0 w-full p-4 bg-slate-900/90 backdrop-blur border-t border-slate-800">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium border border-amber-500/20 shadow-sm">
              <ShieldAlert className="h-5 w-5" />
              Staff Access Active
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
