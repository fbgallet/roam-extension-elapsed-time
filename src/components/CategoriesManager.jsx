import React, { useState, useEffect, useRef, useCallback } from "react";
import renderOverlay from "roamjs-components/util/renderOverlay";
import {
  categoriesArray,
  getCategoryLimitsMap,
  saveLimitToSettings,
  migrateLimitsFromBlocks,
  onCategoriesChange,
} from "../categories";
import {
  convertMinutesTohhmm,
  convertStringDurationToMinutes,
} from "../util";

const INTERVALS = ["task", "day", "week", "month"];
const emptyIntervals = () => ({ task: 0, day: 0, week: 0, month: 0 });

/*──────────────────────────────────────────────────────────────────────────────
  DurationInput – text input that accepts "1h30", "45'", "90" and converts
  to/from minutes using existing util functions.
──────────────────────────────────────────────────────────────────────────────*/
const DurationInput = ({ value, onChange }) => {
  const [text, setText] = useState(value > 0 ? convertMinutesTohhmm(value) : "");

  useEffect(() => {
    setText(value > 0 ? convertMinutesTohhmm(value) : "");
  }, [value]);

  const handleBlur = () => {
    if (text.trim() === "") {
      onChange(0);
      return;
    }
    const minutes = convertStringDurationToMinutes(text.trim());
    if (minutes !== null && !isNaN(minutes)) {
      onChange(minutes);
      setText(convertMinutesTohhmm(minutes));
    } else {
      // Try plain number (minutes)
      const num = parseInt(text.trim(), 10);
      if (!isNaN(num) && num >= 0) {
        onChange(num);
        setText(num > 0 ? convertMinutesTohhmm(num) : "");
      } else {
        setText(value > 0 ? convertMinutesTohhmm(value) : "");
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") e.target.blur();
  };

  return (
    <input
      className="bp3-input et-duration-input"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="e.g. 1h30"
    />
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  LimitBadge – compact tags showing goal/limit info next to category name
──────────────────────────────────────────────────────────────────────────────*/
const LimitBadge = ({ config }) => {
  if (!config) return null;
  const badges = [];

  ["goal", "limit"].forEach((type) => {
    if (!config[type]) return;
    const activeIntervals = INTERVALS.filter((i) => config[type][i] > 0);
    if (activeIntervals.length === 0) return;
    const label = activeIntervals
      .map((i) => `${convertMinutesTohhmm(config[type][i])}/${i}`)
      .join(", ");
    badges.push(
      <span
        key={type}
        className={`bp3-tag bp3-minimal bp3-intent-${type === "goal" ? "success" : "warning"} et-limit-badge`}
      >
        {type === "goal" ? "Goal" : "Limit"}: {label}
      </span>
    );
  });

  return badges.length > 0 ? <span className="et-badges">{badges}</span> : null;
};

/*──────────────────────────────────────────────────────────────────────────────
  LimitSection – one section (goal or limit) with 4 interval inputs
──────────────────────────────────────────────────────────────────────────────*/
const LimitSection = ({ type, intervals, onChange }) => {
  const hasAny = INTERVALS.some((i) => intervals[i] > 0);
  const [enabled, setEnabled] = useState(hasAny);

  useEffect(() => {
    setEnabled(INTERVALS.some((i) => intervals[i] > 0));
  }, [intervals]);

  const handleToggle = () => {
    if (enabled) {
      // Clear all intervals
      INTERVALS.forEach((i) => onChange(type, i, 0));
    }
    setEnabled(!enabled);
  };

  return (
    <div className="et-limit-section">
      <label className="et-limit-section-header">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          className="bp3-checkbox-input"
        />
        <span className={`et-limit-type-label ${type}`}>
          {type === "goal" ? "🎯 Goal (minimum)" : "🛑 Limit (maximum)"}
        </span>
      </label>
      {enabled && (
        <div className="et-limit-intervals">
          {INTERVALS.map((interval) => (
            <div key={interval} className="et-limit-interval-row">
              <label className="et-interval-label">/{interval}:</label>
              <DurationInput
                value={intervals[interval] || 0}
                onChange={(val) => onChange(type, interval, val)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  LimitEditor – inline editor showing both goal and limit sections
──────────────────────────────────────────────────────────────────────────────*/
const LimitEditor = ({ config, onChange }) => {
  return (
    <div className="et-limit-editor">
      <LimitSection
        type="goal"
        intervals={config?.goal || emptyIntervals()}
        onChange={onChange}
      />
      <LimitSection
        type="limit"
        intervals={config?.limit || emptyIntervals()}
        onChange={onChange}
      />
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  CategoryTreeNode – recursive component for a single category row + children
──────────────────────────────────────────────────────────────────────────────*/
const TYPE_ICONS = {
  text: "○",
  pageRef: "◆",
  blockRef: "◇",
};

const CategoryTreeNode = ({
  category,
  depth,
  limitsMap,
  onUpdateLimit,
  expandedSet,
  onToggleExpand,
  editingUid,
  onToggleEdit,
}) => {
  const hasChildren = category.children?.length > 0;
  const isExpanded = expandedSet.has(category.uid);
  const isEditing = editingUid === category.uid;
  const config = limitsMap[category.uid];

  const handleChange = (type, interval, value) => {
    const current = config || { goal: emptyIntervals(), limit: emptyIntervals() };
    const updated = {
      goal: { ...current.goal },
      limit: { ...current.limit },
    };
    updated[type][interval] = value;
    onUpdateLimit(category.uid, updated);
  };

  const isTopLevel = depth === 0;

  return (
    <>
      <div
        className={`et-category-row ${isTopLevel ? "et-top-level" : "et-sub-level"} ${isEditing ? "et-editing" : ""}`}
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        <span
          className="et-expand-arrow"
          onClick={() => hasChildren && onToggleExpand(category.uid)}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          {isExpanded ? "▾" : "▸"}
        </span>
        <span className="et-type-icon" title={category.type}>
          {TYPE_ICONS[category.type] || "○"}
        </span>
        <span className="et-category-name" onClick={() => onToggleEdit(category.uid)}>
          {category.name}
        </span>
        <LimitBadge config={config} />
        <button
          className="bp3-button bp3-minimal bp3-small et-edit-btn"
          onClick={() => onToggleEdit(category.uid)}
          title="Edit goals & limits"
        >
          {isEditing ? "✕" : "✎"}
        </button>
      </div>
      {isEditing && (
        <div style={{ paddingLeft: depth * 20 + 28 }}>
          <LimitEditor config={config} onChange={handleChange} />
        </div>
      )}
      {isExpanded &&
        hasChildren &&
        category.children.map((child) => (
          <CategoryTreeNode
            key={child.uid}
            category={child}
            depth={depth + 1}
            limitsMap={limitsMap}
            onUpdateLimit={onUpdateLimit}
            expandedSet={expandedSet}
            onToggleExpand={onToggleExpand}
            editingUid={editingUid}
            onToggleEdit={onToggleEdit}
          />
        ))}
    </>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  MigrationBanner – shown when old block-based limits exist but no settings yet
──────────────────────────────────────────────────────────────────────────────*/
const MigrationBanner = ({ limitsUID, extensionAPI, onMigrated }) => {
  const [migrating, setMigrating] = useState(false);

  const handleMigrate = () => {
    setMigrating(true);
    const result = migrateLimitsFromBlocks(limitsUID, extensionAPI);
    if (result) {
      onMigrated(result);
    }
    setMigrating(false);
  };

  return (
    <div className="et-migrate-banner">
      <span>
        Goals & limits are currently stored as Roam blocks. Migrate them to
        extension settings for easier management?
      </span>
      <button
        className="bp3-button bp3-intent-primary bp3-small"
        onClick={handleMigrate}
        disabled={migrating}
      >
        {migrating ? "Migrating..." : "Migrate Now"}
      </button>
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  CategoriesManager – main dialog component
──────────────────────────────────────────────────────────────────────────────*/
const CategoriesManager = ({ onClose, extensionAPI, categoriesUID, limitsUID }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("tree");
  const [limitsMap, setLimitsMap] = useState({});
  const [editingUid, setEditingUid] = useState(null);
  const [expandedSet, setExpandedSet] = useState(() => {
    // Expand all top-level categories by default
    const set = new Set();
    categoriesArray.forEach((cat) => {
      if (!cat.parent && cat.children?.length > 0) set.add(cat.uid);
    });
    return set;
  });
  const [showMigration, setShowMigration] = useState(false);
  // Snapshot of top-level categories stored as React state so re-renders fire
  // when the module-level categoriesArray is mutated by the pull watch.
  const [topLevelCategories, setTopLevelCategories] = useState(() =>
    categoriesArray.filter((cat) => !cat.parent)
  );
  const roamViewRef = useRef(null);

  // Subscribe to live category changes (pull watch fires → getCategories →
  // notifyCategoriesChange → this callback → React re-render with fresh snapshot)
  useEffect(() => {
    console.log("[ET] CategoriesManager: registering onCategoriesChange listener");
    const unsubscribe = onCategoriesChange((v) => {
      console.log("[ET] CategoriesManager: onCategoriesChange fired, version:", v, "top-level count:", categoriesArray.filter(c => !c.parent).length);
      setTopLevelCategories(categoriesArray.filter((cat) => !cat.parent));
      // Also auto-expand any newly added top-level categories with children
      setExpandedSet((prev) => {
        const next = new Set(prev);
        categoriesArray.forEach((cat) => {
          if (!cat.parent && cat.children?.length > 0) next.add(cat.uid);
        });
        return next;
      });
    });
    return () => { console.log("[ET] CategoriesManager: unsubscribing listener"); unsubscribe(); };
  }, []);

  useEffect(() => {
    const stored = getCategoryLimitsMap(extensionAPI);
    setLimitsMap(stored);
    // Show migration banner if old block-based limits exist but no settings
    if (
      (!stored || Object.keys(stored).length === 0) &&
      limitsUID
    ) {
      setShowMigration(true);
    }
  }, []);

  // When switching tabs: render Roam blocks on Roam tab, re-snapshot categories on Tree tab
  useEffect(() => {
    if (activeTab === "roam") {
      if (roamViewRef.current && categoriesUID) {
        roamViewRef.current.innerHTML = "";
        window.roamAlphaAPI.ui.components.renderBlock({
          uid: categoriesUID,
          el: roamViewRef.current,
          "open?": true,
          "zoom-path?": true,
        });
      }
    } else {
      // Switching back to Tree View: refresh the category snapshot
      setTopLevelCategories(categoriesArray.filter((cat) => !cat.parent));
    }
    return () => {
      if (roamViewRef.current) roamViewRef.current.innerHTML = "";
    };
  }, [activeTab, categoriesUID]);

  const handleUpdateLimit = useCallback(
    (uid, config) => {
      setLimitsMap((prev) => {
        const updated = { ...prev, [uid]: config };
        // Auto-save
        saveLimitToSettings(extensionAPI, uid, config);
        return updated;
      });
    },
    [extensionAPI]
  );

  const handleToggleExpand = useCallback((uid) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const handleToggleEdit = useCallback((uid) => {
    setEditingUid((prev) => (prev === uid ? null : uid));
  }, []);

  const handleMigrated = (migratedMap) => {
    setLimitsMap(migratedMap);
    setShowMigration(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="bp3-portal">
      <div className="bp3-overlay bp3-overlay-open">
        <div className="bp3-overlay-backdrop" onClick={handleClose} />
        <div className="bp3-dialog et-categories-manager">
          <div className="bp3-dialog-header">
            <h4 className="bp3-heading">Categories, Goals & Limits</h4>
            <button
              className="bp3-dialog-close-button bp3-button bp3-minimal"
              onClick={handleClose}
            >
              <span className="bp3-icon bp3-icon-cross" />
            </button>
          </div>
          <div className="bp3-dialog-body">
            {showMigration && (
              <MigrationBanner
                limitsUID={limitsUID}
                extensionAPI={extensionAPI}
                onMigrated={handleMigrated}
              />
            )}
            <div className="et-tab-bar">
              <button
                className={`bp3-button bp3-minimal ${activeTab === "tree" ? "bp3-active et-tab-active" : ""}`}
                onClick={() => setActiveTab("tree")}
              >
                Tree View
              </button>
              <button
                className={`bp3-button bp3-minimal ${activeTab === "roam" ? "bp3-active et-tab-active" : ""}`}
                onClick={() => setActiveTab("roam")}
              >
                Roam View
              </button>
            </div>

            {activeTab === "tree" && (
              <div className="et-tree-view">
                {topLevelCategories.length === 0 ? (
                  <p className="et-empty-message">
                    No categories defined. Set a categories block reference in
                    the extension settings, or create categories on the
                    "roam/depot/time tracker" page.
                  </p>
                ) : (
                  topLevelCategories.map((cat) => (
                    <CategoryTreeNode
                      key={cat.uid}
                      category={cat}
                      depth={0}
                      limitsMap={limitsMap}
                      onUpdateLimit={handleUpdateLimit}
                      expandedSet={expandedSet}
                      onToggleExpand={handleToggleExpand}
                      editingUid={editingUid}
                      onToggleEdit={handleToggleEdit}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "roam" && (
              <div className="et-roam-view">
                {categoriesUID ? (
                  <>
                    <p className="et-roam-view-hint">
                      Edit categories directly in Roam's native block editor:
                    </p>
                    <div ref={roamViewRef} className="et-roam-view-container" />
                  </>
                ) : (
                  <p className="et-empty-message">
                    No categories block reference set. Configure it in extension
                    settings first.
                  </p>
                )}
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
  Launcher function – opens the dialog via renderOverlay
──────────────────────────────────────────────────────────────────────────────*/
export function openCategoriesManager(extensionAPI, categoriesUID, limitsUID) {
  renderOverlay({
    Overlay: (props) => (
      <CategoriesManager
        {...props}
        extensionAPI={extensionAPI}
        categoriesUID={categoriesUID}
        limitsUID={limitsUID}
      />
    ),
  });
}

export default CategoriesManager;
