import { useNavigate, useLocation } from "react-router-dom";
import {
  HiHome,
  HiUsers,
  HiWrenchScrewdriver,
  HiDocumentText,
  HiArchiveBox,
  HiArrowRightOnRectangle,
} from "react-icons/hi2";
import { useAuth } from "../auth/AuthContext";
import "../styles/Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { label: "Dashboard", path: "/", icon: <HiHome /> },
    { label: "Customers", path: "/customers", icon: <HiUsers /> },
    { label: "Services", path: "/services", icon: <HiWrenchScrewdriver /> },
    { label: "Invoices", path: "/invoices", icon: <HiDocumentText /> },
    { label: "Inventory", path: "/inventory", icon: <HiArchiveBox /> },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${
            location.pathname === item.path ? "active" : ""
          }`}
          onClick={() => navigate(item.path)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
      <button className="nav-item" onClick={handleLogout}>
        <span className="nav-icon">
          <HiArrowRightOnRectangle />
        </span>
        <span className="nav-label">Logout</span>
      </button>
    </nav>
  );
};

export default Navbar;
