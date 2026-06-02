import { Navigate } from "react-router-dom";

/**
 * RoleGuard
 * Restricts UI access based on the role stored during login.
 * Note: Actual security enforcement is handled by the backend API Gateway via Cognito groups.
 * This is strictly for UX/navigation visibility.
 */
export default function RoleGuard({ allowedRoles, children }) {
  const currentRole = localStorage.getItem("role") || "user";
  
  if (!allowedRoles.includes(currentRole)) {
    // If a passenger tries to access a staff route, redirect to their dashboard
    if (currentRole === "passenger") {
      return <Navigate to="/dashboard" replace />;
    }
    // If unknown role, send to login
    return <Navigate to="/login" replace />;
  }

  return children;
}
