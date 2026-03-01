import React, { useState, useEffect, useCallback, useMemo } from "react";
import { renderOverlay } from "./renderOverlay";
import { getDateRange } from "../dashboardData";
import { getDashboardDataForPage } from "../pageDashboardData";
import { getCategoryColorsMap } from "./CategoriesManager";
import {
  PeriodSelector,
  TotalsView,
  TrendsView,
  CHART_COLORS,
  VALID_PERIODS,
} from "./TimeDashboard";

/*──────────────────────────────────────────────────────────────────────────────
  PageTimeDashboard — dashboard scoped to a specific page and its references
──────────────────────────────────────────────────────────────────────────────*/
const PageTimeDashboard = ({
  onClose,
  extensionAPI,
  initialPeriod,
  initialReferenceDate,
  pageUid,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("totals");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(() => {
    const preset = VALID_PERIODS.has(initialPeriod) ? initialPeriod : "month";
    const { startDate, endDate } = getDateRange(preset, initialReferenceDate);
    return { preset, startDate, endDate };
  });
  const [selected, setSelected] = useState(new Set());
  const [granularity, setGranularity] = useState("day");

  // Fetch page-scoped data when period changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDashboardDataForPage(pageUid, period.startDate, period.endDate).then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);

        // Auto-select top categories by total time (up to 4)
        setSelected((prev) => {
          if (prev.size > 0) return prev;
          // When scope category exists, pick from its children
          const topCats = result.scopeCategory
            ? (
                result.categories.find(
                  (c) => c.uid === result.scopeCategory.uid
                )?.children || result.categories
              )
            : result.categories;
          const topLevel = topCats
            .map((cat) => ({
              uid: cat.uid,
              time: result.totals[cat.uid] || 0,
            }))
            .sort((a, b) => b.time - a.time)
            .slice(0, 4)
            .filter((c) => c.time > 0)
            .map((c) => c.uid);
          return new Set(topLevel);
        });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [pageUid, period.startDate?.getTime(), period.endDate?.getTime()]);

  const handlePeriodChange = useCallback((newPeriod) => {
    setPeriod(newPeriod);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const fixedColors = useMemo(
    () => (extensionAPI ? getCategoryColorsMap(extensionAPI) : {}),
    [extensionAPI]
  );

  const colorMap = useMemo(() => {
    const map = {};
    let i = 0;
    for (const uid of selected) {
      if (fixedColors[uid]) {
        map[uid] = fixedColors[uid];
      } else {
        map[uid] = CHART_COLORS[i % CHART_COLORS.length];
      }
      i++;
    }
    return map;
  }, [selected, fixedColors]);

  if (!isOpen) return null;

  const title = data?.pageName
    ? `Time Dashboard — ${data.pageName}`
    : "Time Dashboard — Page";

  return (
    <div className="bp3-portal">
      <div className="bp3-overlay bp3-overlay-open">
        <div className="bp3-overlay-backdrop" onClick={handleClose} />
        <div className="bp3-dialog et-dashboard">
          <div className="bp3-dialog-header">
            <h4 className="bp3-heading">{title}</h4>
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

            {!loading && activeTab === "totals" && (
              <TotalsView
                data={data}
                preset={period.preset}
                fixedColors={fixedColors}
                scopeCategory={data?.scopeCategory}
              />
            )}

            {!loading && activeTab === "trends" && (
              <TrendsView
                data={data}
                selected={selected}
                setSelected={setSelected}
                colorMap={colorMap}
                granularity={granularity}
                setGranularity={setGranularity}
                scopeCategory={data?.scopeCategory}
              />
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
export function openPageTimeDashboard(
  extensionAPI,
  initialPeriod,
  initialReferenceDate,
  pageUid
) {
  renderOverlay({
    Overlay: (props) => (
      <PageTimeDashboard
        {...props}
        extensionAPI={extensionAPI}
        initialPeriod={initialPeriod}
        initialReferenceDate={initialReferenceDate}
        pageUid={pageUid}
      />
    ),
  });
}

export default PageTimeDashboard;
