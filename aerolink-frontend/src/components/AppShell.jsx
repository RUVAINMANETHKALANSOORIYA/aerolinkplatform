import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function AppShell() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar setIsMobileOpen={setIsMobileOpen} />
        
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
