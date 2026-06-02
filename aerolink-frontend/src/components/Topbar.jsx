import { Menu, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cognitoLogout } from "../auth.js";

export default function Topbar({ setIsMobileOpen }) {
  const navigate = useNavigate();
  const username = localStorage.getItem("username") || "User";
  const role = localStorage.getItem("role") || "passenger";

  const handleLogout = () => {
    cognitoLogout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-slate-700 lg:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator for mobile */}
      <div className="h-6 w-px bg-slate-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end items-center">
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <User className="h-5 w-5" />
            </div>
            <div className="hidden md:block">
              <span className="font-semibold text-slate-900">{username}</span>
              <span className="ml-2 inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 capitalize">
                {role}
              </span>
            </div>
          </div>
          
          <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
