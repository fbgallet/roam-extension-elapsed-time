import { categoriesArray } from "./categories";
import {
  resetTotalTimes,
  directChildrenProcess,
  getUncategorized,
} from "./totalTime";
import {
  getChildrenTree,
  getYesterdayDate,
  getWeekNumber,
  clearChildrenTreeCache,
} from "./util";

/**
 * Collect per-day, per-category time data for the dashboard.
 *
 * Strategy: for each day in the range, reset category times, process the day's
 * block tree using the existing directChildrenProcess (which handles all
 * matching, sub-category rollup, embeds, pomodoros), then snapshot each
 * category's accumulated .time value.
 *
 * @param {Date} startDate - first day (inclusive)
 * @param {Date} endDate   - last day (inclusive)
 * @returns {Promise<DashboardData>}
 */
export async function getDashboardData(startDate, endDate) {
  const days = getDayUids(startDate, endDate);

  const serializeLimits = (cat) => ({
    goal: { ...cat.limit.goal },
    limit: { ...cat.limit.limit },
  });

  const categories = categoriesArray
    .filter((cat) => !cat.parent)
    .map((cat) => ({
      uid: cat.uid,
      name: cat.name,
      parentUid: null,
      limits: serializeLimits(cat),
      children: (cat.children || []).map((child) => ({
        uid: child.uid,
        name: child.name,
        parentUid: cat.uid,
        limits: serializeLimits(child),
        children: (child.children || []).map((gc) => ({
          uid: gc.uid,
          name: gc.name,
          parentUid: child.uid,
          limits: serializeLimits(gc),
          children: [],
        })),
      })),
    }));

  const matrix = {};
  const uncategorizedPerDay = {};
  let grandTotal = 0;

  for (const dayUid of days) {
    resetTotalTimes();
    const dayTree = getChildrenTree(dayUid);
    if (dayTree) {
      const dayTotal = await directChildrenProcess(dayTree);
      grandTotal += dayTotal;
    }

    // Snapshot category times for this day
    const daySnapshot = {};
    for (const cat of categoriesArray) {
      if (cat.time > 0) {
        daySnapshot[cat.uid] = cat.time;
      }
    }
    matrix[dayUid] = daySnapshot;
    uncategorizedPerDay[dayUid] = getUncategorized();
  }

  // Compute totals across all days
  const totals = {};
  let uncategorizedTotal = 0;
  for (const dayUid of days) {
    for (const [uid, time] of Object.entries(matrix[dayUid])) {
      totals[uid] = (totals[uid] || 0) + time;
    }
    uncategorizedTotal += uncategorizedPerDay[dayUid] || 0;
  }

  // Clean up global state
  resetTotalTimes();

  return {
    days,
    categories,
    matrix,
    totals,
    uncategorized: { perDay: uncategorizedPerDay, total: uncategorizedTotal },
    grandTotal,
  };
}

/**
 * Get an array of Roam daily note page UIDs for each day in [startDate, endDate].
 */
function getDayUids(startDate, endDate) {
  const uids = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    uids.push(window.roamAlphaAPI.util.dateToPageUid(new Date(current)));
    current.setDate(current.getDate() + 1);
  }
  return uids;
}

/**
 * Compute start and end dates from a preset period name.
 * @param {string} preset - "day" | "week" | "month" | "quarter"
 * @param {Date} [referenceDate] - defaults to today
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function getDateRange(preset, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  let startDate, endDate;

  switch (preset) {
    case "day":
      startDate = new Date(ref);
      endDate = new Date(ref);
      break;
    case "week": {
      const dayOfWeek = ref.getDay();
      // Week starts on Monday (1)
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(ref);
      startDate.setDate(ref.getDate() + mondayOffset);
      endDate = new Date(ref);
      break;
    }
    case "month":
      startDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
      endDate = new Date(ref);
      break;
    case "quarter": {
      const quarterStartMonth = Math.floor(ref.getMonth() / 3) * 3;
      startDate = new Date(ref.getFullYear(), quarterStartMonth, 1);
      endDate = new Date(ref);
      break;
    }
    default:
      startDate = new Date(ref);
      endDate = new Date(ref);
  }

  return { startDate, endDate };
}

/**
 * Aggregate a daily matrix into weekly buckets.
 * Returns { labels: string[], aggregated: { [dayUid]: { [catUid]: minutes } } }
 * where labels are "W1", "W2", etc. and the keys in aggregated are the
 * first day UID of each week.
 */
export function aggregateByWeek(matrix, days) {
  const buckets = {};
  const bucketLabels = {};
  for (const dayUid of days) {
    const date = window.roamAlphaAPI.util.pageTitleToDate(
      window.roamAlphaAPI.pull("[:node/title]", [":block/uid", dayUid])?.[":node/title"]
    );
    if (!date) continue;
    const weekNum = getWeekNumber(date);
    const year = date.getFullYear();
    const key = `${year}-W${weekNum}`;
    if (!buckets[key]) {
      buckets[key] = {};
      bucketLabels[key] = `W${weekNum}`;
    }
    const dayData = matrix[dayUid] || {};
    for (const [uid, time] of Object.entries(dayData)) {
      buckets[key][uid] = (buckets[key][uid] || 0) + time;
    }
  }
  return {
    labels: Object.values(bucketLabels),
    aggregated: buckets,
  };
}

/**
 * Aggregate a daily matrix into monthly buckets.
 */
export function aggregateByMonth(matrix, days) {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const buckets = {};
  const bucketLabels = {};
  for (const dayUid of days) {
    const date = window.roamAlphaAPI.util.pageTitleToDate(
      window.roamAlphaAPI.pull("[:node/title]", [":block/uid", dayUid])?.[":node/title"]
    );
    if (!date) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!buckets[key]) {
      buckets[key] = {};
      bucketLabels[key] = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }
    const dayData = matrix[dayUid] || {};
    for (const [uid, time] of Object.entries(dayData)) {
      buckets[key][uid] = (buckets[key][uid] || 0) + time;
    }
  }
  return {
    labels: Object.values(bucketLabels),
    aggregated: buckets,
  };
}

/**
 * Navigate a preset period backward or forward by one step.
 * @param {"day"|"week"|"month"|"quarter"} preset
 * @param {Date} startDate - current period start
 * @param {Date} endDate   - current period end
 * @param {number} direction - -1 for previous, +1 for next
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function navigatePeriod(preset, startDate, endDate, direction) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  switch (preset) {
    case "day": {
      start.setDate(start.getDate() + direction);
      end.setDate(end.getDate() + direction);
      break;
    }
    case "week": {
      start.setDate(start.getDate() + direction * 7);
      end.setDate(end.getDate() + direction * 7);
      break;
    }
    case "month": {
      // Move to the same-numbered month ± 1
      const newMonth = start.getMonth() + direction;
      const newStart = new Date(start.getFullYear(), newMonth, 1);
      const newEnd = new Date(start.getFullYear(), newMonth + 1, 0); // last day
      return { startDate: newStart, endDate: newEnd };
    }
    case "quarter": {
      // Quarters are 3-month blocks
      const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
      const newQStart = new Date(
        start.getFullYear(),
        quarterStartMonth + direction * 3,
        1
      );
      const newQEnd = new Date(
        newQStart.getFullYear(),
        newQStart.getMonth() + 3,
        0
      );
      return { startDate: newQStart, endDate: newQEnd };
    }
    default:
      break;
  }

  return { startDate: start, endDate: end };
}

/**
 * Format a Date as a short label for chart x-axis.
 */
export function formatDateLabel(date) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${dayNames[date.getDay()]} ${date.getDate()}`;
}
