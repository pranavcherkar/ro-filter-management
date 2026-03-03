import { useNavigate, useLocation } from "react-router-dom";
import {
  HiHome,
  HiUsers,
  HiWrenchScrewdriver,
  HiDocumentText,
  HiArchiveBox,
} from "react-icons/hi2";
import "../styles/Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/", icon: <HiHome /> },
    { label: "Customers", path: "/customers", icon: <HiUsers /> },
    { label: "Services", path: "/services", icon: <HiWrenchScrewdriver /> },
    { label: "Invoices", path: "/invoices", icon: <HiDocumentText /> },
    { label: "Inventory", path: "/inventory", icon: <HiArchiveBox /> },
  ];

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
    </nav>
  );
};

export default Navbar;
