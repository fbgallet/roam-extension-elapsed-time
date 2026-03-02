import React, { useState, useEffect, useRef, useCallback } from "react";
import { getPageNameByPageUid, searchPages } from "../util";

const FAVORITES_KEY = "dashboardFavoritePages";

function loadFavorites(extensionAPI) {
  try {
    return JSON.parse(extensionAPI.settings.get(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFavorites(extensionAPI, favs) {
  extensionAPI.settings.set(FAVORITES_KEY, JSON.stringify(favs));
}

/*──────────────────────────────────────────────────────────────────────────────
  PageSelector — autocomplete input + star favorites
  Props:
    extensionAPI  — Roam extension API (for settings storage)
    pageUid       — currently selected page uid (or null)
    onPageChange  — callback(uid, title) when a page is chosen
──────────────────────────────────────────────────────────────────────────────*/
const PageSelector = ({ extensionAPI, pageUid, onPageChange }) => {
  const [inputValue, setInputValue] = useState(() =>
    pageUid ? getPageNameByPageUid(pageUid) || "" : ""
  );
  const [suggestions, setSuggestions] = useState([]);
  const [showPopover, setShowPopover] = useState(false);
  const [favorites, setFavorites] = useState(() => loadFavorites(extensionAPI));
  const inputRef = useRef(null);
  const popoverRef = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.trim()) {
      setSuggestions(searchPages(val));
      setShowPopover(true);
    } else {
      setSuggestions([]);
      setShowPopover(favorites.length > 0);
    }
  };

  const handleFocus = () => {
    if (!inputValue.trim() && favorites.length > 0) {
      setShowPopover(true);
    } else if (inputValue.trim()) {
      setSuggestions(searchPages(inputValue));
      setShowPopover(true);
    }
  };

  const selectPage = (title, uid) => {
    setInputValue(title);
    setSuggestions([]);
    setShowPopover(false);
    onPageChange(uid, title);
  };

  const toggleFavorite = (uid, title) => {
    const favs = loadFavorites(extensionAPI);
    const idx = favs.findIndex((f) => f.uid === uid);
    const next = idx >= 0 ? favs.filter((_, i) => i !== idx) : [...favs, { uid, title }];
    saveFavorites(extensionAPI, next);
    setFavorites(next);
  };

  const isFavorite = (uid) => favorites.some((f) => f.uid === uid);

  const displayedItems = inputValue.trim() ? suggestions : favorites;
  const showFavoritesHeader = !inputValue.trim() && favorites.length > 0;

  return (
    <div className="et-page-selector">
      <div className="et-page-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="bp3-input bp3-small et-page-input"
          placeholder="Search page…"
          value={inputValue}
          onChange={handleInput}
          onFocus={handleFocus}
          autoComplete="off"
        />
        {pageUid && (
          <button
            className={`bp3-button bp3-minimal bp3-small et-fav-btn${isFavorite(pageUid) ? " et-fav-active" : ""}`}
            title={isFavorite(pageUid) ? "Remove from favorites" : "Add to favorites"}
            onClick={() => toggleFavorite(pageUid, inputValue)}
          >
            ★
          </button>
        )}
      </div>
      {showPopover && displayedItems.length > 0 && (
        <div ref={popoverRef} className="et-page-popover">
          {showFavoritesHeader && (
            <div className="et-page-popover-header">Favorites</div>
          )}
          {displayedItems.map((item) => (
            <div
              key={item.uid}
              className="et-page-popover-item"
              onMouseDown={(e) => {
                e.preventDefault();
                selectPage(item.title, item.uid);
              }}
            >
              <span className="et-page-popover-title">{item.title}</span>
              <button
                className={`bp3-button bp3-minimal bp3-small et-fav-btn${isFavorite(item.uid) ? " et-fav-active" : ""}`}
                title={isFavorite(item.uid) ? "Remove from favorites" : "Add to favorites"}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(item.uid, item.title);
                }}
              >
                ★
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageSelector;
