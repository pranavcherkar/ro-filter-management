import { useEffect, useState } from "react";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/upcomingserv.css";
import { useNavigate } from "react-router-dom";

const UpcomingOverdueServices = () => {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [upcoming, setUpcoming] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await api.get("/api/customers");
        const customers = res.customers || [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingList = [];
        const overdueList = [];

        customers.forEach((c) => {
          if (!c.nextServiceDate) return;

          const nextDate = new Date(c.nextServiceDate);
          nextDate.setHours(0, 0, 0, 0);

          const diffDays = Math.ceil(
            (nextDate - today) / (1000 * 60 * 60 * 24),
          );

          if (diffDays < 0) {
            overdueList.push({ ...c, daysRemaining: diffDays });
          } else if (diffDays <= 10) {
            upcomingList.push({ ...c, daysRemaining: diffDays });
          }
        });

        setUpcoming(upcomingList);
        setOverdue(overdueList);
      } catch (err) {
        setError("Failed to load services");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const data = activeTab === "upcoming" ? upcoming : overdue;

  return (
    <div className="services-container">
      <h3 className="services-header">Service Priority</h3>

      <div className="tab-wrapper">
        <button
          className={`tab-btn ${
            activeTab === "upcoming" ? "active upcoming" : ""
          }`}
          onClick={() => setActiveTab("upcoming")}
        >
          Upcoming ({upcoming.length})
        </button>

        <button
          className={`tab-btn ${
            activeTab === "overdue" ? "active overdue" : ""
          }`}
          onClick={() => setActiveTab("overdue")}
        >
          Overdue ({overdue.length})
        </button>
      </div>

      {data.length === 0 ? (
        <div className="empty-state">
          {activeTab === "upcoming"
            ? "No upcoming services"
            : "No overdue services 🎉"}
        </div>
      ) : (
        data.map((c) => (
          <div
            key={c._id || c.id}
            className={`service-status-card ${activeTab}`}
            onClick={() => navigate(`/customers/${c._id || c.id}`)}
            style={{ cursor: "pointer" }}
          >
            <div className="cust-name">{c.name}</div>

            <div className="cust-phone">📞 {c.phone}</div>

            <div className="due-info">
              {activeTab === "overdue" ? "Overdue by " : "Due in "}
              <strong>{Math.abs(c.daysRemaining)}</strong> days
            </div>

            <div className="due-date">
              Scheduled:{" "}
              {new Date(c.nextServiceDate).toLocaleDateString("en-IN")}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default UpcomingOverdueServices;
