import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { X, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, Play, Filter, Layers } from "lucide-react";
import { AnalyticsDashboardView, Integration } from "../../types";

interface AdMetrics {
	spend: number;
	cost_per_lead: number;
	roas: number;
	cpa: number;
	aov: number;
	purchase_value: number;
	ctr: number;
	cpc: number;
	impressions: number;
	clicks: number;
	click_to_atc: number;
	atc_to_purchase: number;
}

interface AnalyticsAd {
	id: string;
	integration_id?: string;
	ad_name: string;
	creative_name?: string;
	headline: string;
	ad_copy?: string;
	image_url: string;
	display_format: "image" | "video";
	video_length?: string;
	status: "active" | "inactive" | "mixed";
	start_date: string;
	end_date: string | null;
	metrics: AdMetrics;
	ad_count?: number;
	group_value?: string;
}

interface AnalyticsData {
	integrations: Integration[];
	ads: AnalyticsAd[];
	groupBy?: string;
}

type GroupByOption = "ad_name" | "creative_name" | "headline" | "ad_copy";
const GROUP_BY_OPTIONS: { value: GroupByOption; label: string }[] = [
	{ value: "ad_name", label: "Ad Name" },
	{ value: "creative_name", label: "Creative Name" },
	{ value: "headline", label: "Headline" },
	{ value: "ad_copy", label: "Ad Copy" },
];

const METRIC_CONFIG: Record<string, { label: string; format: (v: number) => string; color: string }> = {
	spend: { label: "Spend", format: (v) => `$${v.toLocaleString()}`, color: "#6366f1" },
	cost_per_lead: { label: "Cost per Lead", format: (v) => `$${v.toFixed(2)}`, color: "#8b5cf6" },
	roas: { label: "ROAS", format: (v) => v.toFixed(2), color: "#22c55e" },
	cpa: { label: "CPA", format: (v) => `$${v.toFixed(2)}`, color: "#f59e0b" },
	aov: { label: "AOV", format: (v) => `$${v.toFixed(2)}`, color: "#ec4899" },
	purchase_value: { label: "Purchase Value", format: (v) => `$${v.toLocaleString()}`, color: "#14b8a6" },
	ctr: { label: "CTR", format: (v) => `${v.toFixed(2)}%`, color: "#3b82f6" },
	cpc: { label: "CPC", format: (v) => `$${v.toFixed(2)}`, color: "#ef4444" },
	impressions: { label: "Impressions", format: (v) => v.toLocaleString(), color: "#64748b" },
	clicks: { label: "Clicks", format: (v) => v.toLocaleString(), color: "#0ea5e9" },
	click_to_atc: { label: "Click to ATC", format: (v) => `${v.toFixed(1)}%`, color: "#a855f7" },
	atc_to_purchase: { label: "ATC to Purchase", format: (v) => `${v.toFixed(1)}%`, color: "#10b981" },
};

const MAX_CHART_ADS = 8;
const MAX_CHART_METRICS = 5;

const DASHBOARD_OPTIONS: Array<{ id: AnalyticsDashboardView; label: string }> = [
	{ id: "top_spend", label: "Top Spend" },
	{ id: "top_videos", label: "Top Videos" },
	{ id: "top_images", label: "Top Images" },
];

// Fixed bar widths for each metric count
const BAR_WIDTHS: Record<number, number> = {
	1: 40,
	2: 28,
	3: 22,
	4: 18,
	5: 14,
};

interface AnalyticsDashboardProps {
	integrations: Integration[];
	integrationId?: string;
	onIntegrationChange: (integrationId: string) => void;
	dashboardView: AnalyticsDashboardView;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ integrations, integrationId, onIntegrationChange, dashboardView }) => {
	const [data, setData] = useState<AnalyticsData | null>(null);
	const [loading, setLoading] = useState(true);

	// Filter & GroupBy state
	const [groupBy, setGroupBy] = useState<GroupByOption>("ad_name");
	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [filterStartDateFrom, setFilterStartDateFrom] = useState<string>("");
	const [filterStartDateTo, setFilterStartDateTo] = useState<string>("");
	const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
	const [groupByDropdownOpen, setGroupByDropdownOpen] = useState(false);

	// Chart state
	const [selectedChartMetrics, setSelectedChartMetrics] = useState<string[]>(["spend", "roas"]);
	const [metricSelectorOpen, setMetricSelectorOpen] = useState(false);

	// Table state
	const [selectedTableColumns, setSelectedTableColumns] = useState<string[]>(["spend", "roas", "cpa", "purchase_value", "ctr", "cpc"]);
	const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
	const [sortBy, setSortBy] = useState<string>("spend");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());

	// Refs for click-outside handling
	const metricDropdownRef = useRef<HTMLDivElement>(null);
	const columnDropdownRef = useRef<HTMLDivElement>(null);
	const filterDropdownRef = useRef<HTMLDivElement>(null);
	const groupByDropdownRef = useRef<HTMLDivElement>(null);

	const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3002" : "";
	const connectedIntegrations = useMemo(() => integrations.filter((integration) => integration.is_connected), [integrations]);
	const dashboardDisplayFormat = dashboardView === "top_videos" ? "video" : dashboardView === "top_images" ? "image" : "all";

	useEffect(() => {
		if (!integrationId && connectedIntegrations.length > 0) {
			onIntegrationChange(connectedIntegrations[0].id);
		}
	}, [integrationId, connectedIntegrations, onIntegrationChange]);

	// Build URL with query params
	const buildApiUrl = useCallback(() => {
		const params = new URLSearchParams();
		params.set("groupBy", groupBy);
		if (integrationId) {
			params.set("integration", integrationId);
		}
		if (dashboardDisplayFormat !== "all") {
			params.set("display_format", dashboardDisplayFormat);
		}
		if (filterStatus !== "all") {
			params.set("status", filterStatus);
		}
		if (filterStartDateFrom) {
			params.set("start_date_from", filterStartDateFrom);
		}
		if (filterStartDateTo) {
			params.set("start_date_to", filterStartDateTo);
		}
		return `${baseUrl}/api/own-analytics?${params.toString()}`;
	}, [baseUrl, integrationId, groupBy, dashboardDisplayFormat, filterStatus, filterStartDateFrom, filterStartDateTo]);

	// Fetch data when filters change
	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			try {
				const res = await fetch(buildApiUrl());
				if (res.ok) {
					const analyticsData = await res.json();
					setData(analyticsData);
					// Select top 8 ads by spend after data loads
					const top8Ids = [...analyticsData.ads]
						.sort((a: AnalyticsAd, b: AnalyticsAd) => (b.metrics.spend || 0) - (a.metrics.spend || 0))
						.slice(0, MAX_CHART_ADS)
						.map((ad: AnalyticsAd) => ad.id);
					setSelectedAds(new Set(top8Ids));
				}
			} catch (err) {
				console.error("Failed to fetch analytics:", err);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [buildApiUrl]);

	// Click outside handler for dropdowns
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (metricDropdownRef.current && !metricDropdownRef.current.contains(event.target as Node)) {
				setMetricSelectorOpen(false);
			}
			if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
				setColumnSelectorOpen(false);
			}
			if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
				setFilterDropdownOpen(false);
			}
			if (groupByDropdownRef.current && !groupByDropdownRef.current.contains(event.target as Node)) {
				setGroupByDropdownOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Sorted ads for table
	const sortedAds = useMemo(() => {
		if (!data?.ads) return [];
		return [...data.ads].sort((a, b) => {
			const valA = a.metrics[sortBy as keyof AdMetrics] || 0;
			const valB = b.metrics[sortBy as keyof AdMetrics] || 0;
			return sortOrder === "desc" ? valB - valA : valA - valB;
		});
	}, [data?.ads, sortBy, sortOrder]);

	// Chart data - only show selected ads (from table), sorted same as table
	const chartAds = useMemo(() => {
		if (!data?.ads || selectedChartMetrics.length === 0 || selectedAds.size === 0) return [];
		return [...data.ads]
			.filter((ad) => selectedAds.has(ad.id))
			.sort((a, b) => {
				const valA = a.metrics[sortBy as keyof AdMetrics] || 0;
				const valB = b.metrics[sortBy as keyof AdMetrics] || 0;
				return sortOrder === "desc" ? valB - valA : valA - valB;
			});
	}, [data?.ads, selectedChartMetrics, selectedAds, sortBy, sortOrder]);

	// Get bar width based on number of metrics (using fixed values)
	const barWidth = useMemo(() => {
		const metricCount = selectedChartMetrics.length;
		return BAR_WIDTHS[metricCount] || 14;
	}, [selectedChartMetrics.length]);

	// Max values for chart scaling
	const maxValues = useMemo(() => {
		const maxes: Record<string, number> = {};
		selectedChartMetrics.forEach((metric) => {
			maxes[metric] = Math.max(...chartAds.map((ad) => ad.metrics[metric as keyof AdMetrics] || 0));
		});
		return maxes;
	}, [chartAds, selectedChartMetrics]);

	const toggleChartMetric = (metric: string) => {
		if (selectedChartMetrics.includes(metric)) {
			if (selectedChartMetrics.length > 1) {
				setSelectedChartMetrics(selectedChartMetrics.filter((m) => m !== metric));
			}
		} else if (selectedChartMetrics.length < MAX_CHART_METRICS) {
			// Max 6 metrics, first 2 will be used for Y axes
			setSelectedChartMetrics([...selectedChartMetrics, metric]);
		}
	};

	const toggleTableColumn = (column: string) => {
		if (selectedTableColumns.includes(column)) {
			setSelectedTableColumns(selectedTableColumns.filter((c) => c !== column));
		} else {
			setSelectedTableColumns([...selectedTableColumns, column]);
		}
	};

	const toggleAdSelection = (adId: string) => {
		const newSelected = new Set(selectedAds);
		if (newSelected.has(adId)) {
			newSelected.delete(adId);
		} else if (newSelected.size < MAX_CHART_ADS) {
			// Only allow adding if under max limit
			newSelected.add(adId);
		}
		setSelectedAds(newSelected);
	};

	const toggleAllAds = () => {
		if (selectedAds.size > 0) {
			// If any selected, clear all
			setSelectedAds(new Set());
		} else {
			// Select top 8 by current sort
			const top8Ids = sortedAds.slice(0, MAX_CHART_ADS).map((ad) => ad.id);
			setSelectedAds(new Set(top8Ids));
		}
	};

	const handleSort = (column: string) => {
		let newSortBy = sortBy;
		let newSortOrder = sortOrder;

		if (sortBy === column) {
			newSortOrder = sortOrder === "desc" ? "asc" : "desc";
			setSortOrder(newSortOrder);
		} else {
			newSortBy = column;
			newSortOrder = "desc";
			setSortBy(newSortBy);
			setSortOrder(newSortOrder);
		}

		// Re-select top 8 ads based on new sort
		if (data?.ads) {
			const sorted = [...data.ads].sort((a, b) => {
				const valA = a.metrics[newSortBy as keyof AdMetrics] || 0;
				const valB = b.metrics[newSortBy as keyof AdMetrics] || 0;
				return newSortOrder === "desc" ? valB - valA : valA - valB;
			});
			const top8Ids = sorted.slice(0, MAX_CHART_ADS).map((ad) => ad.id);
			setSelectedAds(new Set(top8Ids));
		}
	};

	if (loading) return <div className="analytics-loading">Loading analytics...</div>;
	if (!data) return <div className="analytics-loading">Failed to load analytics data</div>;

	const activeIntegration = connectedIntegrations.find((integration) => integration.id === integrationId) || connectedIntegrations[0] || null;
	const activeFilterCount = (filterStatus !== "all" ? 1 : 0) + (filterStartDateFrom ? 1 : 0) + (filterStartDateTo ? 1 : 0);
	const hasActiveFilters = filterStatus !== "all" || filterStartDateFrom || filterStartDateTo;
	const showThumbnails = groupBy === "ad_name" || groupBy === "creative_name";

	if (connectedIntegrations.length === 0) {
		return (
			<div className="analytics-dashboard">
				<div className="analytics-header">
					<div className="analytics-header-copy">
						<h1>Analytics</h1>
						<p>Use the plus button in the sidebar to connect a integration and unlock analytics dashboards.</p>
					</div>
				</div>

				<div className="analytics-empty-state-card">
					<h2>No connected integrations yet</h2>
					<p>Connect a integration to start exploring Top Spend, Top Videos, and Top Images dashboards.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="analytics-dashboard">
			<div className="analytics-header">
				<div className="analytics-header-copy">
					<h1>{DASHBOARD_OPTIONS.find((option) => option.id === dashboardView)?.label ?? "Top Spend"}</h1>
					<p>{activeIntegration?.name ?? "Analytics"}</p>
				</div>
			</div>

			{/* Filter & GroupBy Controls */}
			<div className="analytics-filters">
				{/* Group By Dropdown */}
				<div className="filter-group" ref={groupByDropdownRef}>
					<button className="filter-btn" onClick={() => setGroupByDropdownOpen(!groupByDropdownOpen)}>
						<Layers size={16} />
						<span>Group by: {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}</span>
						<ChevronDown size={14} />
					</button>
					{groupByDropdownOpen && (
						<div className="filter-dropdown">
							{GROUP_BY_OPTIONS.map((option) => (
								<label key={option.value} className="filter-option">
									<input
										type="radio"
										name="groupBy"
										checked={groupBy === option.value}
										onChange={() => {
											setGroupBy(option.value);
											setGroupByDropdownOpen(false);
										}}
									/>
									{option.label}
								</label>
							))}
						</div>
					)}
				</div>

				{/* Filter Dropdown */}
				<div className="filter-group" ref={filterDropdownRef}>
					<button className={`filter-btn ${activeFilterCount > 0 ? "active" : ""}`} onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}>
						<Filter size={16} />
						<span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
						<ChevronDown size={14} />
					</button>
					{filterDropdownOpen && (
						<div className="filter-dropdown">
							<div className="filter-section">
								<div className="filter-section-title">Status</div>
								<label className="filter-option">
									<input type="radio" name="status" checked={filterStatus === "all"} onChange={() => setFilterStatus("all")} />
									All
								</label>
								<label className="filter-option">
									<input type="radio" name="status" checked={filterStatus === "active"} onChange={() => setFilterStatus("active")} />
									Active
								</label>
								<label className="filter-option">
									<input type="radio" name="status" checked={filterStatus === "inactive"} onChange={() => setFilterStatus("inactive")} />
									Inactive
								</label>
							</div>
							<div className="filter-section">
								<div className="filter-section-title">Start Date</div>
								<div className="filter-date-row">
									<label className="filter-date-label">From</label>
									<input type="date" className="filter-date-input" value={filterStartDateFrom} onChange={(e) => setFilterStartDateFrom(e.target.value)} />
								</div>
								<div className="filter-date-row">
									<label className="filter-date-label">To</label>
									<input type="date" className="filter-date-input" value={filterStartDateTo} onChange={(e) => setFilterStartDateTo(e.target.value)} />
								</div>
							</div>
							{hasActiveFilters && (
								<button
									className="clear-filters-btn"
									onClick={() => {
										setFilterStatus("all");
										setFilterStartDateFrom("");
										setFilterStartDateTo("");
									}}
								>
									Clear filters
								</button>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Metric Selector for Chart */}
			<div className="chart-controls" ref={metricDropdownRef}>
				<div className="metric-pills">
					{selectedChartMetrics.map((metric) => (
						<span key={metric} className="metric-pill" style={{ backgroundColor: METRIC_CONFIG[metric]?.color }}>
							{METRIC_CONFIG[metric]?.label}
							<X size={14} onClick={() => toggleChartMetric(metric)} />
						</span>
					))}
					<button className="add-metric-btn" onClick={() => setMetricSelectorOpen(!metricSelectorOpen)}>
						+ Add metric
					</button>
				</div>
				{metricSelectorOpen && (
					<div className="metric-dropdown">
						{Object.entries(METRIC_CONFIG).map(([key, config]) => (
							<label key={key} className="metric-option">
								<input
									type="checkbox"
									checked={selectedChartMetrics.includes(key)}
									onChange={() => toggleChartMetric(key)}
									disabled={!selectedChartMetrics.includes(key) && selectedChartMetrics.length >= MAX_CHART_METRICS}
								/>
								<span style={{ color: config.color }}>●</span> {config.label}
							</label>
						))}
						<div className="metric-dropdown-footer">Max {MAX_CHART_METRICS} metrics</div>
					</div>
				)}
			</div>

			{/* Bar Chart */}
			<div className="analytics-chart">
				<div className="chart-container">
					{/* Left Y-Axis */}
					<div className="chart-y-axis left">
						{selectedChartMetrics[0] && (
							<>
								<span className="y-axis-title" style={{ color: METRIC_CONFIG[selectedChartMetrics[0]]?.color }}>
									{METRIC_CONFIG[selectedChartMetrics[0]]?.label}
								</span>
								<div className="y-ticks">
									{[1, 0.75, 0.5, 0.25, 0].map((pct) => (
										<span key={pct}>{METRIC_CONFIG[selectedChartMetrics[0]]?.format(maxValues[selectedChartMetrics[0]] * pct)}</span>
									))}
								</div>
							</>
						)}
					</div>

					{/* Chart Area */}
					<div className="chart-main">
						<div className="chart-bars-area">
							{chartAds.map((ad) => (
								<div key={ad.id} className="bar-group">
									{selectedChartMetrics.map((metric, idx) => {
										const value = ad.metrics[metric as keyof AdMetrics] || 0;
										const maxVal = maxValues[metric] || 1;
										const height = (value / maxVal) * 100;
										return (
											<div key={metric} className="bar-wrapper">
												<div
													className="bar"
													style={{
														height: `${height}%`,
														backgroundColor: METRIC_CONFIG[metric]?.color,
														width: `${barWidth}px`,
													}}
												>
													<span className="bar-value">{METRIC_CONFIG[metric]?.format(value)}</span>
												</div>
											</div>
										);
									})}
								</div>
							))}
						</div>
						{/* X-Axis Labels (below zero line) */}
						<div className="chart-x-axis">
							{chartAds.map((ad) => (
								<div key={ad.id} className="x-axis-label">
									{showThumbnails && (
										<div className="bar-thumbnail">
											<img src={ad.image_url} alt={ad.ad_name} />
											{ad.display_format === "video" && (
												<div className="bar-video-indicator">
													<Play size={8} fill="white" color="white" />
												</div>
											)}
										</div>
									)}
									<span className="bar-label" title={groupBy !== "ad_name" && ad.group_value ? ad.group_value : ad.ad_name}>
										{groupBy !== "ad_name" && ad.group_value ? ad.group_value : ad.ad_name}
									</span>
									{(ad.ad_count || 1) > 1 && <span className="bar-ad-count">{ad.ad_count} ads</span>}
								</div>
							))}
						</div>
					</div>

					{/* Right Y-Axis */}
					<div className="chart-y-axis right">
						{selectedChartMetrics[1] && (
							<>
								<span className="y-axis-title" style={{ color: METRIC_CONFIG[selectedChartMetrics[1]]?.color }}>
									{METRIC_CONFIG[selectedChartMetrics[1]]?.label}
								</span>
								<div className="y-ticks">
									{[1, 0.75, 0.5, 0.25, 0].map((pct) => (
										<span key={pct}>{METRIC_CONFIG[selectedChartMetrics[1]]?.format(maxValues[selectedChartMetrics[1]] * pct)}</span>
									))}
								</div>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Table Controls */}
			<div className="table-controls">
				<div className="control-left" ref={columnDropdownRef}>
					<button className="column-selector-btn" onClick={() => setColumnSelectorOpen(!columnSelectorOpen)}>
						Custom columns {columnSelectorOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
					</button>
					{columnSelectorOpen && (
						<div className="column-dropdown">
							{Object.entries(METRIC_CONFIG).map(([key, config]) => (
								<label key={key} className="column-option">
									<input type="checkbox" checked={selectedTableColumns.includes(key)} onChange={() => toggleTableColumn(key)} />
									{config.label}
								</label>
							))}
						</div>
					)}
				</div>
				<div className="control-right">
					<span className="selected-count">
						{selectedAds.size}/{MAX_CHART_ADS} selected (max {MAX_CHART_ADS})
					</span>
				</div>
			</div>

			{/* Data Table */}
			<div className="analytics-table-wrapper">
				<table className="analytics-table">
					<thead>
						<tr>
							<th className="checkbox-col">
								<input
									type="checkbox"
									checked={selectedAds.size === MAX_CHART_ADS}
									onChange={toggleAllAds}
									title={selectedAds.size > 0 ? "Clear selection" : `Select top ${MAX_CHART_ADS}`}
								/>
							</th>
							<th className="item-name-col">{GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label || "Ad name"}</th>
							{selectedTableColumns.map((col) => (
								<th key={col} onClick={() => handleSort(col)} className={sortBy === col ? "sorted" : ""}>
									{METRIC_CONFIG[col]?.label}
									{sortBy === col ? (
										sortOrder === "desc" ? (
											<ArrowDown size={14} className="sort-icon active" />
										) : (
											<ArrowUp size={14} className="sort-icon active" />
										)
									) : (
										<ArrowUpDown size={14} className="sort-icon" />
									)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{sortedAds.map((ad) => (
							<tr key={ad.id} className={selectedAds.has(ad.id) ? "selected" : ""}>
								<td className="checkbox-col">
									<input
										type="checkbox"
										checked={selectedAds.has(ad.id)}
										onChange={() => toggleAdSelection(ad.id)}
										disabled={!selectedAds.has(ad.id) && selectedAds.size >= MAX_CHART_ADS}
										title={!selectedAds.has(ad.id) && selectedAds.size >= MAX_CHART_ADS ? `Max ${MAX_CHART_ADS} ads can be selected` : ""}
									/>
								</td>
								<td className="item-name-col">
									<div className="item-name-cell">
										{showThumbnails && (
											<div className="item-thumbnail">
												<img src={ad.image_url} alt={ad.ad_name} />
												{ad.display_format === "video" && (
													<div className="video-indicator">
														<Play size={10} fill="white" color="white" />
													</div>
												)}
											</div>
										)}
										<div className="item-info">
											<span className="item-name-text">{groupBy !== "ad_name" && ad.group_value ? ad.group_value : ad.ad_name}</span>
											<span className="item-count">
												{ad.ad_count || 1} ad{(ad.ad_count || 1) > 1 ? "s" : ""}
											</span>
										</div>
									</div>
								</td>
								{selectedTableColumns.map((col) => (
									<td key={col}>{METRIC_CONFIG[col]?.format(ad.metrics[col as keyof AdMetrics] || 0)}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>

		</div>
	);
};

export default AnalyticsDashboard;
