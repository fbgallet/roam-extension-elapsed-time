import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { renderOverlay } from "./renderOverlay";
import { Chart, registerables } from "chart.js";
import {
  getDashboardData,
  getDateRange,
  navigatePeriod,
  aggregateByWeek,
  aggregateByMonth,
  formatDateLabel,
} from "../dashboardData";
import { getDashboardDataForPage } from "../pageDashboardData";
import { convertMinutesTohhmm, resolveReferences } from "../util";

const BLOCK_REF_RE = /\(\([^\)]{9}\)\)/;
/** Return displayName if it looks resolved, otherwise re-resolve at render time. */
function catLabel(cat) {
  const name = cat?.displayName || cat?.name || "";
  if (!BLOCK_REF_RE.test(name)) return name;
  return resolveReferences(name) || name;
}
import { getCategoryColorsMap } from "./CategoriesManager";
import PageSelector from "./PageSelector";

Chart.register(...registerables);

export const CHART_COLORS = [
  "#2965CC",
  "#29A634",
  "#D99E0B",
  "#D13913",
  "#8F398F",
  "#00B3A4",
  "#DB2C6F",
  "#667580",
];

/*──────────────────────────────────────────────────────────────────────────────
  Color utilities for tinted child bars
──────────────────────────────────────────────────────────────────────────────*/
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
  );
}

/** Blend color toward white by factor (0=original, 1=white) */
function lightenColor(hex, factor) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * factor,
    g + (255 - g) * factor,
    b + (255 - b) * factor,
  );
}

/**
 * Given a parent color and number of children, return an array of
 * progressively lighter tints for each child.
 * childIndex 0 = slightly lighter than parent, last = most light.
 */
function childTintColor(parentColor, childIndex, totalChildren) {
  // Range: lighten 25% to 65% depending on position
  const minLighten = 0.25;
  const maxLighten = 0.65;
  const factor =
    totalChildren === 1
      ? (minLighten + maxLighten) / 2
      : minLighten +
        (childIndex / (totalChildren - 1)) * (maxLighten - minLighten);
  return lightenColor(parentColor, factor);
}

const PRESETS = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
];

/*──────────────────────────────────────────────────────────────────────────────
  PeriodSelector
──────────────────────────────────────────────────────────────────────────────*/
export const PeriodSelector = ({
  preset,
  startDate,
  endDate,
  referenceDate,
  onChange,
}) => {
  const [showCustom, setShowCustom] = useState(preset === "custom");

  const handlePreset = (key) => {
    setShowCustom(false);
    const range = getDateRange(key, referenceDate);
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
      direction,
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
const TotalsCategoryRow = ({
  cat,
  totals,
  maxTime,
  depth,
  expandedSet,
  onToggle,
  interval,
  fixedColors,
  catColor,
}) => {
  const time = totals[cat.uid] || 0;
  if (time === 0) return null;

  // Resolve this category's color: fixed > passed-in > fallback gray
  const color = fixedColors?.[cat.uid] || catColor || "#2965CC";

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

  // Segments: one per active child, plus a remainder for parent's own time.
  // Children use tinted variants of parent color (or their own fixed color).
  let segments = null;
  if (isStacked) {
    const childrenTotal = activeChildren.reduce(
      (sum, child) => sum + (totals[child.uid] || 0),
      0,
    );
    const ownTime = Math.max(time - childrenTotal, 0);
    segments = [
      ...(ownTime > 0 ? [{ uid: cat.uid + "_own", time: ownTime, color }] : []),
      ...activeChildren.map((child, i) => ({
        uid: child.uid,
        name: child.name,
        time: totals[child.uid],
        color:
          fixedColors?.[child.uid] ||
          childTintColor(color, i, activeChildren.length),
        borderColor: color,
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
        <span className="et-totals-name">{catLabel(cat)}</span>
        <span className="et-totals-bar-container">
          {isStacked ? (
            <span
              className="et-totals-bar-inner"
              style={{
                width: `${barWidth}%`,
                outline: depth === 0 ? `1.5px solid ${color}` : undefined,
                outlineOffset: "-1px",
                borderRadius: 3,
              }}
            >
              {segments.map((seg) => (
                <span
                  key={seg.uid}
                  className="et-totals-bar et-totals-bar-segment"
                  style={{
                    width: `${(seg.time / time) * 100}%`,
                    backgroundColor: seg.color,
                    ...(seg.borderColor
                      ? { boxShadow: `inset 0 0 0 1px ${seg.borderColor}` }
                      : {}),
                  }}
                  title={
                    seg.name
                      ? `${seg.name}: ${convertMinutesTohhmm(seg.time)}`
                      : undefined
                  }
                />
              ))}
            </span>
          ) : (
            <span
              className="et-totals-bar"
              style={{
                width: `${barWidth}%`,
                backgroundColor: color,
                outline: depth === 0 ? `1.5px solid ${color}` : undefined,
                outlineOffset: "-1px",
                borderRadius: 3,
              }}
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
        cat.children.map((child, ci) => (
          <TotalsCategoryRow
            key={child.uid}
            cat={child}
            totals={totals}
            maxTime={maxTime}
            depth={depth + 1}
            expandedSet={expandedSet}
            onToggle={onToggle}
            interval={interval}
            fixedColors={fixedColors}
            catColor={
              fixedColors?.[child.uid] ||
              childTintColor(color, ci, cat.children.length)
            }
          />
        ))}
    </>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  buildTotalsClipboardText — tab-separated list matching copyTotalToClipboard
──────────────────────────────────────────────────────────────────────────────*/
function buildTotalsClipboardText(data) {
  let lines = [];
  const walk = (cats, shift = "") => {
    cats.forEach((cat) => {
      const time = data.totals[cat.uid] || 0;
      if (time === 0) return;
      lines.push(`${shift}${cat.name}\t${convertMinutesTohhmm(time)}`);
      if (cat.children?.length) walk(cat.children, shift + "   ");
    });
  };
  walk(data.categories);
  if (data.uncategorized.total > 0)
    lines.push(
      `Uncategorized\t${convertMinutesTohhmm(data.uncategorized.total)}`,
    );
  const activeTags = (data.tags || []).filter(
    (t) => (data.totals[t.uid] || 0) > 0,
  );
  activeTags.forEach((t) =>
    lines.push(`${t.name}\t${convertMinutesTohhmm(data.totals[t.uid])}`),
  );
  lines.push(`Total\t${convertMinutesTohhmm(data.grandTotal)}`);
  return lines.join("\n");
}

/*──────────────────────────────────────────────────────────────────────────────
  TotalsView
──────────────────────────────────────────────────────────────────────────────*/
export const TotalsView = ({ data, preset, fixedColors, scopeCategory }) => {
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [copied, setCopied] = useState(false);
  const interval = presetToInterval(preset);

  const handleToggle = useCallback((uid) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }, []);

  const handleCopy = useCallback(() => {
    const text = buildTotalsClipboardText(data);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [data]);

  if (!data) return <p className="et-empty-message">Loading...</p>;
  if (data.grandTotal === 0)
    return <p className="et-empty-message">No tracked time in this period.</p>;

  // When scopeCategory is set, promote its children to top-level
  const displayCategories = useMemo(() => {
    if (!scopeCategory) return data.categories;
    const scopeCat = data.categories.find((c) => c.uid === scopeCategory.uid);
    return scopeCat?.children?.length ? scopeCat.children : data.categories;
  }, [data, scopeCategory]);

  const otherCategories = useMemo(() => {
    if (!scopeCategory) return [];
    return data.categories.filter(
      (c) => c.uid !== scopeCategory.uid && (data.totals[c.uid] || 0) > 0,
    );
  }, [data, scopeCategory]);

  // maxTime for bar scaling = largest top-level category time
  const maxTime = Math.max(
    ...displayCategories.map((cat) => data.totals[cat.uid] || 0),
    ...otherCategories.map((cat) => data.totals[cat.uid] || 0),
    data.uncategorized.total,
  );

  const activeTags = (data.tags || []).filter(
    (t) => (data.totals[t.uid] || 0) > 0,
  );

  return (
    <div className="et-totals-view">
      <div className="et-totals-header">
        <span className="et-totals-grand">
          Total: {convertMinutesTohhmm(data.grandTotal)}
        </span>
        <button
          className={`bp3-button bp3-small bp3-minimal et-copy-btn${copied ? " et-copy-btn-done" : ""}`}
          onClick={handleCopy}
          title="Copy totals to clipboard"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      {displayCategories.map((cat, i) => (
        <TotalsCategoryRow
          key={cat.uid}
          cat={cat}
          totals={data.totals}
          maxTime={maxTime}
          depth={0}
          expandedSet={expandedSet}
          onToggle={handleToggle}
          interval={interval}
          fixedColors={fixedColors}
          catColor={
            fixedColors?.[cat.uid] || CHART_COLORS[i % CHART_COLORS.length]
          }
        />
      ))}
      {data.uncategorized.total > 0 && (
        <div className="et-totals-row et-totals-top" style={{ paddingLeft: 8 }}>
          <span className="et-expand-arrow" style={{ visibility: "hidden" }}>
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
      {activeTags.length > 0 && (
        <div className="et-tags-section">
          <div className="et-tags-section-header">Tags</div>
          {activeTags.map((tag) => {
            const time = data.totals[tag.uid] || 0;
            const barWidth =
              maxTime > 0 ? Math.max((time / maxTime) * 100, 2) : 0;
            return (
              <div
                key={tag.uid}
                className="et-totals-row et-totals-tag"
                style={{ paddingLeft: 8 }}
              >
                <span
                  className="et-expand-arrow"
                  style={{ visibility: "hidden" }}
                >
                  ▸
                </span>
                <span className="et-totals-name et-tag-name">
                  {catLabel(tag)}
                </span>
                <span className="et-totals-bar-container">
                  <span
                    className="et-totals-bar et-totals-bar-tag"
                    style={{ width: `${barWidth}%` }}
                  />
                </span>
                <span className="et-totals-time">
                  {convertMinutesTohhmm(time)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {otherCategories.length > 0 && (
        <div className="et-tags-section">
          <div className="et-tags-section-header">Other categories</div>
          {otherCategories.map((cat, i) => (
            <TotalsCategoryRow
              key={cat.uid}
              cat={cat}
              totals={data.totals}
              maxTime={maxTime}
              depth={0}
              expandedSet={expandedSet}
              onToggle={handleToggle}
              interval={interval}
              fixedColors={fixedColors}
              catColor={
                fixedColors?.[cat.uid] || CHART_COLORS[i % CHART_COLORS.length]
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  CategoryPicker — checkbox tree for the Trends tab
──────────────────────────────────────────────────────────────────────────────*/
const CategoryPickerNode = ({
  cat,
  depth,
  selected,
  onToggle,
  colorMap,
  expandedSet,
  onToggleExpand,
}) => {
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
        {!hasChildren && (
          <span className="et-expand-arrow" style={{ visibility: "hidden" }}>
            ▸
          </span>
        )}
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
          <span className="et-picker-name">{catLabel(cat)}</span>
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

export const CategoryPicker = ({
  categories,
  tags,
  totals,
  selected,
  onSelectionChange,
  colorMap,
}) => {
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

  const handleSelectAll = () => {
    const allUids = new Set();
    const collectUids = (cats) => {
      cats.forEach((cat) => {
        allUids.add(cat.uid);
        if (cat.children) collectUids(cat.children);
      });
    };
    collectUids(categories);
    collectUids(tags || []);
    onSelectionChange(allUids);
  };

  const handleSelectNone = () => onSelectionChange(new Set());

  const activeTags = (tags || []).filter((t) => (totals[t.uid] || 0) > 0);

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
        {activeTags.length > 0 && (
          <>
            <div className="et-picker-section-label">Tags</div>
            {activeTags.map((tag) => (
              <div
                key={tag.uid}
                className="et-picker-row et-picker-tag-row"
                style={{ paddingLeft: 4 }}
              >
                <span
                  className="et-expand-arrow"
                  style={{ visibility: "hidden" }}
                >
                  ▸
                </span>
                <label className="et-picker-label">
                  <input
                    type="checkbox"
                    checked={selected.has(tag.uid)}
                    onChange={() => handleToggle(tag.uid)}
                  />
                  {colorMap[tag.uid] && (
                    <span
                      className="et-color-swatch"
                      style={{ backgroundColor: colorMap[tag.uid] }}
                    />
                  )}
                  <span className="et-picker-name et-tag-name">
                    {catLabel(tag)}
                  </span>
                </label>
              </div>
            ))}
          </>
        )}
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
  buildTrendsCSV — CSV export for the trends chart data
──────────────────────────────────────────────────────────────────────────────*/
function buildTrendsCSV(data, selected, granularity) {
  const allCats = flattenCategories([...data.categories, ...(data.tags || [])]);
  const selectedCats = allCats.filter((c) => selected.has(c.uid));

  let labels, bucketKeys, bucketData;
  const days = data.days;
  if (granularity === "month" || granularity === "quarter") {
    const agg = aggregateByMonth(data.matrix, days);
    labels = agg.labels;
    bucketKeys = Object.keys(agg.aggregated);
    bucketData = agg.aggregated;
  } else if (granularity === "week") {
    const agg = aggregateByWeek(data.matrix, days);
    labels = agg.labels;
    bucketKeys = Object.keys(agg.aggregated);
    bucketData = agg.aggregated;
  } else {
    labels = days.map((uid) => {
      const title = window.roamAlphaAPI.pull("[:node/title]", [
        ":block/uid",
        uid,
      ])?.[":node/title"];
      if (!title) return uid;
      const date = window.roamAlphaAPI.util.pageTitleToDate(title);
      return date ? formatDateLabel(date) : title;
    });
    bucketKeys = days;
    bucketData = data.matrix;
  }

  const header = ["Period", ...selectedCats.map((c) => c.name), "Total"].join(
    ",",
  );
  const rows = bucketKeys.map((key, i) => {
    const dayData = bucketData[key] || {};
    const values = selectedCats.map((c) => dayData[c.uid] || 0);
    const rowTotal = values.reduce((a, b) => a + b, 0);
    return [
      `"${labels[i]}"`,
      ...values.map((v) => convertMinutesTohhmm(v)),
      convertMinutesTohhmm(rowTotal),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

/*──────────────────────────────────────────────────────────────────────────────
  TrendChart — Chart.js stacked/line/mixed chart
──────────────────────────────────────────────────────────────────────────────*/
const TrendChart = ({
  data,
  selected,
  fixedColors,
  granularity,
  chartType,
}) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const days = data.days;
    const allCats = flattenCategories([
      ...data.categories,
      ...(data.tags || []),
    ]);

    // Determine bucket data based on chosen granularity
    let labels, bucketKeys, bucketData;
    if (
      granularity === "month" ||
      (granularity === "auto" && days.length > 56)
    ) {
      const agg = aggregateByMonth(data.matrix, days);
      labels = agg.labels;
      bucketKeys = Object.keys(agg.aggregated);
      bucketData = agg.aggregated;
    } else if (
      granularity === "week" ||
      (granularity === "auto" && days.length > 14)
    ) {
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
        const title = window.roamAlphaAPI.pull("[:node/title]", [
          ":block/uid",
          uid,
        ])?.[":node/title"];
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
          const selectedChildren = (cat.children || []).filter((c) =>
            selectedSet.has(c.uid),
          );
          if (selectedChildren.length > 0) {
            stackGroups.set(
              cat.uid,
              selectedChildren.map((c) => c.uid),
            );
          }
        }
        if (cat.children?.length) walkForStackGroups(cat.children);
      }
    };
    walkForStackGroups([...data.categories, ...(data.tags || [])]);

    // All child uids already rendered as part of a parent's stack group.
    // These must NOT be rendered again as standalone bars.
    const stackedChildUids = new Set([...stackGroups.values()].flat());

    // Build datasets — use colorMap prop (which already accounts for fixed colors)
    const datasets = [];
    const uidColorMap = {};

    // Assign colors: fixed user colors take priority, fallback to CHART_COLORS.
    // Assign base colors to top-level (non-stacked-child) categories only.
    let colorIndex = 0;
    for (const uid of selectedSet) {
      if (stackedChildUids.has(uid)) continue; // child tints computed later
      uidColorMap[uid] =
        fixedColors[uid] || CHART_COLORS[colorIndex % CHART_COLORS.length];
      colorIndex++;
    }

    // Assign tinted colors to stacked children based on their parent's color.
    for (const [parentUid, childUids] of stackGroups) {
      const parentColor = uidColorMap[parentUid];
      childUids.forEach((cuid, ci) => {
        uidColorMap[cuid] =
          fixedColors[cuid] ||
          childTintColor(parentColor, ci, childUids.length);
      });
    }

    // stackBorderColors: parentUid → parentColor (for post-draw border plugin)
    const stackBorderColors = {};
    for (const [parentUid] of stackGroups) {
      stackBorderColors[parentUid] = uidColorMap[parentUid];
    }

    const useLines = chartType === "line";
    const useBoth = chartType === "both";

    for (const uid of selectedSet) {
      // Skip children that will be rendered inside their parent's stack group
      if (stackedChildUids.has(uid)) continue;

      const cat = allCats.find((c) => c.uid === uid);
      const color = uidColorMap[uid];

      if (useLines) {
        // Pure line mode — exact values, one line per category
        datasets.push({
          type: "line",
          label: catLabel(cat) || uid,
          data: bucketKeys.map((key) => bucketData[key]?.[uid] || 0),
          borderColor: color,
          backgroundColor: color + "33",
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: false,
          order: 0,
        });
      } else if (stackGroups.has(uid)) {
        // This parent has selected children → render as stacked group.
        const childUids = stackGroups.get(uid);

        // Parent's own segment (bottom of stack)
        datasets.push({
          label: catLabel(cat) || uid,
          data: bucketKeys.map((key) => {
            const parentTime = bucketData[key]?.[uid] || 0;
            const childrenTime = childUids.reduce(
              (sum, cuid) => sum + (bucketData[key]?.[cuid] || 0),
              0,
            );
            return Math.max(parentTime - childrenTime, 0);
          }),
          backgroundColor: color,
          borderWidth: 0,
          borderRadius: 0,
          stack: uid,
          order: 1,
        });

        // One dataset per selected child — tinted, no individual borders
        childUids.forEach((cuid, ci) => {
          const childCat = allCats.find((c) => c.uid === cuid);
          datasets.push({
            label: catLabel(childCat) || cuid,
            data: bucketKeys.map((key) => bucketData[key]?.[cuid] || 0),
            backgroundColor: uidColorMap[cuid],
            borderWidth: 0,
            borderRadius: ci === childUids.length - 1 ? 2 : 0,
            stack: uid,
            order: 1,
          });
        });
      } else {
        // Standalone category bar
        datasets.push({
          label: catLabel(cat) || uid,
          data: bucketKeys.map((key) => bucketData[key]?.[uid] || 0),
          backgroundColor: color,
          borderWidth: 0,
          borderRadius: 2,
          stack: uid,
          order: 1,
        });
      }
    }

    // In "both" mode: add a moving-average line overlay for every top-level
    // selected category (i.e. non-stacked-child). Window = 3 centered points.
    if (useBoth) {
      const maWindow = 3;
      for (const uid of selectedSet) {
        if (stackedChildUids.has(uid)) continue;
        const cat = allCats.find((c) => c.uid === uid);
        const color = uidColorMap[uid];
        const rawValues = bucketKeys.map((key) => bucketData[key]?.[uid] || 0);
        const maValues = rawValues.map((_, i) => {
          const half = Math.floor(maWindow / 2);
          const from = Math.max(0, i - half);
          const to = Math.min(rawValues.length - 1, i + half);
          const slice = rawValues.slice(from, to + 1);
          return slice.reduce((a, b) => a + b, 0) / slice.length;
        });
        datasets.push({
          type: "line",
          label: `~ ${catLabel(cat) || uid}`,
          data: maValues,
          borderColor: color,
          backgroundColor: "transparent",
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          fill: false,
          stack: undefined,
          order: 0, // lower = drawn later = on top; bars default to 1
        });
      }
    }

    // Plugin: draw a 2px border on left+right sides of each stacked group bar,
    // using the parent category's color. This visually "frames" the stack column
    // without the messy per-segment borders Chart.js would otherwise produce.
    const stackedGroupBorderPlugin = {
      id: "stackedGroupBorder",
      afterDatasetsDraw(chart) {
        if (!Object.keys(stackBorderColors).length) return;
        const { ctx } = chart;
        ctx.save();

        // For each dataset that belongs to a stack group (stack key = parentUid),
        // find bars and draw left+right borders in the parent color.
        chart.data.datasets.forEach((ds, dsIndex) => {
          const parentColor = stackBorderColors[ds.stack];
          if (!parentColor) return;
          const meta = chart.getDatasetMeta(dsIndex);
          if (!meta || meta.hidden) return;
          meta.data.forEach((bar) => {
            if (!bar || bar.base === bar.y) return; // zero-height segment
            const { x, y, width, base } = bar;
            const left = x - width / 2;
            const top = Math.min(y, base);
            const height = Math.abs(base - y);
            ctx.strokeStyle = parentColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            // left side
            ctx.moveTo(left + 1, top);
            ctx.lineTo(left + 1, top + height);
            // right side
            ctx.moveTo(left + width - 1, top);
            ctx.lineTo(left + width - 1, top + height);
            ctx.stroke();
          });
        });

        ctx.restore();
      },
    };

    // Build goal/limit reference lines for selected categories
    const limitLines = [];
    const limitInterval = presetToInterval(granularity);
    for (const uid of selectedSet) {
      const cat = allCats.find((c) => c.uid === uid);
      if (!cat?.limits) continue;
      const goalVal = cat.limits.goal?.[limitInterval] || 0;
      const limitVal = cat.limits.limit?.[limitInterval] || 0;
      if (goalVal > 0)
        limitLines.push({
          value: goalVal,
          color: "#29A634",
          label: `${catLabel(cat)} goal`,
          dash: [6, 3],
        });
      if (limitVal > 0)
        limitLines.push({
          value: limitVal,
          color: "#D13913",
          label: `${catLabel(cat)} limit`,
          dash: [6, 3],
        });
    }

    const limitLinesPlugin = {
      id: "limitLines",
      afterDraw(chart) {
        if (!limitLines.length) return;
        const { ctx, chartArea, scales } = chart;
        const yScale = scales.y;
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          chartArea.left,
          chartArea.top,
          chartArea.width,
          chartArea.height,
        );
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

    const stackedAxes = chartType !== "line";

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: { labels, datasets },
      plugins: [limitLinesPlugin, stackedGroupBorderPlugin],
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
            stacked: stackedAxes,
            beginAtZero: true,
            ticks: {
              callback: (val) => convertMinutesTohhmm(val),
              font: { size: 11 },
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          x: {
            stacked: stackedAxes,
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
  }, [data, selected, granularity, fixedColors, chartType]);

  if (!data) return <p className="et-empty-message">Loading...</p>;
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

/**
 * Build a uid→color map for the Trends tab that mirrors TrendChart's color
 * assignment: fixed user colors take priority; children without a fixed color
 * get a tint derived from their parent's color (same logic as Totals tab).
 */
function buildTrendsColorMap(data, selected, fixedColors) {
  if (!data) return fixedColors;

  // Find parent→selected-children relationships
  const stackGroups = new Map();
  const walkForStackGroups = (cats) => {
    for (const cat of cats) {
      if (selected.has(cat.uid)) {
        const selectedChildren = (cat.children || []).filter((c) =>
          selected.has(c.uid),
        );
        if (selectedChildren.length > 0) {
          stackGroups.set(
            cat.uid,
            selectedChildren.map((c) => c.uid),
          );
        }
      }
      if (cat.children?.length) walkForStackGroups(cat.children);
    }
  };
  walkForStackGroups([...data.categories, ...(data.tags || [])]);

  const stackedChildUids = new Set([...stackGroups.values()].flat());
  const map = {};

  // Assign base colors to non-child categories
  let colorIndex = 0;
  for (const uid of selected) {
    if (stackedChildUids.has(uid)) continue;
    map[uid] =
      fixedColors[uid] || CHART_COLORS[colorIndex % CHART_COLORS.length];
    colorIndex++;
  }

  // Assign tinted colors to stacked children (replicating TrendChart logic)
  for (const [parentUid, childUids] of stackGroups) {
    const parentColor = map[parentUid];
    childUids.forEach((cuid, ci) => {
      map[cuid] =
        fixedColors[cuid] || childTintColor(parentColor, ci, childUids.length);
    });
  }

  return map;
}

/*──────────────────────────────────────────────────────────────────────────────
  TrendsView — trends tab with category picker, granularity switcher, chart,
  and CSV copy button
──────────────────────────────────────────────────────────────────────────────*/
export const TrendsView = ({
  data,
  selected,
  setSelected,
  fixedColors,
  granularity,
  setGranularity,
  chartType,
  setChartType,
  scopeCategory,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCSV = useCallback(() => {
    if (!data || selected.size === 0) return;
    const csv = buildTrendsCSV(data, selected, granularity);
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [data, selected, granularity]);

  // Full color map for the picker swatches (includes parent-derived tints)
  const pickerColorMap = useMemo(
    () => buildTrendsColorMap(data, selected, fixedColors),
    [data, selected, fixedColors],
  );

  // When scopeCategory is set, promote its children in the picker
  const pickerCategories = useMemo(() => {
    if (!scopeCategory || !data) return data?.categories || [];
    const scopeCat = data.categories.find((c) => c.uid === scopeCategory.uid);
    const promoted = scopeCat?.children?.length
      ? scopeCat.children
      : data.categories;
    const others = data.categories.filter(
      (c) => c.uid !== scopeCategory.uid && (data.totals[c.uid] || 0) > 0,
    );
    return [...promoted, ...others];
  }, [data, scopeCategory]);

  return (
    <div className="et-trends-layout">
      <CategoryPicker
        categories={pickerCategories}
        tags={data?.tags || []}
        totals={data?.totals || {}}
        selected={selected}
        onSelectionChange={setSelected}
        colorMap={pickerColorMap}
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
          <div className="bp3-button-group bp3-small">
            {[
              { key: "bar", label: "Bars" },
              { key: "line", label: "Lines" },
              { key: "both", label: "Both" },
            ].map((t) => (
              <button
                key={t.key}
                className={`bp3-button${chartType === t.key ? " bp3-active bp3-intent-primary" : ""}`}
                onClick={() => setChartType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            className={`bp3-button bp3-small bp3-minimal et-copy-btn${copied ? " et-copy-btn-done" : ""}`}
            onClick={handleCopyCSV}
            disabled={selected.size === 0}
            title="Copy chart data as CSV"
          >
            {copied ? "✓ Copied" : "Copy CSV"}
          </button>
        </div>
        <TrendChart
          data={data}
          selected={selected}
          fixedColors={fixedColors}
          granularity={granularity}
          chartType={chartType}
        />
      </div>
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  useDashboardData — shared data-fetch hook for both DNP and Page modes
──────────────────────────────────────────────────────────────────────────────*/
function useDashboardData(mode, pageUid, period) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (mode === "page" && !pageUid) {
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    const fetch =
      mode === "page"
        ? getDashboardDataForPage(pageUid, period.startDate, period.endDate)
        : getDashboardData(period.startDate, period.endDate);

    fetch.then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
      setSelected((prev) => {
        if (prev.size > 0) return prev;
        const scopeCategory = result.scopeCategory;
        const topCats = scopeCategory
          ? result.categories.find((c) => c.uid === scopeCategory.uid)
              ?.children || result.categories
          : result.categories;
        const top = topCats
          .map((cat) => ({ uid: cat.uid, time: result.totals[cat.uid] || 0 }))
          .sort((a, b) => b.time - a.time)
          .slice(0, 4)
          .filter((c) => c.time > 0)
          .map((c) => c.uid);
        return new Set(top);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mode, pageUid, period.startDate?.getTime(), period.endDate?.getTime()]);

  return { loading, data, selected, setSelected };
}

/*──────────────────────────────────────────────────────────────────────────────
  TimeDashboard — unified modal (DNP + Page modes)
──────────────────────────────────────────────────────────────────────────────*/
export const VALID_PERIODS = new Set(["day", "week", "month", "quarter"]);

const TimeDashboard = ({
  onClose,
  extensionAPI,
  initialPeriod,
  initialReferenceDate,
  initialPageUid,
  onOpenCategories,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("totals");
  // mode: "dnp" (daily note pages survey) | "page" (single-page survey)
  const [mode, setMode] = useState(initialPageUid ? "page" : "dnp");
  const [pageUid, setPageUid] = useState(initialPageUid || null);
  const [referenceDate] = useState(() => initialReferenceDate || new Date());
  const [period, setPeriod] = useState(() => {
    const preset = VALID_PERIODS.has(initialPeriod)
      ? initialPeriod
      : initialPageUid
        ? "month"
        : "day";
    const { startDate, endDate } = getDateRange(preset, initialReferenceDate);
    return { preset, startDate, endDate };
  });
  const [granularity, setGranularity] = useState("day");
  const [chartType, setChartType] = useState("bar");

  const { loading, data, selected, setSelected } = useDashboardData(
    mode,
    pageUid,
    period,
  );

  const handlePeriodChange = useCallback(
    (newPeriod) => setPeriod(newPeriod),
    [],
  );

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    // Switch to a sensible default period for each mode
    const preset = newMode === "page" ? "month" : "day";
    const { startDate, endDate } = getDateRange(preset, referenceDate);
    setPeriod({ preset, startDate, endDate });
  };

  const handlePageChange = useCallback((uid) => {
    setPageUid(uid);
    setSelected(new Set());
  }, []);

  const fixedColors = useMemo(
    () => (extensionAPI ? getCategoryColorsMap(extensionAPI) : {}),
    [extensionAPI],
  );

  const scopeCategory = data?.scopeCategory;

  const title =
    mode === "page" && data?.pageName
      ? `Time Dashboard — ${data.pageName}`
      : "Time Dashboard";

  if (!isOpen) return null;

  return (
    <div className="bp3-portal">
      <div className="bp3-overlay bp3-overlay-open">
        <div className="bp3-overlay-backdrop" onClick={handleClose} />
        <div className="bp3-dialog et-dashboard">
          <div className="bp3-dialog-header">
            <h4 className="bp3-heading">{title}</h4>
            <div className="et-mode-switcher">
              <button
                className={`bp3-button bp3-small${mode === "dnp" ? " bp3-active bp3-intent-primary" : ""}`}
                onClick={() => handleModeSwitch("dnp")}
                title="Survey Daily Note Pages"
              >
                Daily Notes
              </button>
              <button
                className={`bp3-button bp3-small${mode === "page" ? " bp3-active bp3-intent-primary" : ""}`}
                onClick={() => handleModeSwitch("page")}
                title="Survey a specific page"
              >
                Page
              </button>
            </div>
            {onOpenCategories && (
              <button
                className="bp3-button bp3-minimal bp3-small"
                title="Manage Categories"
                onClick={onOpenCategories}
              >
                <span className="bp3-icon bp3-icon-cog" />
              </button>
            )}
            <button
              className="bp3-dialog-close-button bp3-button bp3-minimal"
              onClick={handleClose}
            >
              <span className="bp3-icon bp3-icon-cross" />
            </button>
          </div>

          <div className="bp3-dialog-body et-dashboard-body">
            {mode === "page" && (
              <PageSelector
                extensionAPI={extensionAPI}
                pageUid={pageUid}
                onPageChange={handlePageChange}
              />
            )}

            <PeriodSelector
              preset={period.preset}
              startDate={period.startDate}
              endDate={period.endDate}
              referenceDate={referenceDate}
              onChange={handlePeriodChange}
            />

            {loading && (
              <div className="et-loading">
                <span className="bp3-spinner bp3-spinner-small" />
                <span>Loading data...</span>
              </div>
            )}

            {mode === "page" && !pageUid && !loading && (
              <p className="et-empty-message">
                Select a page above to display its time data.
              </p>
            )}

            {(mode === "dnp" || pageUid) && (
              <>
                <div className="et-tab-bar">
                  <button
                    className={`bp3-button bp3-minimal ${activeTab === "totals" ? "bp3-active et-tab-active" : ""}`}
                    onClick={() => setActiveTab("totals")}
                  >
                    Totals
                  </button>
                  <button
                    className={`bp3-button bp3-minimal ${activeTab === "trends" ? "bp3-active et-tab-active" : ""}`}
                    onClick={() => setActiveTab("trends")}
                  >
                    Trends
                  </button>
                </div>

                {!loading && activeTab === "totals" && (
                  <TotalsView
                    data={data}
                    preset={period.preset}
                    fixedColors={fixedColors}
                    scopeCategory={scopeCategory}
                  />
                )}

                {!loading && activeTab === "trends" && (
                  <TrendsView
                    data={data}
                    selected={selected}
                    setSelected={setSelected}
                    fixedColors={fixedColors}
                    granularity={granularity}
                    setGranularity={setGranularity}
                    chartType={chartType}
                    setChartType={setChartType}
                    scopeCategory={scopeCategory}
                  />
                )}
              </>
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
export function openTimeDashboard(
  extensionAPI,
  initialPeriod,
  initialReferenceDate,
  initialPageUid,
  onOpenCategories,
) {
  renderOverlay({
    Overlay: (props) => (
      <TimeDashboard
        {...props}
        extensionAPI={extensionAPI}
        initialPeriod={initialPeriod}
        initialReferenceDate={initialReferenceDate}
        initialPageUid={initialPageUid}
        onOpenCategories={onOpenCategories}
      />
    ),
  });
}

export default TimeDashboard;
