import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute() {
  const token = localStorage.getItem("eduToken"); // or from Context/Redux

  return token ? <Outlet /> : <Navigate to="/login" replace />;
}