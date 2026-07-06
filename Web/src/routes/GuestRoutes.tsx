import { Navigate, Outlet } from "react-router-dom";

export default function GuestRoute() {
  const token = localStorage.getItem("eduToken");

  return token ? <Navigate to="/dashboard" replace /> : <Outlet />;
}