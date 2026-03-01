import {
  durationRegex,
  displayTotalAsTable,
  includePomodoros,
  includeEmbeds,
} from ".";
import {
  categoriesArray,
  categoriesAsRef,
  categoriesRegex,
} from "./categories";
import {
  copyTotalToClipboard,
  getTotalTimeOutput,
  insertTableOfTotalByCategory,
  insertTotalTimeByCategory,
  prepareTotalTimeInsersion,
} from "./display";
import {
  clearChildrenTreeCache,
  convertPeriodInNumberOfDays,
  createBlock,
  dateIsInPeriod,
  embedRegex,
  getBlocksIncludingRef,
  getChildrenTree,
  getCommonElements,
  getCurrentBlockUidOrCreateIt,
  getLastDayOfPreviousPeriod,
  getNbOfDaysFromBlock,
  getPageUidByAnyBlockUid,
  getParentUID,
  getQuarter,
  getWeek,
  getWeekNumber,
  getYesterdayDate,
} from "./util";

const pomodoroRegex = /\{\{\[?\[?POMO\]?\]?: ?([0-9]*)\}\}/;
const totalPomo = {
  nb: 0,
  time: 0,
};
let uncategorized;
let outputForClipboard;

export function getUncategorized() { return uncategorized; }
export function getOutputForClipboard() { return outputForClipboard; }
export function setOutputForClipboard(val) { outputForClipboard = val; }

/*========================================================================*/
/* TOTAL TIME ON CURRENT PAGE
/*========================================================================*/

export async function totalTime(
  currentUID,
  scopeUid,
  byCategories = true,
  asTable = displayTotalAsTable
) {
  let total = 0;
  resetTotalTimes();
  let parentUID;
  let blockTree;
  let position = -1;
  if (currentUID) {
    blockTree = getChildrenTree(currentUID);
    if (blockTree) {
      position = blockTree.length;
    } else {
      parentUID = getParentUID(currentUID);
      blockTree = getChildrenTree(parentUID);
    }
  } else {
    currentUID = await getCurrentBlockUidOrCreateIt();
    // console.log("current:", currentUID);
    scopeUid = getPageUidByAnyBlockUid(currentUID);
  }
  //console.log("scope:", scopeUid);
  if (byCategories) {
    blockTree = getChildrenTree(scopeUid);
    total = await directChildrenProcess(blockTree);
  } else total = getTotalTimeInTree(blockTree);
  let totalOutput = getTotalTimeOutput(total);
  let totalUid = prepareTotalTimeInsersion(
    currentUID,
    totalOutput.text,
    position
  );
  if (byCategories) {
    asTable
      ? insertTableOfTotalByCategory(totalOutput, totalUid, "", 0)
      : insertTotalTimeByCategory(totalUid, totalOutput);
    if (totalOutput.time !== 0 && totalOutput.children.length)
      copyTotalToClipboard();
  }
}

export function resetTotalTimes() {
  uncategorized = 0;
  outputForClipboard = "";
  clearChildrenTreeCache();
  totalPomo.nb = 0;
  totalPomo.time = 0;
  for (let i = 0; i < categoriesArray.length; i++) {
    categoriesArray[i].time = 0;
    if (categoriesArray[i].children) {
      for (let j = 0; j < categoriesArray[i].children.length; j++) {
        categoriesArray[i].children[j].time = 0;
      }
    }
  }
}

export async function directChildrenProcess(tree, parentBlockCat = null) {
  let total = 0;
  if (tree) {
    for (let i = 0; i < tree.length; i++) {
      let catWithoutTime = null;
      let processChildren = true;
      let blockContent = tree[i].string;
      //console.log(blockContent);
      let time = extractElapsedTime(blockContent);
      let pomo = includePomodoros ? extractPomodoro(blockContent) : null;
      if (pomo) {
        totalPomo.nb++;
        totalPomo.time += pomo;
      }
      if (!time) time = pomo ? pomo : null;

      let triggeredCat = [];
      let triggeredTags = [];
      if (tree[i].refs?.length && categoriesAsRef.length) {
        let matchingRefs = getCommonElements(
          tree[i].refs.map((ref) => ref.uid),
          categoriesAsRef
        );
        if (matchingRefs.length) {
          const matchedCats = categoriesArray.filter(
            (cat) =>
              (cat.ref && matchingRefs.includes(cat.ref)) ||
              cat.aliasRefs?.some((r) => matchingRefs.includes(r))
          );
          matchedCats.forEach((cat) => {
            if (cat.isTag) triggeredTags.push(cat);
            else triggeredCat.push(cat);
          });
        }
      }
      let matchingWords = blockContent.match(categoriesRegex);
      if (matchingWords) {
        triggeredCat = getTriggeredCategoriesFromNames(
          matchingWords,
          parentBlockCat
        );
      }
      if (!time) {
        if (!hasElapsedTimeInChildren(tree[i].children)) {
          processChildren = false;
        }
        catWithoutTime = triggeredCat.length ? triggeredCat[0] : parentBlockCat;
      } else {
        if (triggeredCat.length)
          triggeredCat.forEach((cat) => cat.addTime(time));
        else {
          if (parentBlockCat) parentBlockCat.addTime(time);
          else uncategorized += parseInt(time);
        }
        // Tags accumulate time independently (informational, not added to total)
        triggeredTags.forEach((tag) => tag.addTime(time));
        processChildren = false;
        total += parseInt(time);
      }
      if (includeEmbeds) {
        const matchingEmbed = embedRegex.exec(blockContent);
        if (matchingEmbed !== null) {
          const embedUid = matchingEmbed[2];
          const embedPageUid = getPageUidByAnyBlockUid(embedUid);
          if (embedPageUid !== tree[i].page.uid)
            total += await directChildrenProcess(
              getChildrenTree(embedUid),
              catWithoutTime
            );
        }
      }
      if (processChildren && tree[i].children) {
        // console.log("parentBlockCat");
        // console.log(parentBlockCat);
        total += await directChildrenProcess(tree[i].children, catWithoutTime);
      }
    }
  }
  return total;
}

function getTriggeredCategoriesFromNames(names, parentBlockCat) {
  let result = [];
  if (parentBlockCat) {
    let child = names.find((name) => parentBlockCat.hasChildrenWithName(name));
    // console.log("child of parent block");
    // console.log(child);
    if (child) {
      result.push(parentBlockCat.getChildrenWithName(child));
      names = names.filter((name) => name !== child);
    }
  }
  // console.log("names :>> ", names);
  if (names.length > 0) {
    let catAndPossiblesCat = [].concat(
      ...names.map((name) => {
        let possibleCategories = categoriesArray.filter((cat) =>
          cat.type === "text"
            ? cat.name.toLowerCase() === name.toLowerCase() ||
              cat.aliases.some((a) => a.toLowerCase() === name.toLowerCase())
            : cat.name === name
        );
        if (possibleCategories) return possibleCategories;
      })
    );
    if (catAndPossiblesCat) {
      result = result.concat(getTriggeredCategories(catAndPossiblesCat));
      // console.log("Block result:");
      // console.log(result);
    }
  }
  // console.log("result before :>> ", result);
  result = removeRedundantCat(result);
  return result;
}

function getTriggeredCategories(filteredArray) {
  let result = [];
  let lastName = "";
  while (filteredArray.length > 1) {
    let child = filteredArray
      .slice(1)
      .filter((tw) => filteredArray[0].isParentOf(tw));
    // console.log("child:");
    // console.log(child);
    if (child.length !== 0) {
      child = child[0];
      result.push(child);
      filteredArray = filteredArray
        .slice(1)
        .filter((tw) => tw.name !== child.name);
    } else {
      result = addOnlySupCatIfSynonym(filteredArray[0], lastName, result);
      lastName = filteredArray[0].name;
      filteredArray = filteredArray.slice(1);
    }
  }
  if (filteredArray.length === 1) {
    result = addOnlySupCatIfSynonym(filteredArray[0], lastName, result);
    filteredArray = filteredArray.slice(1);
  }
  return result;
}

function removeRedundantCat(catArray) {
  const noRedundantCatArray = [];
  for (let i = 0; i < catArray.length; i++) {
    const cat = catArray[i];
    const remainingArray = catArray.slice(i + 1);
    let isAncestor =
      remainingArray.length &&
      remainingArray.some((someCat) => cat.isAncestorOf(someCat));
    // const previousArray = catArray.slice(0, i);
    let hasSameAncestor =
      noRedundantCatArray.length &&
      noRedundantCatArray.some((someCat) => cat.hasSameAncestor(someCat));
    if (!isAncestor && !hasSameAncestor) noRedundantCatArray.push(cat);
  }
  // console.log("noRedundantCatArray :>> ", noRedundantCatArray);
  return noRedundantCatArray;
}

function addOnlySupCatIfSynonym(cat, lastCatName, catArray) {
  if (cat.name !== lastCatName) {
    catArray.push(cat);
  } else {
    if (!cat.parent) catArray[catArray.length - 1] = cat;
  }
  return catArray;
}

function extractPomodoro(content) {
  let result = content.match(pomodoroRegex);
  if (result) result = result[1];
  else return null;
  return parseInt(result);
}

function getTotalTimeInTree(tree, uidToExclude = null) {
  if (!tree) return 0;
  let total = 0;
  for (const node of tree) {
    if (uidToExclude?.includes(node.uid)) continue;
    const time =
      extractElapsedTime(node.string) ||
      (includePomodoros ? extractPomodoro(node.string) : null);
    total += time || 0;
    if (node.children)
      total += getTotalTimeInTree(node.children, uidToExclude);
  }
  return total;
}

/*=======================================================================*/
// TOTAL TIME ON A GIVEN PERIOD
/*=======================================================================*/

class DailyLog {
  constructor(target = "categories") {
    this.target = target;
    this.dayLogs = [];
    this.firstLogDay = null;
    this.lastLogDay = null;
    this.totals = [];
  }
  initDayLogs() {
    this.dayLogs = [];
  }
  addDay(dayLog) {
    this.dayLogs.push(dayLog);
  }
  sumByCategory(period = null) {
    let targetArray;
    this.dayLogs.forEach((day) => {
      if (day.timePerActivity.length > 0) {
        let year = day.day.slice(-4);
        let index = this.totals.findIndex((item) => item.year === year);
        if (index > -1) targetArray = this.totals[index].totals;
        else {
          this.totals.push({ year: year, totals: [] });
          targetArray = this.totals[this.totals.length - 1].totals;
        }
        let periodValue;
        if (period !== null) {
          if (period === "monthly") {
            periodValue = day.day.slice(0, 2);
          } else if (period === "weekly") {
            periodValue = getWeek(new Date(Date.parse(day.day)));
          }
          index = targetArray.findIndex((item) => item.rank === periodValue);
          if (index > -1) targetArray = targetArray[index].totals;
          else {
            targetArray.push({ period: period, rank: periodValue, totals: [] });
            targetArray = targetArray[targetArray.length - 1].totals;
          }
        }
        day.timePerActivity.forEach((activity) => {
          let index = targetArray.findIndex((item) => item[0] === activity[0]);
          index > -1
            ? (targetArray[index][1] += activity[1])
            : targetArray.push([activity[0], activity[1]]);
        });
      }
    });
    //let day = new Date(Date.parse(this.dayLogs[this.dayLogs.length - 1].day));
    //console.log(day);
  }
}
class DayLog {
  constructor(day, target = null, log = []) {
    this.day = day;
    this.target = target;
    this.timePerActivity = target ? [target, 0] : log;
  }
  addLog(activity, time) {
    if (this.target) {
      this.timePerActivity[1] += time;
      return;
    }
    let index = this.timePerActivity.findIndex((item) => item[0] === activity);
    index > -1
      ? (this.timePerActivity[index][1] += time)
      : this.timePerActivity.push([activity, time]);
  }
}

export let mainDailyLog;

export async function totalTimeForGivenPeriod(
  period,
  uid,
  asTable = displayTotalAsTable
) {
  if (!period) {
    period = await getNbOfDaysFromBlock(uid);
  }
  let startUid = await getCurrentBlockUidOrCreateIt();
  setTimeout(async () => {
    let total = await getTotalTimeFromPreviousDays(startUid, null, period);
    displayTotalByPeriod(startUid, total, period, asTable);
  }, 50);
}

export async function getTotalTimeFromPreviousDays(
  currentBlockUid,
  today,
  period,
  targetItem = null
) {
  resetTotalTimes();
  let dnpUidArray = [];
  if (today === null) {
    let pageUid = getPageUidByAnyBlockUid(currentBlockUid);
    let parsedTitle = Date.parse(pageUid);
    isNaN(parsedTitle) ? (today = new Date()) : (today = new Date(parsedTitle));
  }
  dnpUidArray = await getPreviousDailyLogs(today, period);
  //console.log(dnpUidArray);
  let total = 0;
  total = await sumDailyLogs(dnpUidArray);
  //  console.log(categoriesArray);
  return total;
}

async function sumDailyLogs(dnpUidArray) {
  let total = 0;
  for (const day of dnpUidArray) {
    let dayLog = new DayLog(day);
    total += await getTotaTimeInDailyLog(dayLog);
  }
  return total;
}

export function displayTotalByPeriod(
  uid,
  total,
  period,
  asTable = displayTotalAsTable
) {
  let totalOutput = getTotalTimeOutput(total, period);
  let totalUid = prepareTotalTimeInsersion(uid, totalOutput.text, -1);
  asTable
    ? insertTableOfTotalByCategory(totalOutput, totalUid, "", 0)
    : insertTotalTimeByCategory(totalUid, totalOutput);
  if (totalOutput.children.length != 0) copyTotalToClipboard();
}

export async function getPreviousDailyLogs(today, period) {
  let dateFlag = 0;
  let nbOfDays, limitedNb;
  if (isNaN(period)) {
    if (period.includes("last ")) {
      period = period.replace("last ", "");
      today = getLastDayOfPreviousPeriod(today, period);
      // console.log("last day of previous period", today);
    }
    limitedNb = true;
    nbOfDays = convertPeriodInNumberOfDays(period);
    switch (period) {
      case "week":
        dateFlag = getWeekNumber(today);
        break;
      case "month":
        dateFlag = today.getMonth();
        break;
      case "quarter":
        dateFlag = getQuarter(today);
        break;
      case "year":
        dateFlag = today.getFullYear();
        break;
    }
  } else {
    //  console.log(period);
    limitedNb = false;
    nbOfDays = period;
  }
  let dnpUidArray = [];
  dnpUidArray.push(window.roamAlphaAPI.util.dateToPageUid(today));
  let yesterday;
  for (let i = limitedNb ? 0 : 1; i < nbOfDays; i++) {
    yesterday = getYesterdayDate(today);
    if (limitedNb && !dateIsInPeriod(yesterday, period, dateFlag)) break;
    let uid = window.roamAlphaAPI.util.dateToPageUid(yesterday);
    dnpUidArray.push(uid);
    today = yesterday;
  }
  return dnpUidArray;
}

export async function getTotaTimeInDailyLog(dayLog) {
  let dayTree = getChildrenTree(dayLog.day);
  if (!dayTree) return 0;
  let total = await directChildrenProcess(dayTree);
  return total;
}

/*========================================================================*/
// TOTAL TIME FOR A GIVEN PAGE REFERENCE OR BLOCK REFERENCE IN WHOLE GRAPH
/*========================================================================*/

export async function getTotalTimeForCurrentNode(
  triggerUid,
  nodeUid,
  nodeType = "page"
) {
  let total = 0;
  total += getTotalTimeInTree(getChildrenTree(nodeUid));

  let references = getBlocksIncludingRef(nodeUid);
  references = references.filter((b) => b[0] !== nodeUid && b[2] !== nodeUid);

  let uidToExclude = nodeType === "page" ? references.map((b) => b[0]) : [];
  for (let i = 0; i < references.length; i++) {
    let time = extractElapsedTime(references[i][1]);
    total += time
      ? time
      : getTotalTimeInTree(getChildrenTree(references[i][0]), uidToExclude);
  }
  let totalOutput = getTotalTimeOutput(
    total,
    nodeType === "page" ? "page and references" : "block and references",
    true
  );
  console.log("totalOutput:", totalOutput);
  if (nodeType === "block") {
    triggerUid = await createBlock(triggerUid, "", true);
  }
  prepareTotalTimeInsersion(triggerUid, totalOutput.text);
}

function extractElapsedTime(content) {
  let match = content.match(durationRegex);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

function hasElapsedTimeInChildren(tree) {
  if (!tree) return false;
  for (const node of tree) {
    if (extractElapsedTime(node.string)) return true;
    if (includePomodoros && extractPomodoro(node.string)) return true;
    if (node.children && hasElapsedTimeInChildren(node.children)) return true;
  }
  return false;
}

