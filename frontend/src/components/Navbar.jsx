// import { useEffect, useState } from "react";
// import api from "../api/apiClient";
// import Loading from "../components/Loading";
// import ErrorState from "../components/ErrorState";
// import Navbar from "../components/Navbar";
// import "../styles/dash.css";

// const Dashboard = () => {
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     const loadDashboardData = async () => {
//       try {
//         const summaryRes = await api.get("/api/dashboard/summary");
//         const summary = summaryRes.summary || {};
//         setData({
//           money: summary.money || { totalCollected: 0, pendingAmount: 0 },
//           services: summary.services || {
//             servicesDoneThisMonth: 0,
//             upcomingServices: 0,
//             overdueServices: 0,
//           },
//           customers: summary.customers || { totalActive: 0 },
//         });
//       } catch (err) {
//         setError("Failed to load dashboard");
//       } finally {
//         setLoading(false);
//       }
//     };
//     loadDashboardData();
//   }, []);

//   if (loading) return <Loading />;
//   if (error) return <ErrorState message={error} />;

//   return (
//     <div className="layout-wrapper">
//       <Navbar />
//       <main className="main-layout-content">
//         <header className="dashboard-header">
//           <div className="header-text">
//             <h1>Hello, Rohit</h1>
//             <p>Here's what's happening with your business in January 2026</p>
//           </div>
//           <div className="header-date">Friday, 30 Jan</div>
//         </header>

//         <div className="page-content">
//           <div className="dashboard-content">
//             <div className="stats-row">
//               <StatCard
//                 icon="💰"
//                 label="Total Revenue"
//                 value="₹71,726"
//                 type="primary"
//               />
//               <StatCard
//                 icon="⏳"
//                 label="Pending"
//                 value="₹40,000"
//                 type="warning"
//               />
//               <StatCard
//                 icon="🛠️"
//                 label="Services Done"
//                 value="7"
//                 type="success"
//               />
//               <StatCard
//                 icon="👥"
//                 label="Active Customers"
//                 value="9"
//                 type="info"
//               />
//             </div>

//             <div className="card">
//               <h2>Revenue Breakdown</h2>
//               <div className="breakdown-list">
//                 <div className="breakdown-item">
//                   <span>Filter Sales</span>
//                   <strong>₹55,091</strong>
//                 </div>
//                 <div className="breakdown-item">
//                   <span>Service Charges</span>
//                   <strong>₹16,635</strong>
//                 </div>
//                 <div className="breakdown-total">
//                   <span>Total Earnings</span>
//                   <span className="text-blue">₹71,726</span>
//                 </div>
//               </div>
//             </div>

//             <div className="card">
//               <h2>Service Reminders</h2>
//               <div className="reminder-box">
//                 <div>
//                   <div style={{ fontWeight: "700" }}>Upcoming Services</div>
//                   <div style={{ fontSize: "11px", color: "#92400e" }}>
//                     Next 10 days
//                   </div>
//                 </div>
//                 <div style={{ fontSize: "24px", fontWeight: "800" }}>2</div>
//               </div>
//               <div className="reminder-box">
//                 <div>
//                   <div style={{ fontWeight: "700" }}>Overdue Services</div>
//                   <div style={{ fontSize: "11px", color: "#b91c1c" }}>
//                     Immediate attention
//                   </div>
//                 </div>
//                 <div
//                   style={{
//                     fontSize: "24px",
//                     fontWeight: "800",
//                     color: "#b91c1c",
//                   }}
//                 >
//                   1
//                 </div>
//               </div>
//               <button
//                 className="primary-btn"
//                 style={{ width: "100%", marginTop: "10px" }}
//               >
//                 View All Services →
//               </button>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// };

// const StatCard = ({ icon, label, value, type }) => (
//   <div className={`stat-card ${type}`}>
//     <span className="stat-icon">{icon}</span>
//     <div className="stat-info">
//       <label>{label}</label>
//       <h3>{value}</h3>
//     </div>
//   </div>
// );

// export default Dashboard;
