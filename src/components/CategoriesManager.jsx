import React, { useState, useEffect, useRef, useCallback } from "react";
import { renderOverlay } from "./renderOverlay";
import {
  categoriesArray,
  getCategoryLimitsMap,
  saveLimitToSettings,
  migrateLimitsFromBlocks,
  onCategoriesChange,
  getCategoryAliasesMap,
  saveCategoryAliases,
  getCategories,
} from "../categories";
import {
  convertMinutesTohhmm,
  convertStringDurationToMinutes,
  createBlock,
  updateBlock,
  normalizeUID,
} from "../util";
import { createSettingsPage, createCategoriesBlock } from "../data";

const INTERVALS = ["task", "day", "week", "month"];
const emptyIntervals = () => ({ task: 0, day: 0, week: 0, month: 0 });

const COLOR_PALETTE = [
  "#2965CC",
  "#29A634",
  "#D99E0B",
  "#D13913",
  "#8F398F",
  "#00B3A4",
  "#DB2C6F",
  "#667580",
  "#946638",
  "#5642A6",
];

/*──────────────────────────────────────────────────────────────────────────────
  Helpers for category colors stored in extension settings
──────────────────────────────────────────────────────────────────────────────*/
export function getCategoryColorsMap(extensionAPI) {
  return extensionAPI.settings.get("categoryColors") || {};
}

function saveCategoryColor(extensionAPI, uid, color) {
  const map = extensionAPI.settings.get("categoryColors") || {};
  if (color) map[uid] = color;
  else delete map[uid];
  extensionAPI.settings.set("categoryColors", map);
}

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
  ColorPicker – row of color swatches + "Auto" option + native color input
──────────────────────────────────────────────────────────────────────────────*/
const ColorPicker = ({ selectedColor, onColorChange }) => {
  const colorInputRef = useRef(null);
  // Detect if selectedColor is a custom color (not in palette)
  const isCustom = selectedColor && !COLOR_PALETTE.includes(selectedColor);

  return (
    <div className="et-color-picker">
      <span className="et-color-picker-label">Chart color:</span>
      <button
        className={`et-color-swatch-option et-auto-color ${!selectedColor ? "et-selected" : ""}`}
        onClick={() => onColorChange(null)}
        title="Auto (derived from position)"
      >
        A
      </button>
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          className={`et-color-swatch-option ${selectedColor === color ? "et-selected" : ""}`}
          style={{ backgroundColor: color }}
          onClick={() => onColorChange(color)}
          title={color}
        />
      ))}
      {/* Custom color: native color picker */}
      <label
        className={`et-color-swatch-option et-custom-color-btn ${isCustom ? "et-selected" : ""}`}
        style={isCustom ? { backgroundColor: selectedColor } : {}}
        title="Custom color…"
      >
        {!isCustom && <span className="et-custom-color-icon">✦</span>}
        <input
          ref={colorInputRef}
          type="color"
          className="et-color-input-hidden"
          value={selectedColor && selectedColor.startsWith("#") ? selectedColor : "#2965cc"}
          onChange={(e) => onColorChange(e.target.value)}
        />
      </label>
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  InlineAddForm – text input + confirm/cancel for adding categories
──────────────────────────────────────────────────────────────────────────────*/
const InlineAddForm = ({ onConfirm, onCancel, placeholder }) => {
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onConfirm(trimmed);
      setText("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="et-inline-form">
      <input
        ref={inputRef}
        className="bp3-input et-add-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Category name"}
      />
      <button
        className="bp3-button bp3-small bp3-intent-primary"
        onClick={handleConfirm}
        disabled={!text.trim()}
      >
        Add
      </button>
      <button
        className="bp3-button bp3-small bp3-minimal"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  DeleteConfirmation – inline warning before deleting
──────────────────────────────────────────────────────────────────────────────*/
const DeleteConfirmation = ({ categoryName, onConfirm, onCancel, isTag }) => {
  return (
    <div className="et-confirm-dialog">
      <p className="et-confirm-text">
        Delete <strong>{categoryName}</strong>
        {!isTag && " and all its subcategories"} from your Roam graph? This
        cannot be undone.
      </p>
      <div className="et-confirm-actions">
        <button
          className="bp3-button bp3-small bp3-intent-danger"
          onClick={onConfirm}
        >
          Delete
        </button>
        <button
          className="bp3-button bp3-small bp3-minimal"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/*──────────────────────────────────────────────────────────────────────────────
  CategoryTreeNode – recursive component for a single category row + children
──────────────────────────────────────────────────────────────────────────────*/
const CategoryTreeNode = ({
  category,
  depth,
  limitsMap,
  colorsMap,
  aliasesMap,
  onUpdateLimit,
  onUpdateColor,
  onUpdateAliases,
  expandedSet,
  onToggleExpand,
  editingUid,
  onToggleEdit,
  onAddSubcategory,
  onRename,
  onDelete,
  nodeRef,
  isTag,
}) => {
  const hasChildren = category.children?.length > 0;
  const isExpanded = expandedSet.has(category.uid);
  const isEditing = editingUid === category.uid;
  const config = limitsMap[category.uid];
  const fixedColor = colorsMap[category.uid];
  const aliases = aliasesMap[category.uid] || [];

  const [editName, setEditName] = useState(category.name);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [aliasText, setAliasText] = useState("");
  const nameInputRef = useRef(null);
  const aliasInputRef = useRef(null);

  useEffect(() => {
    setEditName(category.name);
  }, [category.name]);

  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (showAddAlias && aliasInputRef.current) {
      aliasInputRef.current.focus();
    }
  }, [showAddAlias]);

  const handleChange = (type, interval, value) => {
    const current = config || { goal: emptyIntervals(), limit: emptyIntervals() };
    const updated = {
      goal: { ...current.goal },
      limit: { ...current.limit },
    };
    updated[type][interval] = value;
    onUpdateLimit(category.uid, updated);
  };

  const handleRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(category.uid, trimmed);
    } else {
      setEditName(category.name);
    }
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    }
    if (e.key === "Escape") {
      setEditName(category.name);
      e.target.blur();
    }
  };

  const handleAddAlias = () => {
    const trimmed = aliasText.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      onUpdateAliases(category.uid, [...aliases, trimmed]);
    }
    setAliasText("");
    setShowAddAlias(false);
  };

  const handleRemoveAlias = (alias) => {
    onUpdateAliases(category.uid, aliases.filter((a) => a !== alias));
  };

  const handleAliasKeyDown = (e) => {
    if (e.key === "Enter") handleAddAlias();
    if (e.key === "Escape") {
      setAliasText("");
      setShowAddAlias(false);
    }
  };

  const isTopLevel = depth === 0;
  const accentColor = fixedColor || (isTag ? "#7c7caa" : isTopLevel ? "#bbb" : "#ddd");

  return (
    <>
      <div
        ref={nodeRef}
        className={`et-category-row ${isTopLevel ? "et-top-level" : "et-sub-level"} ${isEditing ? "et-editing" : ""}`}
        style={{
          paddingLeft: depth * 20 + 8,
          borderLeft: `3px solid ${accentColor}`,
        }}
      >
        <span
          className="et-expand-arrow"
          onClick={() => hasChildren && onToggleExpand(category.uid)}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          {isExpanded ? "▾" : "▸"}
        </span>
        {isEditing ? (
          <input
            ref={nameInputRef}
            className={`et-category-name-editing ${isTopLevel ? "et-top-level-name" : "et-sub-level-name"}`}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleRenameKeyDown}
          />
        ) : (
          <span className="et-category-name" onClick={() => onToggleEdit(category.uid)}>
            {category.displayName || category.name}
          </span>
        )}
        {aliases.length > 0 && (
          <span className="et-aliases-inline">
            {aliases.join(", ")}
          </span>
        )}
        <LimitBadge config={config} />
        <button
          className="bp3-button bp3-minimal bp3-small et-edit-btn"
          onClick={() => onToggleEdit(category.uid)}
          title="Edit category"
        >
          {isEditing ? "✕" : "✎"}
        </button>
      </div>
      {isEditing && (
        <div
          className="et-edit-panel"
          style={{ paddingLeft: depth * 20 + 20 }}
        >
          {/* Color picker */}
          <div className="et-edit-section">
            <ColorPicker
              selectedColor={fixedColor}
              onColorChange={(color) => onUpdateColor(category.uid, color)}
            />
          </div>
          {/* Aliases */}
          <div className="et-edit-section">
            <label className="et-edit-label">Aliases</label>
            <div className="et-alias-list">
              {aliases.map((alias) => (
                <span key={alias} className="bp3-tag bp3-minimal et-alias-tag">
                  {alias}
                  <button
                    className="bp3-tag-remove et-alias-remove"
                    onClick={() => handleRemoveAlias(alias)}
                  />
                </span>
              ))}
              {showAddAlias ? (
                <span className="et-alias-add-wrapper">
                  <input
                    ref={aliasInputRef}
                    className="bp3-input et-alias-add-input"
                    value={aliasText}
                    onChange={(e) => setAliasText(e.target.value)}
                    onKeyDown={handleAliasKeyDown}
                    onBlur={() => {
                      if (aliasText.trim()) handleAddAlias();
                      else setShowAddAlias(false);
                    }}
                    placeholder="Alias or [[page ref]]"
                  />
                </span>
              ) : (
                <button
                  className="bp3-button bp3-small bp3-minimal et-action-btn"
                  onClick={() => setShowAddAlias(true)}
                >
                  + Add alias
                </button>
              )}
            </div>
          </div>
          {/* Goals & Limits */}
          <LimitEditor config={config} onChange={handleChange} />
          {/* Add subcategory – not available for tags */}
          {!isTag && (
            <div className="et-edit-section">
              {showAddSub ? (
                <InlineAddForm
                  onConfirm={(name) => {
                    onAddSubcategory(category.uid, name);
                    setShowAddSub(false);
                  }}
                  onCancel={() => setShowAddSub(false)}
                  placeholder="Subcategory name"
                />
              ) : (
                <button
                  className="bp3-button bp3-small bp3-minimal et-action-btn"
                  onClick={() => setShowAddSub(true)}
                >
                  + Add subcategory
                </button>
              )}
            </div>
          )}
          {/* Delete */}
          <div className="et-edit-section">
            {showDeleteConfirm ? (
              <DeleteConfirmation
                categoryName={category.displayName || category.name}
                isTag={isTag}
                onConfirm={() => {
                  onDelete(category.uid);
                  setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
              />
            ) : (
              <button
                className="bp3-button bp3-small bp3-minimal bp3-intent-danger et-action-btn"
                onClick={() => setShowDeleteConfirm(true)}
              >
                {isTag ? "Delete tag" : "Delete category"}
              </button>
            )}
          </div>
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
            colorsMap={colorsMap}
            aliasesMap={aliasesMap}
            onUpdateLimit={onUpdateLimit}
            onUpdateColor={onUpdateColor}
            onUpdateAliases={onUpdateAliases}
            expandedSet={expandedSet}
            onToggleExpand={onToggleExpand}
            editingUid={editingUid}
            onToggleEdit={onToggleEdit}
            onAddSubcategory={onAddSubcategory}
            onRename={onRename}
            onDelete={onDelete}
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
  const [colorsMap, setColorsMap] = useState({});
  const [aliasesMap, setAliasesMap] = useState({});
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
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  // Snapshot of top-level categories stored as React state so re-renders fire
  // when the module-level categoriesArray is mutated by the pull watch.
  const [topLevelCategories, setTopLevelCategories] = useState(() =>
    categoriesArray.filter((cat) => !cat.parent && !cat.isTag)
  );
  const [tagCategories, setTagCategories] = useState(() =>
    categoriesArray.filter((cat) => cat.isTag)
  );
  const roamViewRef = useRef(null);
  const treeViewRef = useRef(null);

  // Subscribe to live category changes (pull watch fires → getCategories →
  // notifyCategoriesChange → this callback → React re-render with fresh snapshot)
  useEffect(() => {
    const unsubscribe = onCategoriesChange(() => {
      setTopLevelCategories(categoriesArray.filter((cat) => !cat.parent && !cat.isTag));
      setTagCategories(categoriesArray.filter((cat) => cat.isTag));
      // Also auto-expand any newly added top-level categories with children
      setExpandedSet((prev) => {
        const next = new Set(prev);
        categoriesArray.forEach((cat) => {
          if (!cat.parent && cat.children?.length > 0) next.add(cat.uid);
        });
        return next;
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const stored = getCategoryLimitsMap(extensionAPI);
    setLimitsMap(stored);
    setColorsMap(getCategoryColorsMap(extensionAPI));
    setAliasesMap(getCategoryAliasesMap(extensionAPI));
    // Show migration banner if old block-based limits exist but no settings
    if (
      (!stored || Object.keys(stored).length === 0) &&
      limitsUID
    ) {
      setShowMigration(true);
    }
  }, []);

  // Click outside the tree view to close editing
  useEffect(() => {
    if (!editingUid) return;
    const handleMouseDown = (e) => {
      if (treeViewRef.current && !treeViewRef.current.contains(e.target)) {
        // Blur any focused input first so its onBlur handler (e.g. handleRename)
        // fires and saves the value before the editing panel is unmounted.
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        setEditingUid(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [editingUid]);

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
      // Switching back to Manage categories: force a fresh read from Roam DB
      // so any reordering done in the Roam View tab is reflected immediately.
      if (categoriesUID) getCategories(normalizeUID(categoriesUID));
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

  const handleUpdateColor = useCallback(
    (uid, color) => {
      setColorsMap((prev) => {
        const updated = { ...prev };
        if (color) updated[uid] = color;
        else delete updated[uid];
        saveCategoryColor(extensionAPI, uid, color);
        return updated;
      });
    },
    [extensionAPI]
  );

  const handleUpdateAliases = useCallback(
    (uid, aliases) => {
      setAliasesMap((prev) => {
        const updated = { ...prev };
        if (aliases && aliases.length > 0) updated[uid] = aliases;
        else delete updated[uid];
        saveCategoryAliases(extensionAPI, uid, aliases);
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

  const handleAddCategory = useCallback(
    async (name) => {
      if (!categoriesUID) return;
      await createBlock(categoriesUID, name);
      setShowAddCategory(false);
    },
    [categoriesUID]
  );

  const handleAddTag = useCallback(
    async (name) => {
      if (!categoriesUID) return;
      const tagName = name.startsWith("#") ? name : `#${name}`;
      await createBlock(categoriesUID, tagName);
      setShowAddTag(false);
    },
    [categoriesUID]
  );

  const handleAddSubcategory = useCallback(
    async (parentUid, name) => {
      await createBlock(parentUid, name);
      // Auto-expand the parent so the new child is visible
      setExpandedSet((prev) => {
        const next = new Set(prev);
        next.add(parentUid);
        return next;
      });
    },
    []
  );

  const handleRename = useCallback((uid, newName) => {
    updateBlock(uid, newName);
  }, []);

  const handleDelete = useCallback((uid) => {
    setEditingUid(null);
    window.roamAlphaAPI.deleteBlock({ block: { uid } });
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
                Manage categories
              </button>
              <button
                className={`bp3-button bp3-minimal ${activeTab === "roam" ? "bp3-active et-tab-active" : ""}`}
                onClick={() => setActiveTab("roam")}
              >
                Roam View
              </button>
            </div>

            {activeTab === "tree" && (
              <div className="et-tree-view" ref={treeViewRef}>
                {topLevelCategories.length === 0 && tagCategories.length === 0 ? (
                  <p className="et-empty-message">
                    No categories defined. Set a categories block reference in
                    the extension settings, or create categories on the
                    "roam/depot/time tracker" page.
                  </p>
                ) : (
                  <>
                    {topLevelCategories.map((cat) => (
                      <CategoryTreeNode
                        key={cat.uid}
                        category={cat}
                        depth={0}
                        limitsMap={limitsMap}
                        colorsMap={colorsMap}
                        aliasesMap={aliasesMap}
                        onUpdateLimit={handleUpdateLimit}
                        onUpdateColor={handleUpdateColor}
                        onUpdateAliases={handleUpdateAliases}
                        expandedSet={expandedSet}
                        onToggleExpand={handleToggleExpand}
                        editingUid={editingUid}
                        onToggleEdit={handleToggleEdit}
                        onAddSubcategory={handleAddSubcategory}
                        onRename={handleRename}
                        onDelete={handleDelete}
                      />
                    ))}
                    {/* Add category button */}
                    {categoriesUID && (
                      <div className="et-add-section">
                        {showAddCategory ? (
                          <InlineAddForm
                            onConfirm={handleAddCategory}
                            onCancel={() => setShowAddCategory(false)}
                            placeholder="New category name"
                          />
                        ) : (
                          <button
                            className="bp3-button bp3-small bp3-minimal et-add-btn"
                            onClick={() => setShowAddCategory(true)}
                          >
                            + Add category
                          </button>
                        )}
                      </div>
                    )}

                    {/* Tags section */}
                    <div className="et-tags-section">
                      <div className="et-tags-section-header">Tags</div>
                      {tagCategories.map((cat) => (
                        <CategoryTreeNode
                          key={cat.uid}
                          category={cat}
                          depth={0}
                          limitsMap={limitsMap}
                          colorsMap={colorsMap}
                          aliasesMap={aliasesMap}
                          onUpdateLimit={handleUpdateLimit}
                          onUpdateColor={handleUpdateColor}
                          onUpdateAliases={handleUpdateAliases}
                          expandedSet={expandedSet}
                          onToggleExpand={handleToggleExpand}
                          editingUid={editingUid}
                          onToggleEdit={handleToggleEdit}
                          onRename={handleRename}
                          onDelete={handleDelete}
                          isTag={true}
                        />
                      ))}
                      {/* Add tag button */}
                      {categoriesUID && (
                        <div className="et-add-section">
                          {showAddTag ? (
                            <InlineAddForm
                              onConfirm={handleAddTag}
                              onCancel={() => setShowAddTag(false)}
                              placeholder="Tag name (without #)"
                            />
                          ) : (
                            <button
                              className="bp3-button bp3-small bp3-minimal et-add-btn"
                              onClick={() => setShowAddTag(true)}
                            >
                              + Add tag
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
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
  Launcher function – opens the dialog via renderOverlay.
  If no categoriesUID is set yet (fresh install), auto-creates the parent block
  on [[roam/depot/time tracker]] before opening. Calls onCategoriesCreated(uid)
  so index.js can update its module-level variable and register the pull watch.
──────────────────────────────────────────────────────────────────────────────*/
export async function openCategoriesManager(
  extensionAPI,
  categoriesUID,
  limitsUID,
  onCategoriesCreated,
) {
  let uid = categoriesUID;
  if (!uid) {
    const pageUid = await createSettingsPage(extensionAPI);
    if (pageUid) {
      uid = await createCategoriesBlock(pageUid, extensionAPI);
      onCategoriesCreated?.(uid);
    }
  }
  renderOverlay({
    Overlay: (props) => (
      <CategoriesManager
        {...props}
        extensionAPI={extensionAPI}
        categoriesUID={uid}
        limitsUID={limitsUID}
      />
    ),
  });
}

export default CategoriesManager;
