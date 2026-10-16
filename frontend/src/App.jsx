
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Flame,
  Fuel,
  LayoutDashboard,
  MapPin,
  MapPinned,
  RefreshCw,
  Search,
  ShieldAlert,
  Truck,
  Users,
  CalendarClock,
  TrendingUp,
  Check,
  X,
} from "lucide-react";
import "./App.css";

const API = "http://localhost:5000/api";

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Fuel Intelligence", icon: Fuel },
  { label: "Safety Centre", icon: ShieldAlert },
  { label: "Distribution", icon: Truck },
  { label: "Territory Map", icon: MapPinned },
];

function formatTime(value) {
  if (!value) return "Time unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetricCard({ icon: Icon, label, value, detail, tone = "orange" }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={21} />
      </div>

      <div className="metric-label">{label}</div>
      <div className="metric-value">{value ?? "—"}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}

function SectionHeading({ title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>;
}

function ForecastPanel({ forecastData }) {
  const forecast = forecastData?.forecast ?? [];

  const maximum = Math.max(
    1,
    ...forecast.map((day) => day.estimated_refills ?? 0)
  );

  return (
    <section className="panel">
      <SectionHeading
        title="Three-Day Refill Forecast"
        description="Estimated households approaching refill time"
        action={<span className="tag">SIMULATED</span>}
      />

      {!forecastData ? (
        <EmptyState message="Loading forecast data..." />
      ) : (
        <>
          <div className="forecast-total">
            <strong>{forecastData.total_estimated_refills ?? 0}</strong>
            <span>estimated refill events across three days</span>
          </div>

          <div className="forecast-list">
            {forecast.map((day) => (
              <div className="forecast-row" key={day.day_number}>
                <div className="forecast-row-top">
                  <strong>{day.day}</strong>
                  <span>{day.estimated_refills} households</span>
                </div>

                <div className="forecast-track">
                  <div
                    className="forecast-fill"
                    style={{
                      width: `${
                        ((day.estimated_refills ?? 0) / maximum) * 100
                      }%`,
                    }}
                  />
                </div>

                <div className="forecast-split">
                  <span>Urban: {day.urban}</span>
                  <span>Rural: {day.rural}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="footnote">
            {forecastData.note ??
              "Forecasts are based on simulated household records."}
          </p>
        </>
      )}
    </section>
  );
}

function PriorityPanel({ priorityData }) {
  return (
    <section className="panel">
      <SectionHeading
        title="Refill Priority Queue"
        description="Households ranked by estimated urgency"
      />

      {priorityData.length === 0 ? (
        <EmptyState message="No priority records available." />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Household</th>
                <th>Area</th>
                <th>Fuel</th>
                <th>Days left</th>
                <th>Urgency</th>
              </tr>
            </thead>

            <tbody>
              {priorityData.slice(0, 10).map((home) => (
                <tr key={home.id}>
                  <td className="primary-cell">{home.id}</td>
                  <td>{home.area}</td>
                  <td>
                    <span className="fuel-value">{home.fuel}%</span>
                  </td>
                  <td>{home.days}</td>
                  <td>
                    <span
                      className={`urgency-pill ${(
                        home.urgency ?? home.status ?? "normal"
                      ).toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {home.urgency ?? home.status ?? "Normal"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="footnote">
        Priority is calculated from simulated remaining-fuel estimates, not
        live sensor measurements.
      </p>
    </section>
  );
}

function AreasPanel({ areaData }) {
  return (
    <section className="panel">
      <SectionHeading
        title="Area Intelligence"
        description="Compare estimated refill demand across monitored areas"
      />

      {areaData.length === 0 ? (
        <EmptyState message="No area data available." />
      ) : (
        <div className="area-grid">
          {areaData.map((area) => (
            <article className="area-card" key={area.area}>
              <div className="area-card-top">
                <div className="area-icon">
                  <MapPin size={17} />
                </div>
                <span className="area-type">{area.type}</span>
              </div>

              <h3>{area.area}</h3>

              <div className="area-refills">
                {area.refills_due_soon}
                <span>refills due within 3 days</span>
              </div>

              <div className="area-stat-list">
                <div>
                  <span>Priority households</span>
                  <strong>{area.priority_households}</strong>
                </div>
                <div>
                  <span>Average fuel</span>
                  <strong>{area.average_fuel_percent ?? 0}%</strong>
                </div>
                <div>
                  <span>Total households</span>
                  <strong>{area.total_households}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function IncidentsPanel({
  incidents,
  onAcknowledge,
  updatingIncident,
}) {
  return (
    <section className="panel">
      <SectionHeading
        title="Safety Incident Centre"
        description="Review and acknowledge simulated safety alerts"
        action={
          <span className="tag">
            {incidents.filter((item) => item.status === "Open").length} OPEN
          </span>
        }
      />

      {incidents.length === 0 ? (
        <EmptyState message="No incidents recorded." />
      ) : (
        <div className="incident-list">
          {incidents.map((incident) => (
            <article className="incident-row" key={incident.id}>
              <div
                className={`incident-icon ${
                  incident.level.toLowerCase() === "critical"
                    ? "critical"
                    : "warning"
                }`}
              >
                {incident.level.toLowerCase() === "critical" ? (
                  <AlertTriangle size={20} />
                ) : (
                  <Activity size={20} />
                )}
              </div>

              <div className="incident-content">
                <div className="incident-title-row">
                  <h3>{incident.title}</h3>
                  <span
                    className={`level-pill ${incident.level.toLowerCase()}`}
                  >
                    {incident.level}
                  </span>
                </div>

                <p>{incident.area}</p>

                <div className="incident-meta">
                  <span>
                    <Clock3 size={13} />
                    {formatTime(incident.time)}
                  </span>
                  <span>#{incident.id}</span>
                </div>
              </div>

              <div className="incident-actions">
                <span
                  className={`status-pill ${incident.status.toLowerCase()}`}
                >
                  {incident.status}
                </span>

                {incident.status === "Open" && (
                  <button
                    className="secondary-button"
                    onClick={() => onAcknowledge(incident.id)}
                    disabled={updatingIncident === incident.id}
                  >
                    <Check size={15} />
                    {updatingIncident === incident.id
                      ? "Saving..."
                      : "Acknowledge"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HouseholdsPanel({
  households,
  search,
  setSearch,
  filter,
  setFilter,
}) {
  const visibleHouseholds = households.filter((home) => {
    const matchesSearch = `${home.id} ${home.area} ${home.type}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesType = filter === "All" || home.type === filter;

    return matchesSearch && matchesType;
  });

  return (
    <section className="panel">
      <SectionHeading
        title="Household Monitoring"
        description={`${visibleHouseholds.length} households shown`}
      />

      <div className="table-controls">
        <div className="search-box">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search household or area..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              className="icon-button clear-search"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter household type"
        >
          <option value="All">All households</option>
          <option value="Urban">Urban</option>
          <option value="Rural">Rural</option>
        </select>
      </div>

      {visibleHouseholds.length === 0 ? (
        <EmptyState message="No households match your search." />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Household ID</th>
                <th>Area</th>
                <th>Type</th>
                <th>Fuel</th>
                <th>Days left</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {visibleHouseholds.slice(0, 100).map((home) => (
                <tr key={home.id}>
                  <td className="primary-cell">{home.id}</td>
                  <td>{home.area}</td>
                  <td>{home.type}</td>
                  <td>
                    <div className="fuel-cell">
                      <div className="mini-fuel-track">
                        <div
                          className={`mini-fuel-fill ${
                            home.fuel <= 20 ? "low" : ""
                          }`}
                          style={{ width: `${home.fuel}%` }}
                        />
                      </div>
                      <span>{home.fuel}%</span>
                    </div>
                  </td>
                  <td>{home.days}</td>
                  <td>
                    <span
                      className={`status-pill ${home.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {home.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="footnote">
        Showing up to 100 matching records. Search and type filters apply to
        the loaded household data.
      </p>
    </section>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [households, setHouseholds] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [priorityData, setPriorityData] = useState([]);
  const [areaData, setAreaData] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingIncident, setUpdatingIncident] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const [
        householdsRes,
        incidentsRes,
        summaryRes,
        forecastRes,
        prioritiesRes,
        areasRes,
      ] = await Promise.all([
        fetch(`${API}/households`),
        fetch(`${API}/incidents`),
        fetch(`${API}/summary`),
        fetch(`${API}/forecast`),
        fetch(`${API}/priorities`),
        fetch(`${API}/areas`),
      ]);

      const responses = [
        householdsRes,
        incidentsRes,
        summaryRes,
        forecastRes,
        prioritiesRes,
        areasRes,
      ];

      if (responses.some((response) => !response.ok)) {
        throw new Error("One or more API endpoints returned an error.");
      }

      const [
        householdData,
        incidentData,
        summaryResult,
        forecastResult,
        priorityResult,
        areaResult,
      ] = await Promise.all(responses.map((response) => response.json()));

      setHouseholds(householdData);
      setIncidents(incidentData);
      setSummary(summaryResult);
      setForecastData(forecastResult);
      setPriorityData(priorityResult.priorities ?? []);
      setAreaData(areaResult.areas ?? []);
      setApiError("");
    } catch (error) {
      console.error("PyroSense data loading failed:", error);
      setApiError(
        "Cannot load all PyroSense data. Check that Flask is running on port 5000 and all six API endpoints are available."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function acknowledgeIncident(id) {
    setUpdatingIncident(id);
    setApiError("");

    try {
      const response = await fetch(`${API}/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Acknowledged" }),
      });

      if (!response.ok) {
        throw new Error("Incident update failed.");
      }

      await loadData();
    } catch (error) {
      console.error("Incident acknowledgement failed:", error);
      setApiError("Could not acknowledge the incident. Please try again.");
    } finally {
      setUpdatingIncident("");
    }
  }

  const openIncidents = incidents.filter(
    (incident) => incident.status === "Open"
  ).length;

  const activeItem =
    NAV_ITEMS.find((item) => item.label === activeNav) ?? NAV_ITEMS[0];

  function renderActiveView() {
    if (activeNav === "Safety Centre") {
      return (
        <IncidentsPanel
          incidents={incidents}
          onAcknowledge={acknowledgeIncident}
          updatingIncident={updatingIncident}
        />
      );
    }

    if (activeNav === "Fuel Intelligence") {
      return (
        <>
          <ForecastPanel forecastData={forecastData} />
          <PriorityPanel priorityData={priorityData} />
        </>
      );
    }

    if (activeNav === "Distribution") {
      return (
        <>
          <AreasPanel areaData={areaData} />
          <HouseholdsPanel
            households={households}
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
          />
        </>
      );
    }

    if (activeNav === "Territory Map") {
      return (
        <>
          <section className="panel map-intro">
            <div className="map-intro-icon">
              <MapPinned size={25} />
            </div>
            <div>
              <h2>Territory Intelligence</h2>
              <p>
                Area-level distribution overview for the five simulated
                operating areas. This view is not a live geographic map.
              </p>
            </div>
          </section>
          <AreasPanel areaData={areaData} />
        </>
      );
    }

    return (
      <>
        <div className="metrics-grid">
          <MetricCard
            icon={Users}
            label="Households Monitored"
            value={summary?.households_monitored}
            detail="Simulated household records"
            tone="orange"
          />
          <MetricCard
            icon={CalendarClock}
            label="Refills Due Soon"
            value={summary?.refills_due_soon}
            detail="Estimated within 3 days"
            tone="blue"
          />
          <MetricCard
            icon={ShieldAlert}
            label="Open Incidents"
            value={summary?.open_incidents}
            detail="Require review"
            tone="red"
          />
          <MetricCard
            icon={TrendingUp}
            label="Distribution Coverage"
            value={
              summary
                ? `${summary.distribution_coverage_percent}%`
                : "—"
            }
            detail="Illustrative demo metric"
            tone="green"
          />
        </div>

        <div className="dashboard-grid">
          <ForecastPanel forecastData={forecastData} />
          <IncidentsPanel
            incidents={incidents}
            onAcknowledge={acknowledgeIncident}
            updatingIncident={updatingIncident}
          />
        </div>

        <PriorityPanel priorityData={priorityData} />
        <AreasPanel areaData={areaData} />

        <HouseholdsPanel
          households={households}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
        />
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Flame size={25} />
          </div>
          <div>
            <h1>PyroSense</h1>
            <span>LPG INTELLIGENCE</span>
          </div>
        </div>

        <div className="nav-caption">WORKSPACE</div>

        <nav className="side-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.label;

            return (
              <button
                className={`nav-item ${isActive ? "active" : ""}`}
                key={item.label}
                onClick={() => setActiveNav(item.label)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.label === "Safety Centre" && openIncidents > 0 && (
                  <span className="nav-count">{openIncidents}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            <div>
              <strong>Demo environment</strong>
              <span>Simulated data only</span>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="avatar">PS</div>
            <div>
              <strong>Operations</strong>
              <span>Demo workspace</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>PyroSense</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{activeNav}</strong>
          </div>

          <div className="topbar-actions">
            <span className="environment-label">
              <span className="status-dot" />
              SIMULATION
            </span>

            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                onClick={() => setShowNotifications((current) => !current)}
                aria-label="Toggle notifications"
              >
                <Bell size={19} />
                {openIncidents > 0 && <span className="notification-dot" />}
              </button>

              {showNotifications && (
                <div className="notification-popover">
                  <div className="popover-title">Notifications</div>
                  {openIncidents > 0 ? (
                    <p>
                      <AlertTriangle size={15} />
                      {openIncidents} open simulated incident
                      {openIncidents === 1 ? "" : "s"} need review.
                    </p>
                  ) : (
                    <p>
                      <CheckCircle2 size={15} />
                      No open incidents right now.
                    </p>
                  )}
                  <button
                    className="popover-link"
                    onClick={() => {
                      setActiveNav("Safety Centre");
                      setShowNotifications(false);
                    }}
                  >
                    Open Safety Centre
                  </button>
                </div>
              )}
            </div>

            <button
              className="icon-button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
            >
              <RefreshCw
                size={18}
                className={refreshing ? "spinning" : ""}
              />
            </button>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <Activity size={15} />
                LPG SAFETY & DISTRIBUTION PLATFORM
              </div>
              <h1>{activeNav}</h1>
              <p>
                {activeNav === "Overview"
                  ? "Your operational snapshot across household fuel demand, safety incidents, and distribution."
                  : activeNav === "Fuel Intelligence"
                    ? "Explore simulated refill demand and household priority rankings."
                    : activeNav === "Safety Centre"
                      ? "Review safety alerts and update their acknowledgement status."
                      : activeNav === "Distribution"
                        ? "Explore area-level refill demand and household records."
                        : "Explore distribution demand across monitored territories."}
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "spinning" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh data"}
            </button>
          </section>

          {apiError && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              <span>{apiError}</span>
              <button onClick={() => loadData(true)}>Retry</button>
            </div>
          )}

          <div className="data-notice">
            <div className="notice-icon">
              <Activity size={17} />
            </div>
            <div>
              <strong>Backend connected to the demo interface</strong>
              <p>
                Household records, forecasts, and incidents are served by
                Flask and SQLite. All household readings are simulated.
              </p>
            </div>
            <span className="tag">DEMO</span>
          </div>

          {loading && !summary ? (
            <div className="loading-state">
              <RefreshCw size={22} className="spinning" />
              <span>Loading PyroSense intelligence...</span>
            </div>
          ) : (
            <div className="view-content">{renderActiveView()}</div>
          )}

          <footer className="app-footer">
            <span>PyroSense · Software prototype</span>
            <span>
              <span className="status-dot" />
              Not connected to live LPG sensors or gas controls
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
