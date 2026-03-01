import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { renderOverlay } from "./renderOverlay";
import { categoriesArray } from "../categories";
import { getCategoryColorsMap } from "./CategoriesManager";
import { getBlockContent } from "../util";

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

const timestampRegex = /[0-9]{1,2}:[0-9]{1,2}/g;

function getCategoryColor(cat, colorsMap, index) {
  if (colorsMap[cat.uid]) return colorsMap[cat.uid];
  if (cat.parent && colorsMap[cat.parent.uid]) return colorsMap[cat.parent.uid];
  const topLevel = categoriesArray.filter((c) => !c.parent && !c.isTag);
  const topIndex = cat.parent
    ? topLevel.indexOf(cat.parent)
    : topLevel.indexOf(cat);
  if (topIndex >= 0) return COLOR_PALETTE[topIndex % COLOR_PALETTE.length];
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function formatLimit(minutes) {
  if (!minutes) return null;
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m < 10 ? "0" : ""}${m}` : `${h}h`;
  }
  return `${minutes}'`;
}

function matchesFilter(cat, filter) {
  if (!filter) return true;
  const f = filter.toLowerCase();
  if (cat.displayName.toLowerCase().includes(f)) return true;
  if (cat.name.toLowerCase().includes(f)) return true;
  if (cat.aliases.some((a) => a.toLowerCase().includes(f))) return true;
  return false;
}

function getCategoryInsertText(cat) {
  if (cat.isTag) {
    const name = cat.name.replace(/^\[\[/, "").replace(/\]\]$/, "");
    return name.startsWith("#") ? name : `#${name}`;
  }
  if (cat.type === "pageRef") {
    const name = cat.name;
    if (name.startsWith("[[") && name.endsWith("]]")) return name;
    return `[[${cat.displayName}]]`;
  }
  // Plain text — insert as-is
  return cat.displayName;
}

/*──────────────────────────────────────────────────────────────────────────────
  CategoryPicker – non-blocking autocomplete popover
──────────────────────────────────────────────────────────────────────────────*/
const CategoryPicker = ({ blockUID, extensionAPI, onOpenManager, onRecompute, isOpen, onClose }) => {
  const [filter, setFilter] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef(null);
  const containerRef = useRef(null);
  const closedRef = useRef(false);
  // Track typed characters to build filter (not dependent on block polling)
  const typedRef = useRef("");

  const colorsMap = useMemo(
    () => (extensionAPI ? getCategoryColorsMap(extensionAPI) : {}),
    [extensionAPI]
  );

  // Build flat ordered list once on mount
  const allItems = useMemo(() => {
    const cats = [];
    const tags = [];
    for (const cat of categoriesArray) {
      if (!cat.display) continue;
      if (cat.isTag) {
        tags.push(cat);
      } else if (!cat.parent) {
        cats.push(cat);
        for (const child of cat.children || []) {
          if (child.display) cats.push(child);
        }
      }
    }
    return { cats, tags };
  }, []);

  // Filtered list based on filter state
  const filtered = useMemo(() => {
    const cats = allItems.cats.filter((c) => matchesFilter(c, filter));
    const tags = allItems.tags.filter((c) => matchesFilter(c, filter));
    return { cats, tags, total: cats.length + tags.length };
  }, [allItems, filter]);

  // Flat array for keyboard navigation (index 0 = manager item, 1+ = categories)
  const flatList = useMemo(
    () => [...filtered.cats, ...filtered.tags],
    [filtered]
  );

  // When filter is active, highlight first category (skip manager item)
  useEffect(() => {
    setHighlightIndex(filter.length > 0 && onOpenManager ? 1 : 0);
  }, [filter]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll(".et-cp-item");
    if (items[highlightIndex]) {
      items[highlightIndex].scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  // Position the popover below the active block
  useEffect(() => {
    if (!containerRef.current) return;
    // Try multiple selectors for the active Roam block input
    const activeBlock =
      document.querySelector(".rm-block__input--active") ||
      document.activeElement;
    if (activeBlock && activeBlock !== document.body) {
      const rect = activeBlock.getBoundingClientRect();
      if (rect.width > 0) {
        const popoverWidth = Math.min(Math.max(rect.width, 260), 480);
        const margin = 8;
        const left = Math.min(rect.left, window.innerWidth - popoverWidth - margin);
        containerRef.current.style.left = `${Math.max(margin, left)}px`;
        containerRef.current.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 200)}px`;
      }
    }
  }, [isOpen]);

  // Select a category
  const selectCategory = useCallback(
    (cat) => {
      if (closedRef.current) return;
      closedRef.current = true;
      const insertText = getCategoryInsertText(cat);
      const content = getBlockContent(blockUID) || "";
      const typed = typedRef.current;
      const timestampMatches = [...content.matchAll(timestampRegex)];
      const hasElapsed = timestampMatches.length >= 2;
      let newContent;

      if (typed && content.endsWith(typed)) {
        // User typed some filter chars — replace them with the category
        newContent = content.slice(0, content.length - typed.length).trimEnd() + " " + insertText;
      } else if (hasElapsed) {
        // Block already has elapsed time calculated: append category at the end
        newContent = content.trimEnd() + " " + insertText;
      } else {
        // Single timestamp: insert after it
        const lastMatch = timestampMatches[timestampMatches.length - 1];
        if (lastMatch) {
          newContent = content.slice(0, lastMatch.index + lastMatch[0].length) + " " + insertText + content.slice(lastMatch.index + lastMatch[0].length);
        } else {
          newContent = content.trim() ? content + " " + insertText : insertText;
        }
      }

      window.roamAlphaAPI.updateBlock({
        block: { uid: blockUID, string: newContent },
      });

      // If elapsed was already calculated, re-run elapsedTime so limits/flags
      // are recomputed with the newly added category
      if (hasElapsed && onRecompute) {
        setTimeout(() => onRecompute(blockUID), 100);
      } else {
        setTimeout(() => {
          const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
          if (focusedBlock) {
            window.roamAlphaAPI.ui.setBlockFocusAndSelection({
              location: focusedBlock,
            });
          }
        }, 100);
      }
      onClose();
    },
    [blockUID, onClose]
  );

  const doClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  // Keyboard handler in capture phase — intercept navigation keys, let others pass
  useEffect(() => {
    const handler = (e) => {
      if (closedRef.current) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        doClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const total = flatList.length + (onOpenManager ? 1 : 0);
        setHighlightIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const total = flatList.length + (onOpenManager ? 1 : 0);
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
        return;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (onOpenManager && highlightIndex === 0) {
          closedRef.current = true;
          onClose();
          onOpenManager();
        } else {
          const catIndex = onOpenManager ? highlightIndex - 1 : highlightIndex;
          const cat = flatList[catIndex] || flatList[0];
          if (cat) selectCategory(cat);
        }
        return;
      }

      // Backspace: remove last typed char from filter
      if (e.key === "Backspace") {
        typedRef.current = typedRef.current.slice(0, -1);
        setFilter(typedRef.current);
        return; // Let backspace pass through to block
      }

      // Printable characters: add to filter
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typedRef.current += e.key;
        const newFilter = typedRef.current;
        setFilter(newFilter);
        // Auto-close if no matches after this keystroke
        const hasMatch =
          allItems.cats.some((c) => matchesFilter(c, newFilter)) ||
          allItems.tags.some((c) => matchesFilter(c, newFilter));
        if (!hasMatch) {
          doClose();
        }
        return; // Let the key pass through to block
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [flatList, highlightIndex, selectCategory, doClose, allItems]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        !closedRef.current
      ) {
        doClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 200);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [doClose]);

  if (!isOpen) return null;
  if (filtered.total === 0 && filter.length > 0) return null;

  // Visual index offset: if manager item is shown, categories start at visual index 1
  const offset = onOpenManager ? 1 : 0;
  let itemIndex = offset;

  return (
    <div className="et-cp-container" ref={containerRef}>
      {filter && (
        <div className="et-cp-filter-hint">{filter}</div>
      )}
      <div className="et-cp-list" ref={listRef}>
        {onOpenManager && (
          <>
            <div
              className={`et-cp-item et-cp-manager ${highlightIndex === 0 ? "et-cp-highlighted" : ""}`}
              onMouseEnter={() => setHighlightIndex(0)}
              onMouseDown={(e) => {
                e.preventDefault();
                closedRef.current = true;
                onClose();
                onOpenManager();
              }}
            >
              <span className="et-cp-manager-icon">⚙</span>
              <span className="et-cp-name">Open Categories manager</span>
            </div>
            <div className="et-cp-divider" />
          </>
        )}
        {filtered.cats.map((cat) => {
          const idx = itemIndex++;
          const isHighlighted = idx === highlightIndex;
          const color = getCategoryColor(cat, colorsMap, idx);
          const isChild = !!cat.parent;
          const taskGoal = cat.limit.goal.task;
          const taskLimit = cat.limit.limit.task;
          return (
            <div
              key={cat.uid}
              className={`et-cp-item ${isHighlighted ? "et-cp-highlighted" : ""} ${isChild ? "et-cp-child" : ""}`}
              onMouseEnter={() => setHighlightIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectCategory(cat);
              }}
            >
              <span className="et-cp-dot" style={{ backgroundColor: color }} />
              <span className="et-cp-name">
                {cat.displayName}
                {isChild && cat.parent && (
                  <span className="et-cp-parent-hint">
                    {cat.parent.displayName}
                  </span>
                )}
              </span>
              {taskGoal > 0 && (
                <span className="et-cp-badge et-cp-goal">
                  {formatLimit(taskGoal)}
                </span>
              )}
              {taskLimit > 0 && (
                <span className="et-cp-badge et-cp-limit">
                  {formatLimit(taskLimit)}
                </span>
              )}
            </div>
          );
        })}
        {filtered.tags.length > 0 && filtered.cats.length > 0 && (
          <div className="et-cp-divider" />
        )}
        {filtered.tags.map((cat) => {
          const idx = itemIndex++;
          const isHighlighted = idx === highlightIndex;
          const color = colorsMap[cat.uid] || "#7c7caa";
          const taskGoal = cat.limit.goal.task;
          const taskLimit = cat.limit.limit.task;
          return (
            <div
              key={cat.uid}
              className={`et-cp-item ${isHighlighted ? "et-cp-highlighted" : ""}`}
              onMouseEnter={() => setHighlightIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectCategory(cat);
              }}
            >
              <span className="et-cp-dot" style={{ backgroundColor: color }} />
              <span className="et-cp-name">{cat.displayName}</span>
              {taskGoal > 0 && (
                <span className="et-cp-badge et-cp-goal">
                  {formatLimit(taskGoal)}
                </span>
              )}
              {taskLimit > 0 && (
                <span className="et-cp-badge et-cp-limit">
                  {formatLimit(taskLimit)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export function openCategoryPicker(blockUID, extensionAPI, onOpenManager, onRecompute) {
  if (categoriesArray.length === 0) return;
  renderOverlay({
    Overlay: CategoryPicker,
    props: { blockUID, extensionAPI, onOpenManager, onRecompute },
  });
}

export default CategoryPicker;
