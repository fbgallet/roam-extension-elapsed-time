import { categoriesArray } from "./categories";
import {
  resetTotalTimes,
  directChildrenProcess,
  getUncategorized,
} from "./totalTime";
import {
  getChildrenTree,
  getBlocksIncludingRef,
  getPageNameByPageUid,
} from "./util";
import {
  getDayUids,
  serializeCategories,
  snapshotCategoryTimes,
  computeTotals,
} from "./dashboardData";

/**
 * Collect per-day, per-category time data scoped to a specific page
 * and all its references across the graph.
 *
 * Unlike getDashboardData (which scans daily note pages), this function
 * finds all blocks referencing pageUid, groups them by the daily note
 * they live on, and runs directChildrenProcess for full category matching.
 *
 * @param {string} pageUid - UID of the page to scope to
 * @param {Date} startDate - first day (inclusive)
 * @param {Date} endDate   - last day (inclusive)
 * @returns {Promise<DashboardData>}
 */
export async function getDashboardDataForPage(pageUid, startDate, endDate) {
  // 1. Detect if the page matches an existing category
  const scopeCat =
    categoriesArray.find((cat) => cat.ref === pageUid) || null;

  // 2. Serialize categories (reuse shared helper)
  const { categories, tags } = serializeCategories();

  // 3. Get all graph-wide references once
  let allRefs = getBlocksIncludingRef(pageUid);
  // Filter out self-references (blocks on the page itself)
  allRefs = allRefs.filter((b) => b[0] !== pageUid && b[2] !== pageUid);

  // 4. Pre-fetch all reference block trees before the day loop
  //    (resetTotalTimes clears the children tree cache, so we fetch upfront)
  const refTreeMap = new Map();
  for (const ref of allRefs) {
    if (!refTreeMap.has(ref[0])) {
      refTreeMap.set(ref[0], getChildrenTree(ref[0]));
    }
  }

  const matrix = {};
  const uncategorizedPerDay = {};
  let grandTotal = 0;

  // 5. Process the page's own content (undated bucket)
  const pageOwnTree = getChildrenTree(pageUid);
  resetTotalTimes();
  if (pageOwnTree) {
    const ownTotal = await directChildrenProcess(pageOwnTree);
    grandTotal += ownTotal;
  }
  matrix["__page__"] = snapshotCategoryTimes();
  uncategorizedPerDay["__page__"] = getUncategorized();

  // 6. Per-day processing: filter refs by daily note page
  const days = getDayUids(startDate, endDate);

  for (const dayUid of days) {
    resetTotalTimes();
    let dayTotal = 0;

    const dayRefs = allRefs.filter((b) => b[2] === dayUid);
    for (const ref of dayRefs) {
      const tree = refTreeMap.get(ref[0]);
      if (tree) {
        dayTotal += await directChildrenProcess(tree);
      }
    }

    matrix[dayUid] = snapshotCategoryTimes();
    uncategorizedPerDay[dayUid] = getUncategorized();
    grandTotal += dayTotal;
  }

  // 7. Compute totals across all buckets (days + __page__)
  const { totals, uncategorizedTotal } = computeTotals(
    matrix,
    uncategorizedPerDay,
    ["__page__", ...days]
  );

  // 8. Clean up global state
  resetTotalTimes();

  return {
    days,
    pageUid,
    pageName: getPageNameByPageUid(pageUid),
    categories,
    tags,
    matrix,
    totals,
    uncategorized: { perDay: uncategorizedPerDay, total: uncategorizedTotal },
    grandTotal,
    scopeCategory: scopeCat
      ? { uid: scopeCat.uid, name: scopeCat.displayName || scopeCat.name }
      : null,
  };
}
