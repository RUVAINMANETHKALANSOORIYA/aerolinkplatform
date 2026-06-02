import { Navigate, Outlet } from "react-router-dom";
import { getStoredAccessToken } from "../auth.js";

/**
 * ProtectedRoute
 * Redirects to /login if no valid token is present in localStorage.
 * Renders nested routes (Outlet) if authenticated.
 */
export default function ProtectedRoute() {
  const token = getStoredAccessToken();
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
