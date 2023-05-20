import {
  displaySubCat,
  durationRegex,
  limitFlag,
  limitFormat,
  totalFormat,
  totalTitle,
  categoriesRegex,
  categoriesArray,
  autoCopyTotalToClipboard,
  displayTotalAsTable,
} from ".";
import { simpleIziMessage } from "./elapsedTime";
import {
  convertMinutesTohhmm,
  convertPeriodInNumberOfDays,
  dateIsInPeriod,
  getBlockContent,
  getBlocksIncludingRef,
  getChildrenTree,
  getCurrentBlockUidOrCreateIt,
  getLastDayOfPreviousPeriod,
  getNbOfDaysFromBlock,
  getPageUidByAnyBlockUid,
  getParentUID,
  getQuarter,
  getWeek,
  getWeekNumber,
  getYesterdayDate,
  simpleCreateBlock,
  simulateClick,
  sumOfArrayElements,
} from "./util";

const pomodoroRegex = /\{\{\[?\[?POMO\]?\]?: ?([0-9]*)\}\}/;
const totalPomo = {
  nb: 0,
  time: 0,
};
var titleIsRef = true; // Trigger words are inserted as block references in Total display
var uncategorized;
let outputForClipboard;

/*========================================================================*/
/* TOTAL TIME ON CURRENT PAGE
/*========================================================================*/

export async function totalTime(currentUID, scopeUid, byCategories = true) {
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
    displayTotalAsTable
      ? insertTableOfTotalByCategory(totalOutput, totalUid, "", 0)
      : insertTotalTimeByCategory(totalUid, totalOutput);
    if (totalOutput.time != 0 && totalOutput.children.length != 0)
      copyTotalToClipboard();
  }
}

function resetTotalTimes() {
  uncategorized = 0;
  outputForClipboard = "";
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

async function directChildrenProcess(tree, parentBlockCat = null) {
  //console.log(categoriesArray);
  let total = 0;
  if (tree) {
    let length = tree.length;
    for (let i = 0; i < length; i++) {
      let processChildren = true;
      let blockContent = tree[i].string;
      //console.log(blockContent);
      let time = extractElapsedTime(blockContent);
      let pomo = extractPomodoro(blockContent);
      if (pomo) {
        totalPomo.nb++;
        totalPomo.time += pomo;
      }
      if (!time) time = pomo ? pomo[1] : null;
      //console.log(categoriesRegex);
      //let matchingWords = [...blockContent.matchAll(categoriesRegex)];
      let matchingWords = blockContent.match(categoriesRegex);
      let triggeredCat;
      if (matchingWords) {
        // console.log("matchingWords");
        // console.log(matchingWords);
        triggeredCat = getTriggeredCategoriesFromNames(
          matchingWords,
          parentBlockCat
        );
      }
      if (!time) {
        if (!hasElapsedTimeInChildren(tree[i].children)) {
          processChildren = false;
        }
        parentBlockCat = triggeredCat ? triggeredCat[0] : parentBlockCat;
      } else {
        //  time = parseInt(time);
        if (triggeredCat) triggeredCat.forEach((cat) => cat.addTime(time));
        else if (parentBlockCat) parentBlockCat.addTime(time);
        else uncategorized += time;
        processChildren = false;
        total += parseInt(time);
      }
      if (processChildren && tree[i].children) {
        // console.log("parentBlockCat");
        // console.log(parentBlockCat);
        total += await directChildrenProcess(tree[i].children, parentBlockCat);
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
      names = names.filter((name) => name != child);
    }
  }
  if (names.length > 0) {
    let catAndPossiblesCat = [].concat(
      ...names.map((name) => {
        let possibleCategories = categoriesArray.filter(
          (cat) => cat.name === name
        );
        if (possibleCategories) return possibleCategories;
      })
    );
    //console.log(catAndPossiblesCat);
    if (catAndPossiblesCat) {
      result = result.concat(getTriggeredCategories(catAndPossiblesCat));
      // console.log("Block result:");
      // console.log(result);
    }
  }
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
    if (child.length != 0) {
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
  return parseInt(result);
}

function getTotalTimeInTree(tree, uidToExclude = null) {
  if (!tree) return 0;
  let stringified = JSON.stringify(tree); //.split('"string":"');
  if (extractElapsedTime(stringified)) {
    let total = 0;
    stringified.split('"string":"').forEach((string) => {
      let result = extractElapsedTime(string);
      if (!result) {
        result = extractPomodoro(string);
      }
      if (
        uidToExclude &&
        uidToExclude.includes(string.split('"uid":"')[1]?.slice(0, 9))
      )
        result = 0;
      total += !result ? 0 : result;
    });
    return total;
  } else return 0;
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

export var mainDailyLog;

export async function totalTimeForGivenPeriod(period, uid) {
  if (!period) {
    period = await getNbOfDaysFromBlock(uid);
  }
  let startUid = await getCurrentBlockUidOrCreateIt();
  setTimeout(async () => {
    let total = await getTotalTimeFromPreviousDays(startUid, null, period);
    displayTotalByPeriod(startUid, total, period);
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
  let total = [];
  await Promise.all(
    dnpUidArray.map(async (day) => {
      let dayLog = new DayLog(day);
      total.push(await getTotaTimeInDailyLog(dayLog));
    })
  );
  return sumOfArrayElements(total);
}

export function displayTotalByPeriod(uid, total, period) {
  let totalOutput = getTotalTimeOutput(total, period);
  let totalUid = prepareTotalTimeInsersion(uid, totalOutput.text, -1);
  displayTotalAsTable
    ? insertTableOfTotalByCategory(totalOutput, totalUid, "", 0)
    : insertTotalTimeByCategory(totalUid, totalOutput);
  if (totalOutput.children.length != 0) copyTotalToClipboard();
}

async function getPreviousDailyLogs(today, period) {
  let dateFlag = 0;
  let nbOfDays, limitedNb;
  if (isNaN(period)) {
    if (period.includes("last ")) {
      period = period.replace("last ", "");
      today = getLastDayOfPreviousPeriod(today, period);
      console.log("last day of previous period", today);
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
    console.log(period);
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
// TOTAL TIME FOR A GIVEN PAGE REFERENCE IN WHOLE GRAPH
/*========================================================================*/

export function getTotalTimeForCurrentPage(triggerUid, pageUid) {
  let total = 0;
  total += getTotalTimeInTree(getChildrenTree(pageUid));

  let references = getBlocksIncludingRef(pageUid);
  references = references.filter((b) => b[0] != pageUid && b[2] != pageUid);
  let uidToExclude = references.map((b) => b[0]);
  references.forEach((ref) => {
    let time = extractElapsedTime(ref[1]);
    total += time
      ? time
      : getTotalTimeInTree(getChildrenTree(ref[0]), uidToExclude);
  });
  let totalOutput = getTotalTimeOutput(total);
  let totalUid = prepareTotalTimeInsersion(triggerUid, totalOutput.text);
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
  else tree = tree.flat(Infinity);
  let stringified = JSON.stringify(tree);
  if (extractElapsedTime(stringified)) {
    return true;
  } else return false;
}

/*========================================================================*/
// FUNCTIONS FOR OUTPUT AND DISPLAY TOTALS
/*========================================================================*/
class Output {
  constructor(s, n, t = 0) {
    this.text = s;
    this.name = n;
    this.time = t;
    this.children = [];
  }

  setChildren(t) {
    this.children = t;
  }
  addChild(child) {
    this.children.push(child);
  }
  getText() {
    return this.text;
  }
}

function formatDisplayTime(w, title, formatTag, hide = false) {
  let t;
  let l = "";
  if (w != null) {
    t = w.time;
    l = displayLimit(w);
  } else t = uncategorized;
  if (title == "") {
    return totalTitle
      .replace("<tm>", t.toString())
      .replace("<th>", convertMinutesTohhmm(t));
  } else if (title.includes("period:")) {
    return (
      totalTitle
        .replace("<tm>", t.toString())
        .replace("<th>", convertMinutesTohhmm(t)) + ` ${title.slice(7)}`
    );
  }
  if (hide) return title;
  return (
    totalFormat
      .replace("<category>", title)
      .replace("<tm>", t.toString())
      .replace("<th>", convertMinutesTohhmm(t))
      .replace("<limit>", l)
      .trim() +
    " " +
    formatTag
  );
}

function displayLimit(w) {
  let flag = "";
  let comp = "";
  if (w.limit != null) {
    if (w.limit.type != "undefined" && w.limit.day != 0) {
      if (w.limit.type == "goal") {
        if (w.time >= w.limit.day) {
          flag = limitFlag.day.goal.success;
          comp = ">=";
        } else {
          flag = limitFlag.day.goal.failure;
          comp = "<";
        }
      } else if (w.limit.type == "limit") {
        if (w.time <= w.limit.day) {
          flag = limitFlag.day.limit.success;
          comp = "<=";
        } else {
          flag = limitFlag.day.limit.failure;
          comp = ">";
        }
      }
      let r = limitFormat.replace("<type>", w.limit.type);
      r = r.replace("<value>", w.limit.day.toString());
      r = r.replace("<comp>", comp);
      r = r.replace("<flag>", flag);
      return r;
    }
  }
  return "";
}

function getTotalTimeOutput(total, period = null) {
  if (period && isNaN(period)) {
    if (!period.includes("last")) period = `period: in current ${period}`;
    else period = `period: ${period}`;
  } else if (period && !isNaN(period))
    period = "period: since " + period + " days:";
  else period = "";

  let totalToBeCalculated = false;
  let displayTotal;
  console.log(total);
  console.log(period);
  if (total != 0) displayTotal = formatDisplayTime({ time: total }, period, "");
  else totalToBeCalculated = true;
  let totalOutput = new Output(displayTotal);
  let parentCategories = categoriesArray.filter((cat) => !cat.parent);
  parentCategories.forEach((parent) => {
    setCategoryOutput(parent, totalOutput);
    total += parent.time;
  });
  if (uncategorized != 0)
    totalOutput.addChild(
      new Output(
        formatDisplayTime(null, "__Uncategorized__", ""),
        "Uncategorized",
        uncategorized
      )
    );
  total += uncategorized;
  if (totalToBeCalculated)
    displayTotal = formatDisplayTime({ time: total }, period, "");
  totalOutput.time = total;
  totalOutput.text = displayTotal;
  return totalOutput;
}

function setCategoryOutput(category, parentOutput) {
  if (category.time != 0) {
    let title;
    if (titleIsRef && category.type === "text") {
      title = "((" + category.uid + "))";
    } else {
      title = category.name;
    }
    let hideTime =
      displaySubCat &&
      category.children &&
      category.children.filter((cat) => cat.time != 0).length === 1 &&
      category.children.filter((cat) => cat.time != 0)[0].time === category.time
        ? true
        : false;
    let formatedCatTotal = formatDisplayTime(
      category,
      title,
      category.format,
      hideTime
    );
    let output = new Output(formatedCatTotal, title, category.time);
    parentOutput.addChild(output);
    if (displaySubCat && category.children) {
      category.children.forEach((child) => setCategoryOutput(child, output));
    }
  }
}

function prepareTotalTimeInsersion(uid, value, position = -1) {
  if (position == -1) {
    window.roamAlphaAPI.updateBlock({
      block: { uid: uid, string: value },
    });
    return uid;
  } else {
    let totalUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": uid, order: position },
      block: { uid: totalUid, string: value },
    });
    window.roamAlphaAPI.updateBlock({
      block: {
        uid: uid,
        string: getBlockContent(uid) + "((" + totalUid + "))",
      },
    });
    return totalUid;
  }
}

function insertTotalTimeByCategory(uid, output, isSub = false) {
  for (let i = 0; i < output.children.length; i++) {
    if (output.children[i] != undefined) {
      let catUid = window.roamAlphaAPI.util.generateUID();
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": uid, order: i },
        block: { uid: catUid, string: output.children[i].getText() },
      });
      if (output.children[i].children.length != 0)
        insertTotalTimeByCategory(catUid, output.children[i], true);
    }
  }
  // if (uncategorized != 0 && !isSub && output.children.length != 0) {
  //   window.roamAlphaAPI.createBlock({
  //     location: { "parent-uid": uid, order: output.children.length },
  //     block: { string: formatDisplayTime(null, "__Uncategorized__", "") },
  //   });
  // }
  return;
}

function getListOfTotalByCategory(categories, shift = "") {
  categories.forEach((cat) => {
    if (cat.time != 0)
      outputForClipboard += shift + cat.name + "\t" + cat.time + "\n";
    if (cat.time != 0 && cat.children != undefined) {
      getListOfTotalByCategory(cat.children, shift + "   ");
    }
  });
}

function insertTableOfTotalByCategory(
  output,
  parentUid,
  shift = "",
  order = "last"
) {
  if (order == 0) {
    //console.log(output.time);
    let tableComponent = output.time == 0 ? "" : "\n{{table}}";
    window.roamAlphaAPI.updateBlock({
      block: {
        uid: parentUid,
        string: output.text + tableComponent,
        open: false,
      },
    });
    order = "last";
    setTimeout(() => {
      simulateClick(document.querySelector(".roam-article"));
    }, 100);
  }
  if (output.children.length > 0)
    output.children.forEach((cat) => {
      let format = shift === "" ? "**" : "";
      let nameUid = window.roamAlphaAPI.util.generateUID();
      simpleCreateBlock(parentUid, nameUid, format + shift + cat.name + format);
      let timeUid = window.roamAlphaAPI.util.generateUID();
      let time = totalFormat.includes("<th>")
        ? convertMinutesTohhmm(cat.time)
        : cat.time.toString();
      simpleCreateBlock(nameUid, timeUid, format + time + format);
      if (cat.children.length > 0) {
        insertTableOfTotalByCategory(cat, parentUid, shift + "   ");
      }
    });
}

function copyTotalToClipboard() {
  if (autoCopyTotalToClipboard) {
    getListOfTotalByCategory(categoriesArray.filter((cat) => !cat.parent));
    navigator.clipboard.writeText(outputForClipboard);
    simpleIziMessage("Total times copied to clipboard in a simple table");
  }
}
