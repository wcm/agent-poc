import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_FILTERS = {
  dateFrom: "",
  dateTo: "",
  category: "",
  topic: "",
  suggested: "",
  plan: "",
};

function formatTag(tag) {
  const category = tag?.category ?? "";
  const topic = tag?.topic ?? "";
  return `${category} - ${topic}`.replace(/_/g, " ").trim();
}

const CATEGORY_COLORS = {
  data_analysis: "#22c55e",
  recommendation: "#eab308",
  action: "#f97316",
  other: "#a855f7",
};

const TAG_DETAILS = {
  data_analysis: {
    label: "Data Analysis",
    topics: {
      query: {
        description: "Direct requests to retrieve or compute data.",
        examples: [
          "How many ads were uploaded last month?",
          "What are my top ads from last week?",
        ],
      },
      general: {
        description: "High-level performance or broad analysis requests.",
        examples: [
          "How is the ad account doing this month?",
          "Why are my best ads performing well?",
        ],
      },
      comparison: {
        description: "Compare performance across time, assets, or segments.",
        examples: [
          "Compare performance between this week and last week.",
          "Which ads performed best vs worst in January?",
        ],
      },
      benchmarking: {
        description: "Evaluate metrics against norms or averages.",
        examples: [
          "How good is 1.76?",
          "What is the average click to purchase percentage?",
        ],
      },
      creative_insights: {
        description: "Insights on creative themes, hooks, or formats.",
        examples: [
          "What are our top 10 best static non-UGC creatives?",
          "Summarize angles of top performing images.",
        ],
      },
      audience: {
        description: "Audience segmentation, targeting, or demographics.",
        examples: [
          "Can I break down ages in Atria?",
          "Which audiences should I exclude?",
        ],
      },
    },
  },
  recommendation: {
    label: "Recommendation",
    topics: {
      operation: {
        description: "Suggested actions to improve performance.",
        examples: [
          "Given my trends, what actions should I take?",
          "Which ads should I pause?",
        ],
      },
      creative_iteration: {
        description: "Recommendations to iterate or improve creatives.",
        examples: [
          "How can I improve the hook rate on this ad?",
          "What changes should I make to this creative?",
        ],
      },
    },
  },
  action: {
    label: "Action",
    topics: {
      export: {
        description: "Export or share outputs.",
        examples: [
          "Can you export this as a PDF?",
          "Export the report for the last 2 weeks.",
        ],
      },
      create_edit_report: {
        description: "Create or edit reports in the product.",
        examples: [
          "Create a report for campaigns with \"BB\".",
          "Can I make reports and share with clients?",
        ],
      },
      ad_iteration: {
        description: "Requests to clone or iterate ads.",
        examples: [
          "How do I clone ads in Atria?",
          "Create iterations for this ad.",
        ],
      },
      create_file: {
        description: "Generate files like emails or spreadsheets.",
        examples: [
          "Send me emails of top performing creatives.",
          "Create a spreadsheet of top ads.",
        ],
      },
    },
  },
  other: {
    label: "Other",
    topics: {
      unspecified: {
        description: "Fallback when no other tag fits.",
        examples: [
          "I want only AUS campaigns.",
          "How can I see the exact batch number of the ads?",
        ],
      },
      follow_up_clarification: {
        description: "Clarifying questions or follow-ups.",
        examples: [
          "Can you try it again?",
          "Are you pulling that hold rate from videos only?",
        ],
      },
      atria_support: {
        description: "Support or account-related questions.",
        examples: [
          "Where can I find my invoices?",
          "Can you help with account setup?",
        ],
      },
    },
  },
};

function parseDate(value) {
  if (!value) {
    return null;
  }
  const [datePart, timePart] = value.trim().split(" ");
  if (!datePart || !timePart) {
    return null;
  }
  const [time, fractional] = timePart.split(".");
  const ms = fractional ? fractional.slice(0, 3).padEnd(3, "0") : "000";
  const iso = `${datePart}T${time}.${ms}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePlanType(value) {
  if (!value) {
    return "unknown";
  }
  return String(value).replace(/^(month_|year_)/, "");
}

function getDateKey(value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "Unknown";
  }
  return parsed.toISOString().slice(0, 10);
}

function computeCounts(values) {
  const counts = new Map();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return counts;
}

function toSortedEntries(map) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [metadata, setMetadata] = useState({
    categories: [],
    topics: [],
    recurring_plan_type: [],
    suggested: [],
    min_date: "",
    max_date: "",
  });
  const [availableTopics, setAvailableTopics] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("user_id");
  const [sortDir, setSortDir] = useState("asc");
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  const userChartRef = useRef(null);
  const dateChartRef = useRef(null);
  const categoryChartRef = useRef(null);
  const comboChartRef = useRef(null);
  const planChartRef = useRef(null);
  const planUsersChartRef = useRef(null);
  const suggestedChartRef = useRef(null);
  const activeDaysChartRef = useRef(null);

  useEffect(() => {
    fetch("/user-query-analysis/api/metadata")
      .then((res) => res.json())
      .then((data) => {
        const suggestedValues = Array.isArray(data.suggested)
          ? data.suggested
          : [];
        if (!suggestedValues.includes("no")) {
          suggestedValues.push("no");
        }
        setMetadata({ ...data, suggested: suggestedValues });
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!filters.category) {
      setAvailableTopics(metadata.topics || []);
      return;
    }

    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters.dateTo) params.set("date_to", filters.dateTo);
    if (filters.category) params.set("category", filters.category);
    if (filters.suggested) params.set("suggested", filters.suggested);
    if (filters.plan) params.set("recurring_plan_type", filters.plan);

    fetch(`/user-query-analysis/api/records?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const topics = new Set();
        (data.records || []).forEach((record) => {
          (record.tags || []).forEach((tag) => {
            if (tag?.category === filters.category && tag?.topic) {
              topics.add(tag.topic);
            }
          });
        });
        setAvailableTopics(Array.from(topics).sort());
      })
      .catch(() => setAvailableTopics([]));
  }, [
    filters.category,
    filters.dateFrom,
    filters.dateTo,
    filters.suggested,
    filters.plan,
    metadata.topics,
  ]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters.dateTo) params.set("date_to", filters.dateTo);
    if (filters.category) params.set("category", filters.category);
    if (filters.topic) params.set("topic", filters.topic);
    if (filters.suggested) params.set("suggested", filters.suggested);
    if (filters.plan) params.set("recurring_plan_type", filters.plan);

    setLoading(true);
    fetch(`/user-query-analysis/api/records?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setRecords(data.records || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [filters]);

  const metrics = useMemo(() => {
    const totalQueries = records.length;
    const users = new Set(records.map((r) => r.user_id).filter(Boolean));
    const totalUsers = users.size;
    const avgQueries =
      totalUsers > 0 ? (totalQueries / totalUsers).toFixed(2) : "0.00";
    const dateCounts = computeCounts(records.map((r) => getDateKey(r.created_at)));
    const dayCount = dateCounts.size || 0;
    const avgPerDay =
      dayCount > 0 ? (totalQueries / dayCount).toFixed(2) : "0.00";
    return { totalQueries, totalUsers, avgQueries, avgPerDay };
  }, [records]);

  const tableRows = useMemo(() => {
    const sorted = [...records];
    sorted.sort((a, b) => {
      let left = a[sortKey];
      let right = b[sortKey];
      if (sortKey === "created_at") {
        left = parseDate(a.created_at)?.getTime() || 0;
        right = parseDate(b.created_at)?.getTime() || 0;
      }
      if (left == null) return 1;
      if (right == null) return -1;
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [records, sortKey, sortDir]);

  useEffect(() => {
    if (!window.Plotly) {
      return;
    }

    const userCounts = computeCounts(records.map((r) => r.user_id));
    const queryCountsPerUser = Array.from(userCounts.values());
    const userBins = new Map();
    for (let i = 1; i <= 10; i += 1) {
      userBins.set(String(i), 0);
    }
    userBins.set("10+", 0);
    queryCountsPerUser.forEach((count) => {
      const key = count > 10 ? "10+" : String(count);
      userBins.set(key, (userBins.get(key) || 0) + 1);
    });
    const userBinEntries = Array.from(userBins.entries());

    const dateCounts = computeCounts(records.map((r) => getDateKey(r.created_at)));
    const dateEntries = Array.from(dateCounts.entries()).sort(
      (a, b) => a[0].localeCompare(b[0])
    );

    const categoryCounts = new Map();
    const comboCounts = new Map();
    records.forEach((record) => {
      (record.tags || []).forEach((tag) => {
        if (!tag?.topic || !tag?.category) return;
        categoryCounts.set(
          tag.category,
          (categoryCounts.get(tag.category) || 0) + 1
        );
        const combo = `${tag.category} - ${tag.topic}`;
        comboCounts.set(combo, (comboCounts.get(combo) || 0) + 1);
      });
    });

    const planCounts = computeCounts(
      records.map((r) => normalizePlanType(r.recurring_plan_type))
    );
    const planUsers = new Map();
    records.forEach((record) => {
      const planKey = normalizePlanType(record.recurring_plan_type);
      const userId = record.user_id;
      if (!planUsers.has(planKey)) {
        planUsers.set(planKey, new Set());
      }
      if (userId) {
        planUsers.get(planKey).add(userId);
      }
    });
    const planOrder = ["trial", "core", "plus", "business", "enterprise", "basic"];
    const getPlanRank = (value) => {
      const index = planOrder.indexOf(value);
      return index === -1 ? planOrder.length : index;
    };
    const suggestedCounts = new Map();
    const suggestedValues = (() => {
      const base = metadata.suggested && metadata.suggested.length > 0
        ? metadata.suggested
        : ["no", "1", "2", "3"];
      const normalized = base.map(String);
      if (!normalized.includes("no")) {
        normalized.unshift("no");
      }
      return Array.from(new Set(normalized));
    })();
    suggestedValues.forEach((value) => suggestedCounts.set(value, 0));
    records.forEach((record) => {
      const value = record.suggested || "no";
      suggestedCounts.set(value, (suggestedCounts.get(value) || 0) + 1);
    });

    window.Plotly.react(
      userChartRef.current,
      [
        {
          x: userBinEntries.map(([key]) => key),
          y: userBinEntries.map(([, value]) => value),
          type: "bar",
          marker: { color: "#2563eb" },
          text: userBinEntries.map(([, value]) => value),
          textposition: "outside",
          texttemplate: "%{text}",
          cliponaxis: false,
        },
      ],
      {
        margin: { t: 20, r: 10, b: 40, l: 40 },
        xaxis: { title: "", type: "category" },
        yaxis: { title: "Number of Users", tickformat: "d" },
      },
      { displayModeBar: false, responsive: true }
    );

    window.Plotly.react(
      dateChartRef.current,
      [
        {
          x: dateEntries.map(([key]) => key),
          y: dateEntries.map(([, value]) => value),
          type: "bar",
          marker: { color: "#2563eb" },
          text: dateEntries.map(([, value]) => value),
          textposition: "outside",
          texttemplate: "%{text}",
          cliponaxis: false,
        },
      ],
      {
        margin: { t: 20, r: 10, b: 40, l: 40 },
        xaxis: { title: "" },
        yaxis: { title: "Queries" },
      },
      { displayModeBar: false, responsive: true }
    );

    const categoryEntries = toSortedEntries(categoryCounts);
    window.Plotly.react(
      categoryChartRef.current,
      [
        {
          x: categoryEntries.map(([key]) => key.replace(/_/g, " ")),
          y: categoryEntries.map(([, value]) => value),
          type: "bar",
          marker: {
            color: categoryEntries.map(([key]) => CATEGORY_COLORS[key] || "#2563eb"),
          },
          text: categoryEntries.map(([, value]) => value),
          textposition: "outside",
          texttemplate: "%{text}",
          cliponaxis: false,
        },
      ],
      {
        margin: { t: 20, r: 10, b: 80, l: 40 },
        xaxis: { title: "", tickangle: -30 },
        yaxis: { title: "Queries" },
      },
      { displayModeBar: false, responsive: true }
    );

    const comboEntries = toSortedEntries(comboCounts);
    window.Plotly.react(
      comboChartRef.current,
      [
        {
          x: comboEntries.map(([key]) => key.replace(/_/g, " ")),
          y: comboEntries.map(([, value]) => value),
          type: "bar",
          marker: {
            color: comboEntries.map(([key]) => {
              const category = key.split(" - ")[0];
              return CATEGORY_COLORS[category] || "#2563eb";
            }),
          },
          text: comboEntries.map(([, value]) => value),
          textposition: "outside",
          texttemplate: "%{text}",
          cliponaxis: false,
        },
      ],
      {
        margin: { t: 20, r: 10, b: 100, l: 40 },
        xaxis: { title: "", tickangle: -30 },
        yaxis: { title: "Queries" },
      },
      { displayModeBar: false, responsive: true }
    );

    const planEntries = toSortedEntries(planCounts).sort(
      ([left], [right]) => getPlanRank(left) - getPlanRank(right)
    );
    window.Plotly.react(
      planChartRef.current,
      [
        {
          x: planEntries.map(([key]) => key.replace(/_/g, " ")),
          y: planEntries.map(([, value]) => value),
          type: "bar",
          marker: { color: "#2563eb" },
          text: planEntries.map(([, value]) => value),
          textposition: "outside",
          texttemplate: "%{text}",
          cliponaxis: false,
        },
      ],
      {
        margin: { t: 20, r: 10, b: 60, l: 40 },
        xaxis: { title: "", tickangle: -20 },
        yaxis: { title: "Queries" },
      },
      { displayModeBar: false, responsive: true }
    );

    const planUserEntries = Array.from(planUsers.entries())
      .map(([key, users]) => [key, users.size])
      .sort(([left], [right]) => getPlanRank(left) - getPlanRank(right));
    window.Plotly.react(
      planUsersChartRef.current,
      [
        {
          x: planUserEntries.map(([key]) => String(key).replace(/_/g, " ")),
          y: planUserEntries.map(([, value]) => value),
          type: "bar",
          marker: { color: "#2563eb" },
          text: planUserEntries.map(([, value]) => value),
          textposition: "outside",
          texttemplate: "%{text}",
          cliponaxis: false,
        },
      ],
      {
        margin: { t: 20, r: 10, b: 60, l: 40 },
        xaxis: { title: "", tickangle: -20 },
        yaxis: { title: "Number of Users", tickformat: "d" },
      },
      { displayModeBar: false, responsive: true }
    );

    const suggestedEntries = Array.from(suggestedCounts.entries());
    window.Plotly.react(
      suggestedChartRef.current,
      [
        {
          x: suggestedEntries.map(([key]) => key),
          y: suggestedEntries.map(([, value]) => value),
          type: "bar",
          marker: { color: "#2563eb" },
          text: suggestedEntries.map(([, value]) => value),
          textposition: "outside",
          texttemplate: "%{text}",
          cliponaxis: false,
        },
      ],
      {
        margin: { t: 20, r: 10, b: 40, l: 40 },
        xaxis: {
          title: "",
          type: "category",
          categoryorder: "array",
          categoryarray: suggestedEntries.map(([key]) => key),
        },
        yaxis: { title: "Queries" },
      },
      { displayModeBar: false, responsive: true }
    );

    const activeDaysByUser = new Map();
    records.forEach((record) => {
      const userId = record.user_id;
      if (!userId) return;
      const dayKey = getDateKey(record.created_at);
      if (!activeDaysByUser.has(userId)) {
        activeDaysByUser.set(userId, new Set());
      }
      activeDaysByUser.get(userId).add(dayKey);
    });
    const activeDayCounts = new Map();
    activeDaysByUser.forEach((days) => {
      const count = days.size;
      activeDayCounts.set(count, (activeDayCounts.get(count) || 0) + 1);
    });
    const activeDayEntries = Array.from(activeDayCounts.entries()).sort(
      (a, b) => a[0] - b[0]
    );

    window.Plotly.react(
      activeDaysChartRef.current,
      [
        {
          x: activeDayEntries.map(([key]) => String(key)),
          y: activeDayEntries.map(([, value]) => value),
          type: "bar",
          marker: { color: "#2563eb" },
          text: activeDayEntries.map(([, value]) => value),
          textposition: "outside",
          texttemplate: "%{text}",
          cliponaxis: false,
        },
      ],
      {
        margin: { t: 20, r: 10, b: 40, l: 40 },
        xaxis: { title: "", type: "category" },
        yaxis: { title: "Number of Users", tickformat: "d" },
      },
      { displayModeBar: false, responsive: true }
    );
  }, [records, metadata.suggested]);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <main>
      <h1>Query Dashboard</h1>
      <p className="subtitle">
        Filter and explore user questions, tags, and suggested intents.
      </p>
      <button
        className="tag-details-button"
        type="button"
        onClick={() => setIsTagModalOpen(true)}
      >
        Tag Details
      </button>

      {isTagModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Tag Details"
          onClick={() => setIsTagModalOpen(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Tag Details</h2>
              <button
                className="modal-close"
                type="button"
                onClick={() => setIsTagModalOpen(false)}
              >
                Close
              </button>
            </div>
            {Object.entries(TAG_DETAILS).map(([category, config]) => (
              <section className="tag-category" key={category}>
                <div className="tag-category-title">
                  <h3>{config.label}</h3>
                </div>
                <div className="tag-category-grid">
                  {Object.entries(config.topics).map(([topic, detail]) => (
                    <div className="tag-detail-card" key={`${category}-${topic}`}>
                      <div className="tag-detail-title">
                        <span
                          className="tag-pill"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[category] || "#2563eb",
                          }}
                        >
                          {`${category.replace(/_/g, " ")} - ${topic.replace(/_/g, " ")}`}
                        </span>
                      </div>
                      <p className="tag-detail-desc">{detail.description}</p>
                      <div className="tag-detail-examples">
                        <div className="tag-detail-label">Examples</div>
                        <ul>
                          {detail.examples.map((example) => (
                            <li key={example}>{example}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <section className="filters">
        <div className="filter-card">
          <label>Date From</label>
          <input
            type="date"
            value={filters.dateFrom}
            min={metadata.min_date || undefined}
            max={metadata.max_date || undefined}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
            }
          />
        </div>
        <div className="filter-card">
          <label>Date To</label>
          <input
            type="date"
            value={filters.dateTo}
            min={metadata.min_date || undefined}
            max={metadata.max_date || undefined}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
            }
          />
        </div>
        <div className="filter-card">
          <label>User Plan Type</label>
          <select
            value={filters.plan}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, plan: event.target.value }))
            }
          >
            <option value="">All</option>
            {metadata.recurring_plan_type.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-card">
          <label>Suggested</label>
          <select
            value={filters.suggested}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, suggested: event.target.value }))
            }
          >
            <option value="">All</option>
            {metadata.suggested.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-card">
          <label>Tag Category</label>
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                category: event.target.value,
                topic: "",
              }))
            }
          >
            <option value="">All</option>
            {metadata.categories.map((category) => (
              <option key={category} value={category}>
                {category.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-card">
          <label>Tag Topic</label>
          <select
            value={filters.topic}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, topic: event.target.value }))
            }
          >
            <option value="">All</option>
            {availableTopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="kpis">
        <div className="kpi">
          <span>Total Queries</span>
          <strong>{metrics.totalQueries}</strong>
        </div>
        <div className="kpi">
          <span>Total Users</span>
          <strong>{metrics.totalUsers}</strong>
        </div>
        <div className="kpi">
          <span>Avg Queries / User</span>
          <strong>{metrics.avgQueries}</strong>
        </div>
        <div className="kpi">
          <span>Avg Queries / Day</span>
          <strong>{metrics.avgPerDay}</strong>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h3>Queries per User</h3>
          <div className="chart" ref={userChartRef} />
        </div>
        <div className="card">
          <h3>Active Days per User</h3>
          <div className="chart" ref={activeDaysChartRef} />
        </div>
        <div className="card">
          <h3>Plan Type per User</h3>
          <div className="chart" ref={planUsersChartRef} />
        </div>
        <div className="card">
          <h3>Queries per Day</h3>
          <div className="chart" ref={dateChartRef} />
        </div>
        <div className="card">
          <h3>Suggested Question</h3>
          <div className="chart" ref={suggestedChartRef} />
        </div>
        <div className="card">
          <h3>Queries per Plan Type</h3>
          <div className="chart" ref={planChartRef} />
        </div>
        <div className="card">
          <h3>Tag Category Distribution</h3>
          <div className="chart" ref={categoryChartRef} />
        </div>
        <div className="card double-column">
          <h3>Tag Category + Topic Distribution</h3>
          <div className="chart" ref={comboChartRef} />
        </div>
      </section>

      <section className="table-card">
        <div style={{ marginBottom: "8px" }}>
          <strong>Questions</strong>{" "}
          <span className="muted">
            {loading ? "Loading..." : `${records.length} records`}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort("user_id")}>
                User ID {sortKey === "user_id" ? `(${sortDir})` : ""}
              </th>
              <th>Query Text</th>
              <th onClick={() => handleSort("created_at")}>
                Created At {sortKey === "created_at" ? `(${sortDir})` : ""}
              </th>
              <th>Plan</th>
              <th>Tags</th>
              <th>Suggested</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let groupIndex = 0;
              let prevUser = null;
              return tableRows.map((row, index) => {
                if (row.user_id !== prevUser) {
                  groupIndex += 1;
                  prevUser = row.user_id;
                }
                const useAlt = groupIndex % 2 === 0;
                return (
                  <tr
                    key={`${row.user_id}-${index}`}
                    className={useAlt ? "row-alt" : undefined}
                  >
                    <td>{row.user_id}</td>
                    <td>{row.text}</td>
                    <td>{row.created_at}</td>
                    <td>{row.recurring_plan_type}</td>
                    <td>
                      {(row.tags || []).map((tag, tagIndex) => {
                        const label = formatTag(tag);
                        const color = CATEGORY_COLORS[tag?.category] || "#2563eb";
                        return (
                          <span
                            key={`${row.user_id}-${index}-tag-${tagIndex}`}
                            className="tag-pill"
                            style={{ backgroundColor: color }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </td>
                    <td>
                      <span className="pill">{row.suggested || "no"}</span>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </section>
    </main>
  );
}
