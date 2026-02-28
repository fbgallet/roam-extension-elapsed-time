import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { Chart, registerables } from "chart.js";
import { categoriesArray, onCategoriesChange } from "../categories";
import {
  getDashboardData,
  getDateRange,
  navigatePeriod,
  aggregateByWeek,
  aggregateByMonth,
  formatDateLabel,
} from "../dashboardData";
import { convertMinutesTohhmm } from "../util";

Chart.register(...registerables);

const CHART_COLORS = [
  "#2965CC",
  "#29A634",
  "#D99E0B",
  "#D13913",
  "#8F398F",
  "#00B3A4",
  "#DB2C6F",
  "#667580",
];

const PRESETS = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
];

/*──────────────────────────────────────────────────────────────────────────────
  PeriodSelector
──────────────────────────────────────────────────────────────────────────────*/
const PeriodSelector = ({ preset, startDate, endDate, onChange }) => {
  const [showCustom, setShowCustom] = useState(preset === "custom");

  const handlePreset = (key) => {
    setShowCustom(false);
    const range = getDateRange(key);
    onChange({ preset: key, ...range });
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    onChange({ preset: "custom", startDate, endDate });
  };

  const handleNavigate = (direction) => {
    const { startDate: s, endDate: e } = navigatePeriod(
      preset,
      startDate,
      endDate,
      direction
    );
    onChange({ preset, startDate: s, endDate: e });
  };

  const toInputDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const formatRange = () => {
    const opts = { month: "short", day: "numeric" };
    const s = startDate.toLocaleDateString("en-US", opts);
    const e = endDate.toLocaleDateString("en-US", { ...opts, year: "numeric" });
    return s === e.replace(/,\s*\d{4}/, "") ? e : `${s} – ${e}`;
  };

  const canNavigate = preset !== "custom";

  return (
    <div className="et-period-selector">
      <div className="et-period-top-row">
        <div className="et-period-buttons">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`bp3-button bp3-small ${
                preset === p.key && !showCustom
                  ? "bp3-active bp3-intent-primary"
                  : ""
              }`}
              onClick={() => handlePreset(p.key)}
            >
              {p.label}
            </button>
          ))}
          <button
            className={`bp3-button bp3-small ${
              showCustom ? "bp3-active bp3-intent-primary" : ""
            }`}
            onClick={handleCustomToggle}
          >
            Custom
          </button>
        </div>

        <div className="et-period-nav">
          <button
            className="bp3-button bp3-small bp3-minimal et-nav-arrow"
            onClick={() => handleNavigate(-1)}
            disabled={!canNavigate}
            title="Previous period"
          >
            ‹
          </button>
          <span className="et-period-label">{formatRange()}</span>
          <button
            className="bp3-button bp3-small bp3-minimal et-nav-arrow"
            onClick={() => handleNavigate(1)}
            disabled={!canNavigate}
            title="Next period"
          >
            ›
          </button>
        </div>
      </div>

      {showCustom && (
        <div className="et-custom-dates">
          <label>
            From:
            <input
              type="date"
              className="bp3-input bp3-small"
              value={toInputDate(startDate)}
              onChange={(e) =>
                onChange({
                  preset: "custom",
                  startDate: new Date(e.target.value + "T00:00:00"),
                  endDate,
                })
              }
            />
          </label>
          <label>
            To:
            <input
              type="date"
              className="bp3-input bp3-small"
              value={toInputDate(endDate)}
              onChange={(e) =>
                onChange({
                  preset: "custom",
                  startDate,
                  endDate: new Date(e.target.value + "T00:00:00"),
                })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
};

// Map a period preset or granularity key to a limit/goal interval key
function presetToInterval(preset) {
  if (preset === "week") return "week";
  if (preset === "month" || preset === "quarter") return "month";
  return "day"; // "day", "custom", or any other
}

/*──────────────────────────────────────────────────────────────────────────────
  TotalsCategoryRow — recursive row with horizontal bar
──────────────────────────────────────────────────────────────────────────────*/
const TotalsCategoryRow = ({ cat, totals, maxTime, depth, expandedSet, onToggle, interval }) => {
  const time = totals[cat.uid] || 0;
  if (time === 0) return null;

  const hasChildren = cat.children?.length > 0;
  const isExpanded = expandedSet.has(cat.uid);
  const barWidth = maxTime > 0 ? Math.max((time / maxTime) * 100, 2) : 0;

  // Goal / limit markers for this category at the current interval
  const goalTime = cat.limits?.goal?.[interval] || 0;
  const limitTime = cat.limits?.limit?.[interval] || 0;

  // Build stacked segments if any children have time (and this is a parent row)
  const activeChildren = hasChildren
    ? cat.children.filter((child) => (totals[child.uid] || 0) > 0)
    : [];
  const isStacked = depth === 0 && activeChildren.length > 0;

  // Segments: one per active child, plus a remainder for parent's own time
  let segments = null;
  if (isStacked) {
    const childrenTotal = activeChildren.reduce(
      (sum, child) => sum + (totals[child.uid] || 0),
      0
    );
    const ownTime = Math.max(time - childrenTotal, 0);
    segments = [
      ...(ownTime > 0
        ? [{ uid: cat.uid + "_own", time: ownTime, color: "#2965CC" }]
        : []),
      ...activeChildren.map((child, i) => ({
        uid: child.uid,
        name: child.name,
        time: totals[child.uid],
        color: CHART_COLORS[(i + 1) % CHART_COLORS.length],
      })),
    ];
  }

  return (
    <>
      <div
        className={`et-totals-row ${depth === 0 ? "et-totals-top" : "et-totals-sub"}`}
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        <span
          className="et-expand-arrow"
          onClick={() => hasChildren && onToggle(cat.uid)}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          {isExpanded ? "▾" : "▸"}
        </span>
        <span className="et-totals-name">{cat.name}</span>
        <span className="et-totals-bar-container">
          {isStacked ? (
            segments.map((seg) => (
              <span
                key={seg.uid}
                className="et-totals-bar et-totals-bar-segment"
                style={{
                  width: `${(seg.time / maxTime) * 100}%`,
                  backgroundColor: seg.color,
                }}
                title={seg.name ? `${seg.name}: ${convertMinutesTohhmm(seg.time)}` : undefined}
              />
            ))
          ) : (
            <span
              className="et-totals-bar"
              style={{ width: `${barWidth}%` }}
            />
          )}
          {goalTime > 0 && maxTime > 0 && (
            <span
              className="et-totals-marker et-totals-marker-goal"
              style={{ left: `${Math.min((goalTime / maxTime) * 100, 100)}%` }}
              title={`Goal: ${convertMinutesTohhmm(goalTime)}`}
            />
          )}
          {limitTime > 0 && maxTime > 0 && (
            <span
              className="et-totals-marker et-totals-marker-limit"
              style={{ left: `${Math.min((limitTime / maxTime) * 100, 100)}%` }}
              title={`Limit: ${convertMinutesTohhmm(limitTime)}`}
            />
          )}
        </span>
        <span className="et-totals-time">{convertMinutesTohhmm(time)}</span>
      </div>
      {isExpanded &&
        hasChildren &&
        cat.children.map((child) => (
          <TotalsCategoryRow
            key={child.uid}
            cat={child}
            totals={totals}
            maxTime={maxTime}
            depth={depth + 1}
            expandedSet={expandedSet}
            onToggle={onToggle}
            interval={interval}
          />
        ))}
    </>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  TotalsView
──────────────────────────────────────────────────────────────────────────────*/
const TotalsView = ({ data, preset }) => {
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const interval = presetToInterval(preset);

  const handleToggle = useCallback((uid) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }, []);

  if (!data) return <p className="et-empty-message">Loading...</p>;
  if (data.grandTotal === 0)
    return <p className="et-empty-message">No tracked time in this period.</p>;

  // maxTime for bar scaling = largest top-level category time
  const maxTime = Math.max(
    ...data.categories.map((cat) => data.totals[cat.uid] || 0),
    data.uncategorized.total
  );

  return (
    <div className="et-totals-view">
      <div className="et-totals-header">
        <span className="et-totals-grand">
          Total: {convertMinutesTohhmm(data.grandTotal)}
        </span>
      </div>
      {data.categories.map((cat) => (
        <TotalsCategoryRow
          key={cat.uid}
          cat={cat}
          totals={data.totals}
          maxTime={maxTime}
          depth={0}
          expandedSet={expandedSet}
          onToggle={handleToggle}
          interval={interval}
        />
      ))}
      {data.uncategorized.total > 0 && (
        <div className="et-totals-row et-totals-top" style={{ paddingLeft: 8 }}>
          <span
            className="et-expand-arrow"
            style={{ visibility: "hidden" }}
          >
            ▸
          </span>
          <span className="et-totals-name" style={{ fontStyle: "italic" }}>
            Uncategorized
          </span>
          <span className="et-totals-bar-container">
            <span
              className="et-totals-bar et-totals-bar-uncat"
              style={{
                width: `${Math.max((data.uncategorized.total / maxTime) * 100, 2)}%`,
              }}
            />
          </span>
          <span className="et-totals-time">
            {convertMinutesTohhmm(data.uncategorized.total)}
          </span>
        </div>
      )}
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  CategoryPicker — checkbox tree for the Trends tab
──────────────────────────────────────────────────────────────────────────────*/
const CategoryPickerNode = ({ cat, depth, selected, onToggle, colorMap, expandedSet, onToggleExpand }) => {
  const hasChildren = cat.children?.length > 0;
  const isExpanded = expandedSet.has(cat.uid);
  const isSelected = selected.has(cat.uid);
  const color = colorMap[cat.uid];

  return (
    <>
      <div className="et-picker-row" style={{ paddingLeft: depth * 16 + 4 }}>
        {hasChildren && (
          <span
            className="et-expand-arrow"
            onClick={() => onToggleExpand(cat.uid)}
          >
            {isExpanded ? "▾" : "▸"}
          </span>
        )}
        {!hasChildren && <span className="et-expand-arrow" style={{ visibility: "hidden" }}>▸</span>}
        <label className="et-picker-label">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(cat.uid)}
          />
          {color && (
            <span
              className="et-color-swatch"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="et-picker-name">{cat.name}</span>
        </label>
      </div>
      {isExpanded &&
        hasChildren &&
        cat.children.map((child) => (
          <CategoryPickerNode
            key={child.uid}
            cat={child}
            depth={depth + 1}
            selected={selected}
            onToggle={onToggle}
            colorMap={colorMap}
            expandedSet={expandedSet}
            onToggleExpand={onToggleExpand}
          />
        ))}
    </>
  );
};

const CategoryPicker = ({ categories, totals, selected, onSelectionChange }) => {
  const [expandedSet, setExpandedSet] = useState(() => new Set());

  const handleToggle = (uid) => {
    const next = new Set(selected);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    onSelectionChange(next);
  };

  const handleToggleExpand = (uid) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  // Assign colors to selected categories
  const colorMap = useMemo(() => {
    const map = {};
    let i = 0;
    for (const uid of selected) {
      map[uid] = CHART_COLORS[i % CHART_COLORS.length];
      i++;
    }
    return map;
  }, [selected]);

  const handleSelectAll = () => {
    const allUids = new Set();
    const collectUids = (cats) => {
      cats.forEach((cat) => {
        allUids.add(cat.uid);
        if (cat.children) collectUids(cat.children);
      });
    };
    collectUids(categories);
    onSelectionChange(allUids);
  };

  const handleSelectNone = () => onSelectionChange(new Set());

  return (
    <div className="et-category-picker">
      <div className="et-picker-actions">
        <button
          className="bp3-button bp3-minimal bp3-small"
          onClick={handleSelectAll}
        >
          All
        </button>
        <button
          className="bp3-button bp3-minimal bp3-small"
          onClick={handleSelectNone}
        >
          None
        </button>
      </div>
      <div className="et-picker-list">
        {categories.map((cat) => (
          <CategoryPickerNode
            key={cat.uid}
            cat={cat}
            depth={0}
            selected={selected}
            onToggle={handleToggle}
            colorMap={colorMap}
            expandedSet={expandedSet}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </div>
      {selected.size > 6 && (
        <div className="et-picker-warning">
          Many categories selected — chart may be hard to read.
        </div>
      )}
    </div>
  );
};

const GRANULARITIES = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
];

/*──────────────────────────────────────────────────────────────────────────────
  TrendChart — Chart.js stacked/grouped bar chart
──────────────────────────────────────────────────────────────────────────────*/
const TrendChart = ({ data, selected, colorMap, granularity }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const days = data.days;
    const allCats = flattenCategories(data.categories);

    // Determine bucket data based on chosen granularity
    let labels, bucketKeys, bucketData;
    if (granularity === "month" || (granularity === "auto" && days.length > 56)) {
      const agg = aggregateByMonth(data.matrix, days);
      labels = agg.labels;
      bucketKeys = Object.keys(agg.aggregated);
      bucketData = agg.aggregated;
    } else if (granularity === "week" || (granularity === "auto" && days.length > 14)) {
      const agg = aggregateByWeek(data.matrix, days);
      labels = agg.labels;
      bucketKeys = Object.keys(agg.aggregated);
      bucketData = agg.aggregated;
    } else if (granularity === "quarter") {
      // Quarter: aggregate by month within the range (same as month for display)
      const agg = aggregateByMonth(data.matrix, days);
      labels = agg.labels;
      bucketKeys = Object.keys(agg.aggregated);
      bucketData = agg.aggregated;
    } else {
      // Daily
      labels = days.map((uid) => {
        const title = window.roamAlphaAPI.pull("[:node/title]", [":block/uid", uid])?.[":node/title"];
        if (!title) return uid;
        const date = window.roamAlphaAPI.util.pageTitleToDate(title);
        return date ? formatDateLabel(date) : title;
      });
      bucketKeys = days;
      bucketData = data.matrix;
    }

    // Identify parent→children relationships among selected categories.
    // Walk all categories at any depth: a parent forms a stack group if it is
    // selected AND has at least one selected descendant (direct child only for
    // now — grandchildren fold into their immediate parent's group).
    const selectedSet = selected;
    const stackGroups = new Map(); // parentUid → [childUid, ...]

    const walkForStackGroups = (cats) => {
      for (const cat of cats) {
        if (selectedSet.has(cat.uid)) {
          const selectedChildren = (cat.children || []).filter((c) => selectedSet.has(c.uid));
          if (selectedChildren.length > 0) {
            stackGroups.set(cat.uid, selectedChildren.map((c) => c.uid));
          }
        }
        if (cat.children?.length) walkForStackGroups(cat.children);
      }
    };
    walkForStackGroups(data.categories);

    // All child uids already rendered as part of a parent's stack group.
    // These must NOT be rendered again as standalone bars.
    const stackedChildUids = new Set([...stackGroups.values()].flat());

    // Build datasets
    const datasets = [];
    let colorIndex = 0;
    const uidColorMap = {};

    // Assign colors in selection order
    for (const uid of selectedSet) {
      uidColorMap[uid] = CHART_COLORS[colorIndex % CHART_COLORS.length];
      colorIndex++;
    }

    for (const uid of selectedSet) {
      // Skip children that will be rendered inside their parent's stack group
      if (stackedChildUids.has(uid)) continue;

      const cat = allCats.find((c) => c.uid === uid);
      const color = uidColorMap[uid];

      if (stackGroups.has(uid)) {
        // This parent has selected children → render as stacked group.
        // stack key = parent uid so siblings in this group share a bar.
        const childUids = stackGroups.get(uid);

        // Parent's own segment = parent total minus selected children totals
        datasets.push({
          label: cat?.name || uid,
          data: bucketKeys.map((key) => {
            const parentTime = bucketData[key]?.[uid] || 0;
            const childrenTime = childUids.reduce(
              (sum, cuid) => sum + (bucketData[key]?.[cuid] || 0),
              0
            );
            return Math.max(parentTime - childrenTime, 0);
          }),
          backgroundColor: color,
          borderWidth: 0,
          borderRadius: 0,
          stack: uid,
        });

        // One dataset per selected child, same stack group
        childUids.forEach((cuid, ci) => {
          const childCat = allCats.find((c) => c.uid === cuid);
          datasets.push({
            label: childCat?.name || cuid,
            data: bucketKeys.map((key) => bucketData[key]?.[cuid] || 0),
            backgroundColor: uidColorMap[cuid],
            borderWidth: 0,
            borderRadius: ci === childUids.length - 1 ? 2 : 0,
            stack: uid,
          });
        });
      } else {
        // Standalone category — give it its own unique stack id so it is
        // rendered as a separate grouped bar and never merged with others.
        datasets.push({
          label: cat?.name || uid,
          data: bucketKeys.map((key) => bucketData[key]?.[uid] || 0),
          backgroundColor: color,
          borderWidth: 0,
          borderRadius: 2,
          stack: uid, // unique stack id → own bar column
        });
      }
    }

    // Build goal/limit reference lines for selected categories
    const limitLines = [];
    const limitInterval = presetToInterval(granularity);
    for (const uid of selectedSet) {
      const cat = allCats.find((c) => c.uid === uid);
      if (!cat?.limits) continue;
      const goalVal = cat.limits.goal?.[limitInterval] || 0;
      const limitVal = cat.limits.limit?.[limitInterval] || 0;
      if (goalVal > 0) limitLines.push({ value: goalVal, color: "#29A634", label: `${cat.name} goal`, dash: [6, 3] });
      if (limitVal > 0) limitLines.push({ value: limitVal, color: "#D13913", label: `${cat.name} limit`, dash: [6, 3] });
    }

    const limitLinesPlugin = {
      id: "limitLines",
      afterDraw(chart) {
        if (!limitLines.length) return;
        const { ctx, chartArea, scales } = chart;
        const yScale = scales.y;
        ctx.save();
        ctx.beginPath();
        ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
        ctx.clip();
        limitLines.forEach(({ value, color, label, dash }) => {
          const y = yScale.getPixelForValue(value);
          if (y < chartArea.top || y > chartArea.bottom) return;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash(dash);
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();
          ctx.font = "10px sans-serif";
          ctx.fillStyle = color;
          ctx.fillText(label, chartArea.left + 4, y - 3);
          ctx.restore();
        });
        ctx.restore();
      },
    };

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: { labels, datasets },
      plugins: [limitLinesPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${convertMinutesTohhmm(ctx.raw)}`,
            },
          },
        },
        scales: {
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: (val) => convertMinutesTohhmm(val),
              font: { size: 11 },
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          x: {
            stacked: true,
            ticks: { font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, selected, granularity]);

  if (!data)
    return <p className="et-empty-message">Loading...</p>;
  if (selected.size === 0)
    return (
      <div className="et-chart-container et-chart-empty">
        <p className="et-empty-message">Select categories to visualize.</p>
      </div>
    );

  return (
    <div className="et-chart-container">
      <canvas ref={canvasRef} />
    </div>
  );
};

function flattenCategories(categories) {
  const result = [];
  const walk = (cats) => {
    cats.forEach((cat) => {
      result.push(cat);
      if (cat.children) walk(cat.children);
    });
  };
  walk(categories);
  return result;
}

/*──────────────────────────────────────────────────────────────────────────────
  TimeDashboard — main modal
──────────────────────────────────────────────────────────────────────────────*/
const TimeDashboard = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("totals");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(() => {
    const { startDate, endDate } = getDateRange("day");
    return { preset: "day", startDate, endDate };
  });
  const [selected, setSelected] = useState(new Set());
  const [granularity, setGranularity] = useState("day");

  // Fetch data when period changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDashboardData(period.startDate, period.endDate).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);

      // Auto-select top categories by total time (up to 4)
      setSelected((prev) => {
        if (prev.size > 0) return prev;
        const topLevel = result.categories
          .map((cat) => ({ uid: cat.uid, time: result.totals[cat.uid] || 0 }))
          .sort((a, b) => b.time - a.time)
          .slice(0, 4)
          .filter((c) => c.time > 0)
          .map((c) => c.uid);
        return new Set(topLevel);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [period.startDate?.getTime(), period.endDate?.getTime()]);

  const handlePeriodChange = useCallback((newPeriod) => {
    setPeriod(newPeriod);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  // Color map for selected categories (shared between picker and chart)
  const colorMap = useMemo(() => {
    const map = {};
    let i = 0;
    for (const uid of selected) {
      map[uid] = CHART_COLORS[i % CHART_COLORS.length];
      i++;
    }
    return map;
  }, [selected]);

  if (!isOpen) return null;

  return (
    <div className="bp3-portal">
      <div className="bp3-overlay bp3-overlay-open">
        <div className="bp3-overlay-backdrop" onClick={handleClose} />
        <div className="bp3-dialog et-dashboard">
          <div className="bp3-dialog-header">
            <h4 className="bp3-heading">Time Dashboard</h4>
            <button
              className="bp3-dialog-close-button bp3-button bp3-minimal"
              onClick={handleClose}
            >
              <span className="bp3-icon bp3-icon-cross" />
            </button>
          </div>
          <div className="bp3-dialog-body et-dashboard-body">
            <PeriodSelector
              preset={period.preset}
              startDate={period.startDate}
              endDate={period.endDate}
              onChange={handlePeriodChange}
            />

            {loading && (
              <div className="et-loading">
                <span className="bp3-spinner bp3-spinner-small" />
                <span>Loading data...</span>
              </div>
            )}

            <div className="et-tab-bar">
              <button
                className={`bp3-button bp3-minimal ${
                  activeTab === "totals" ? "bp3-active et-tab-active" : ""
                }`}
                onClick={() => setActiveTab("totals")}
              >
                Totals
              </button>
              <button
                className={`bp3-button bp3-minimal ${
                  activeTab === "trends" ? "bp3-active et-tab-active" : ""
                }`}
                onClick={() => setActiveTab("trends")}
              >
                Trends
              </button>
            </div>

            {!loading && activeTab === "totals" && <TotalsView data={data} preset={period.preset} />}

            {!loading && activeTab === "trends" && (
              <div className="et-trends-layout">
                <CategoryPicker
                  categories={data?.categories || []}
                  totals={data?.totals || {}}
                  selected={selected}
                  onSelectionChange={setSelected}
                />
                <div className="et-trends-chart-area">
                  <div className="et-granularity-switcher">
                    <span className="et-granularity-label">Group by:</span>
                    <div className="bp3-button-group bp3-small">
                      {GRANULARITIES.map((g) => (
                        <button
                          key={g.key}
                          className={`bp3-button${granularity === g.key ? " bp3-active bp3-intent-primary" : ""}`}
                          onClick={() => setGranularity(g.key)}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TrendChart
                    data={data}
                    selected={selected}
                    colorMap={colorMap}
                    granularity={granularity}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="bp3-dialog-footer">
            <div className="bp3-dialog-footer-actions">
              <button
                className="bp3-button bp3-intent-primary"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  Launcher
──────────────────────────────────────────────────────────────────────────────*/
export function openTimeDashboard() {
  renderOverlay({
    Overlay: (props) => <TimeDashboard {...props} />,
  });
}

export default TimeDashboard;
