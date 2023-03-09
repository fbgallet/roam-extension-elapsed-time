import {
  displaySubCat,
  durationFormat,
  limitFlag,
  limitFormat,
  scanTriggerWords,
  splittedDurationFormat,
  totalFormat,
  totalTitle,
  triggerTab,
} from ".";
import {
  convertMinutesTohhmm,
  extractDelimitedNumberFromString,
  getBlocksIncludingRef,
  getBlocksUidReferencedInThisBlock,
  getChildrenTree,
  getMainPageUid,
  getPageUidByTitle,
  getParentUID,
  getWeek,
  getYesterdayDate,
} from "./util";

var titleIsRef = true; // Trigger words are inserted as block references in Total display
var uncategorized;

/*======================================================================================================*/
/* TOTAL TIME ON DNP
/*======================================================================================================*/

export function totalTime(currentUID) {
  let total = 0;
  resetTotalTimes();
  let parentUID;
  let blockTree = getChildrenTree(currentUID);
  let position = -1;
  if (blockTree) {
    position = blockTree.length;
  } else {
    parentUID = getParentUID(currentUID);
    blockTree = getChildrenTree(parentUID);
  }
  total = directChildrenProcess(blockTree);
  let displayTotal = formatDisplayTime({ time: total }, "", "");
  let totalOutput = getTriggeredTime(displayTotal);
  let totalUid = insertTotalTime(currentUID, totalOutput.text, position);
  insertTriggeredTime(totalUid, totalOutput);
}

function resetTotalTimes() {
  uncategorized = 0;
  for (let i = 0; i < triggerTab.length; i++) {
    triggerTab[i].time = 0;
    if (triggerTab[i].children) {
      for (let j = 0; j < triggerTab[i].children.length; j++) {
        triggerTab[i].children[j].time = 0;
      }
    }
  }
}

function directChildrenProcess(tree) {
  let total = 0;
  if (tree) {
    let length = tree.length;
    for (let i = 0; i < length; i++) {
      let blockContent = tree[i].string;
      let result = extractDelimitedNumberFromString(
        blockContent,
        ...splittedDurationFormat
      );
      if (result === -1 || result === "NaN") result = 0;
      //let triggerIndex = getTriggerIndex(blockContent);
      let refs = getBlocksUidReferencedInThisBlock(tree[i].uid);
      let triggerIndex = scanTriggerWords(
        blockContent,
        refs,
        getTriggerIndexes,
        false
      );
      addTimeToTriggerWord(triggerIndex, result);
      total += result;
    }
  }
  return total;
}

function getTriggerIndexes(
  tw,
  i,
  j,
  indexTab,
  hasCat = false,
  tag = "",
  word = " "
) {
  if (tw === null) return [[-1, -1]];
  if (j === -1) {
    indexTab.push([i, j]);
    return indexTab;
  }
  if (tag != word) {
    indexTab.push([i, j]);
    if (hasCat) {
      let tagIndex = [];
      let tabWithoutCat = JSON.stringify(indexTab).replace(
        JSON.stringify([i, -1]),
        ""
      );
      if (tabWithoutCat.includes(",-1]")) {
        let left = tabWithoutCat.split(",-1]")[0].split("[");
        tagIndex = [left[left.length - 1], -1];
      }
      indexTab.splice(0, indexTab.length - 2);
      if (tagIndex.length > 0) {
        indexTab.push(tagIndex);
      }
    }
  }
  return indexTab;
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

class Output {
  constructor(s) {
    this.text = s;
    this.children = [];
  }

  setChildren(t) {
    this.children = t;
  }
  getText() {
    return this.text;
  }
}

function getTriggeredTime(t) {
  let totalOutput = new Output(t);
  let cat = [];
  for (let i = 0; i < triggerTab.length; i++) {
    if (triggerTab[i].time != 0) {
      let title;
      if (titleIsRef && triggerTab[i].type === "text") {
        title = "((" + triggerTab[i].uid + "))";
      } else {
        title = triggerTab[i].name;
      }
      let hideTime = false;
      //if (displaySubCat && triggerTab[i].children.length === 1) hideTime = true;
      let formatedCatTotal = formatDisplayTime(
        triggerTab[i],
        title,
        triggerTab[i].format,
        hideTime
      );
      let catOutput = new Output(formatedCatTotal);
      cat.push(catOutput);
      let sub = [];
      if (displaySubCat) {
        for (let j = 0; j < triggerTab[i].children.length; j++) {
          let child = triggerTab[i].children[j];
          if (child.time != 0 && child.display) {
            if (titleIsRef && child.type === "text") {
              title = "((" + child.uid + "))";
            } else {
              title = child.name;
            }
            let formatedSubTotal = formatDisplayTime(
              child,
              title,
              child.format
            );
            let subOutput = new Output(formatedSubTotal);
            sub.push(subOutput);
          }
        }
        catOutput.setChildren(sub);
      }
    }
  }
  totalOutput.setChildren(cat);
  return totalOutput;
}

function insertTotalTime(uid, value, position) {
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

function insertTriggeredTime(uid, output, isSub = false) {
  for (let i = 0; i < output.children.length; i++) {
    if (output.children[i] != undefined) {
      let catUid = window.roamAlphaAPI.util.generateUID();
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": uid, order: i },
        block: { uid: catUid, string: output.children[i].getText() },
      });
      if (output.children[i].children.length != 0)
        insertTriggeredTime(catUid, output.children[i], true);
    }
  }
  if (uncategorized != 0 && !isSub && output.children.length != 0) {
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": uid, order: output.children.length },
      block: { string: formatDisplayTime(null, "__Uncategorized__", "") },
    });
  }
  return;
}

// TOTAL TIME BY CATEGORIES ON A GIVEN PERIOD

class DailyLog {
  constructor(target = "categories") {
    this.target = target;
    this.dayLogs = [];
    this.firstLogDay = null;
    this.firstLogDay = null;
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

export async function getTotalTimeFromPreviousDays(
  today,
  numberOfDays,
  targetItem = null
) {
  let dnpUidArray = [];
  if (today === null) {
    let pageUid = await getMainPageUid();
    let parsedTitle = Date.parse(pageUid);
    console.log(parsedTitle);
    isNaN(parsedTitle) ? (today = new Date()) : (today = new Date(parsedTitle));
  }
  dnpUidArray = await getPreviousDailyLogs(today, numberOfDays);
  console.log(dnpUidArray);
  let total = 0;
  let dailyLogs = new DailyLog();
  dnpUidArray.forEach((day) => {
    let dayLog = new DayLog(day);
    total += getTotaTimeInDailyLog(dayLog);
    dailyLogs.addDay(dayLog);
  });
  //mainDailyLog = dailyLogs;
  dailyLogs.sumByCategory("monthly");
  mainDailyLog = dailyLogs.totals;
  return total;
  //console.log(dailyLogs);
  // dailyLogs.sumByCategory();
  // //console.log(total);
  // let displayTotal = formatDisplayTime({ time: total }, "", "");
  // let totalOutput = getTriggeredTime(displayTotal);
  // let totalUid = insertTotalTime("2Wzi4z-Mx", totalOutput.text, -1);
  // insertTriggeredTime(totalUid, totalOutput);
}

export function displayTotalByPeriod(uid, total, period) {
  let displayTotal = formatDisplayTime(
    { time: total },
    "Total time / " + period,
    ""
  );
  let totalOutput = getTriggeredTime(displayTotal);
  let totalUid = insertTotalTime(uid, totalOutput.text, -1);
  insertTriggeredTime(totalUid, totalOutput);
}

async function getPreviousDailyLogs(today, number) {
  let dnpUidArray = [];
  dnpUidArray.push(window.roamAlphaAPI.util.dateToPageUid(today));
  let yesterday;
  for (let i = 0; i < number; i++) {
    yesterday = getYesterdayDate(today);
    let uid = window.roamAlphaAPI.util.dateToPageUid(yesterday);
    dnpUidArray.push(uid);
    today = yesterday;
  }
  return dnpUidArray;
}

export function getTotaTimeInDailyLog(dayLog) {
  // let daylog = new DayLog(day);
  let dayTree = getChildrenTree(dayLog.day);
  if (!dayTree) return 0;
  else dayTree.flat(Infinity);
  console.log(dayTree);
  let stringified = JSON.stringify(dayTree); //.split('"string":"');
  if (dayLog.target && !stringified.includes(dayLog.target)) return 0;
  if (containsElapsedTimes(stringified)) {
    let total = getTimesFromArray(stringified.split('"string":"'), dayLog);
    return total;
  } else return 0;
}

function getTimesFromArray(array, dayLog) {
  let total = 0;
  uncategorized = 0;
  array.forEach((block) => {
    let result = extractDelimitedNumberFromString(
      block,
      ...splittedDurationFormat
    );
    if (result === -1 || result === "NaN") result = 0;
    else {
      if (dayLog.target) {
        if (!block.includes(dayLog.target)) result = 0;
      } else {
        let uidSlice = block.split('"uid":"');
        let refs = null;
        if (uidSlice.length > 1)
          refs = getBlocksUidReferencedInThisBlock(uidSlice[1].slice(0, 9));
        let triggerIndex = scanTriggerWords(
          block,
          refs,
          getTriggerIndexes,
          false
        );
        addTimeToTriggerWord(triggerIndex, result, dayLog);
      }
    }
    total += result;
  });
  return total;
}

function addTimeToTriggerWord(triggerIndex, result, dayLog = null) {
  if (triggerIndex.length > 0) {
    if (triggerIndex[0][0] == -1) {
      uncategorized += result;
    } else {
      let lastCat = 0;
      let hasCatTag = false;
      let indexStr = JSON.stringify(triggerIndex);
      let isOnlyTag = false;
      for (let j = 0; j < triggerIndex.length; j++) {
        let index = triggerIndex[j];
        let cat = triggerTab[index[0]];
        if (index[0] != lastCat) {
          hasCatTag = false;
        }
        if (index[1] == -1) {
          hasCatTag = true;
          cat.time += result;
          if (dayLog) dayLog.addLog(cat.name, result);
        } else {
          let sub = cat.children[index[1]];
          if (!hasCatTag) {
            if (indexStr.includes(",-1]")) {
              let splLeft = indexStr.split(",-1]");
              for (let k = 0; k < splLeft.length - 1; k++) {
                let splRight = splLeft[k].split("[");
                let catIndex = splRight[splRight.length - 1];
                if (triggerTab[catIndex].name == sub.name) {
                  isOnlyTag = true;
                }
              }
              if (!isOnlyTag) {
                cat.time += result;
                if (dayLog) dayLog.addLog(cat.name, result);
              }
            } else {
              cat.time += result;
              if (dayLog) dayLog.addLog(cat.name, result);
            }
            if (!isOnlyTag) {
              sub.time += result;
              if (dayLog) dayLog.addLog(sub.name, result);
            }
          } else {
            let itsCat = JSON.stringify([index[0], -1]);
            if (indexStr.includes(itsCat)) {
              sub.time += result;
              if (dayLog) dayLog.addLog(sub.name, result);
            }
          }
        }
        lastCat = index[0];
      }
    }
  }
}

function containsElapsedTimes(string) {
  let elapsedTime = extractDelimitedNumberFromString(
    string,
    ...splittedDurationFormat
  );
  if (elapsedTime === -1 || elapsedTime === "NaN") return false;
  else return true;
}

export async function getTotalTimeForCurrentPage() {
  //let pageTitle = getMainPageUid
  let pageUid = getPageUidByTitle("piano");
  let blocks = getBlocksIncludingRef(pageUid);
  let durationsTab = getBlocksContentWithDuration(blocks);
  let s = sum(durationsTab);
  //let total = formatDisplayTime(s);
  console.log(durationsTab);
  console.log(s);

  dailyLog.dayLogs.push();
}

function sum(t) {
  let s = 0;
  for (let i = 0; i < t.length; i++) {
    s += t[i];
  }
  return s;
}

function getBlocksContentWithDuration(b) {
  let tab = [];
  let dFormat = [...splittedDurationFormat];
  for (let i = 0; i < b.length; i++) {
    if (b[i][1].includes(dFormat[0]) && b[i][1].includes(dFormat[1])) {
      tab.push(extractDelimitedNumberFromString(b[i][1], ...dFormat));
    }
  }
  return tab;
}
