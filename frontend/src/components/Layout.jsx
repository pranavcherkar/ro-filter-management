// components/Layout.jsx
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";
import "../styles/Layout.css";

export default function Layout() {
  return (
    <div className="app-layout">
      <Navbar />
      <div className="page-content">
        <Outlet />
      </div>
    </div>
  );
}
