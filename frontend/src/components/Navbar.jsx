import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  HiHome,
  HiUsers,
  HiWrenchScrewdriver,
  HiDocumentText,
  HiArchiveBox,
  HiUserCircle,
  HiArrowRightOnRectangle,
  HiPencilSquare,
} from "react-icons/hi2";
import { useAuth } from "../auth/AuthContext";
import "../styles/Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const navItems = [
    { label: "Dashboard", path: "/", icon: <HiHome /> },
    { label: "Customers", path: "/customers", icon: <HiUsers /> },
    { label: "Services", path: "/services", icon: <HiWrenchScrewdriver /> },
    { label: "Invoices", path: "/invoices", icon: <HiDocumentText /> },
    { label: "Inventory", path: "/inventory", icon: <HiArchiveBox /> },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate("/login");
  };

  const handleEditProfile = () => {
    setDropdownOpen(false);
    navigate("/profile");
  };

  const isProfileActive = location.pathname === "/profile";

  return (
    <nav className="navbar">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
          onClick={() => navigate(item.path)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}

      {/* Profile dropdown */}
      <div className="nav-profile-wrapper" ref={dropdownRef}>
        <button
          className={`nav-item ${isProfileActive || dropdownOpen ? "active" : ""}`}
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          <span className="nav-icon">
            <HiUserCircle />
          </span>
          <span className="nav-label">Profile</span>
        </button>

        {dropdownOpen && (
          <div className="nav-dropdown">
            <button className="nav-dropdown-item" onClick={handleEditProfile}>
              <HiPencilSquare />
              Edit Profile
            </button>
            <button
              className="nav-dropdown-item nav-dropdown-logout"
              onClick={handleLogout}
            >
              <HiArrowRightOnRectangle />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
