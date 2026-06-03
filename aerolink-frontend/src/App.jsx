import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleGuard from "./components/RoleGuard.jsx";

// Pages
import LoginPage from "./pages/LoginPage.jsx";
import PassengerDashboard from "./pages/PassengerDashboard.jsx";
import StaffDashboard from "./pages/StaffDashboard.jsx";
import FlightsPage from "./pages/FlightsPage.jsx";
import BookingsPage from "./pages/BookingsPage.jsx";
import BaggagePage from "./pages/BaggagePage.jsx";
import HealthPage from "./pages/HealthPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import SignUpPage from "./pages/SignUpPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";

// ── Role-based Dashboard Router ──────────────────────────────────────────────
// Small wrapper that redirects to the correct dashboard based on stored role
function DashboardIndex() {
  const role = localStorage.getItem("role") || "passenger";
  if (role === "staff") {
    return <StaffDashboard />;
  }
  return <PassengerDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public login and signup routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        
        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<AppShell />}>
            <Route index element={<DashboardIndex />} />
            <Route path="flights" element={<FlightsPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            
            <Route 
              path="baggage" 
              element={
                <RoleGuard allowedRoles={["staff", "passenger"]}>
                  <BaggagePage />
                </RoleGuard>
              } 
            />
            
            <Route 
              path="health" 
              element={
                <RoleGuard allowedRoles={["staff", "passenger"]}>
                  <HealthPage />
                </RoleGuard>
              } 
            />
            
            <Route 
              path="notifications" 
              element={
                <RoleGuard allowedRoles={["passenger"]}>
                  <NotificationsPage />
                </RoleGuard>
              } 
            />
          </Route>
        </Route>
        
        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}