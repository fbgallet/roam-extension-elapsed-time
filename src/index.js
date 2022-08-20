import iziToast from "izitoast";
import "../node_modules/izitoast/dist/css/iziToast.css";
import {
  getChildrenTree,
  getParentUID,
  getBlockContent,
  getBlocksUidReferencedInThisBlock,
  updateBlock,
  normalizeUID,
  getNormalizedTimestamp,
  addZero,
} from "./util";

/************************* PANEL SETTINGS VAR **************************/
var categoriesUID,
  limitsUID,
  displaySubCat,
  limitFlag,
  flagsDropdown,
  customFlags,
  confirmPopup,
  defaultTimeLimit,
  totalTitle,
  intervalSeparator = " - ",
  durationFormat,
  totalFormat,
  limitFormat;
var limitFlagDefault = {
  task: {
    goal: { success: "🎯", failure: "⚠️" },
    limit: { success: "👍", failure: "🛑" },
  },
  day: {
    goal: { success: "🎯", failure: "⚠️" },
    limit: { success: "👍", failure: "🛑" },
  },
};
/**********************************************************************/

/************************* DEFAULT HIDDEN SETTINGS **************************/
var limitPresets = true; // false if you want disable trigger words search
var inlineMinLimit = "min:";
var inlineMaxLimit = "max:";
var pomoIsLimit = true; // Pomodotor timer as min trigger
var appendHourTag = false; // add a tag with the round current hour, like #19:00
var titleIsRef = true; // Trigger words are inserted as block references in Total display
/**********************************************************************/

var triggerTab = [];
var uncategorized;

function TriggerWord(s, uid, l, f) {
  this.word = this.getOnlyWord(s);
  this.uid = uid;
  this.display = true;
  this.limit = { type: "undefined", task: 0, day: 0 };
  this.time = 0;
  this.format = f;
  this.children = [];
}
TriggerWord.prototype.addChildren = function (s, u, l, f) {
  return this.children.push(new TriggerWord(s, u, l, f));
};
TriggerWord.prototype.getOnlyWord = function (s) {
  //s = s.split("{")[0];
  //return s.trim();
  return s;
};
TriggerWord.prototype.getLimitByInterval = function (interval) {
  return [this.limit[interval], this.limit.type];
};
TriggerWord.prototype.setLimit = function (type, interval, time) {
  this.limit.type = type;
  this.limit[interval] = time;
};

function TimeStamp(tColon) {
  (this.tColon = tColon),
    (this.m = parseInt(tColon.slice(-2))),
    (this.h = parseInt(tColon.slice(0, 2))),
    (this.mTotal = this.h * 60 + this.m);
}

/*======================================================================================================*/
/* ELAPSED TIME SB */
/*======================================================================================================*/

async function elapsedTime(blockUID) {
  let hourTag = "";
  let blockContent = getBlockContent(blockUID);
  let blockSplit = blockContent.split(":");
  let leftShift = getLeftShift(blockSplit[0]);
  let begin = new TimeStamp(blockContent.slice(leftShift, leftShift + 5));
  let title = "";
  let endStr = getSecondTimestampStr(
    blockSplit,
    leftShift,
    blockContent.search(intervalSeparator.trim())
  );
  if (endStr != null) {
    title = blockContent.slice(blockSplit[0].length + blockSplit[1].length + 5);
  } else {
    let d = new Date();
    endStr = addZero(d.getHours()) + ":" + addZero(d.getMinutes());
    title = blockContent.slice(leftShift + 5);
  }
  if (title.length == 0) title = "";
  let end = new TimeStamp(endStr);
  //let elapsed = new TimeStamp(getDifferenceBetweenTwoTimeStamps(begin, end));
  let elapsed = getDifferenceBetweenTwoTimeStamps(begin, end);
  let leftPart =
    blockSplit[0].slice(0, -2) +
    concatTimeStamps(begin.tColon, end.tColon, elapsed);
  if (appendHourTag) hourTag = " #[[" + begin.h + ":00]]";

  let rightPart = title.trim() + hourTag;
  compareToLimitsAndUpdate(blockUID, title, leftPart, rightPart, elapsed);
}

function compareToLimitsAndUpdate(
  blockUID,
  title,
  leftPart,
  rightPart,
  elapsed
) {
  let withMin = false;
  let withMax = false;
  let minIndex = rightPart.search(new RegExp(inlineMinLimit, "i"));
  let maxIndex = rightPart.search(new RegExp(inlineMaxLimit, "i"));
  let timeLimitMin = 0,
    timeLimitMax = 1000;

  if (minIndex != -1) {
    withMin = true;
    timeLimitMin = extractLimit(
      rightPart.slice(minIndex),
      inlineMinLimit.length
    );
  }
  if (maxIndex != -1) {
    withMax = true;
    timeLimitMax = extractLimit(
      rightPart.slice(maxIndex),
      inlineMaxLimit.length
    );
  }
  let withPomo = false;
  if (pomoIsLimit) {
    let indexPomo = title.search("POMO");
    if (indexPomo != -1) {
      timeLimitMax = extractLimit(rightPart.slice(indexPomo), 8);
      withMax = true;
      withPomo = true;
    }
  }
  let limitType = "Goal or limit";
  if (limitPresets && !withMin && !withMax && !withPomo) {
    let refs = getBlocksUidReferencedInThisBlock(blockUID);
    //let limitTab = getLimitOfFirstTriggerWord(rightPart.toLowerCase(), refs);
    let limitTab = scanTriggerWords(
      rightPart,
      refs,
      getLimitFromTriggerWord,
      true
    );
    let timeLimit = limitTab[0];
    if (timeLimit > 0) {
      limitType = limitTab[1];
    }
    if (limitType == "limit") {
      limitType = "Limit";
      withMax = true;
      timeLimitMax = timeLimit;
    } else if (limitType == "goal") {
      limitType = "Goal";
      withMin = true;
      timeLimitMin = timeLimit;
    }
  }
  let triggered = withMax || withMin || withPomo;
  if (withMax && withMin && timeLimitMax <= timeLimitMin) {
    withMin = false;
  }
  if (!triggered) {
    timeLimitMax = defaultTimeLimit;
  }

  let exceeded = (withMax || !triggered) && elapsed > timeLimitMax;
  let insufficient = withMin && elapsed < timeLimitMin;
  let okUnder = !exceeded && !withMin && triggered;
  let okOver = !insufficient && !withMax && triggered;

  if (exceeded || insufficient || okUnder || okOver || triggered) {
    let textTitle = elapsed + "' elapsed.";
    let textMessage = limitType + " was ";
    let buttonCaption = "Too much anyway!";
    let badFormat = limitFlag.task.limit.failure;
    let goodFormat = limitFlag.task.goal.success;

    if (
      (!exceeded && !insufficient) ||
      (okUnder && !insufficient) ||
      (okOver && !exceeded)
    ) {
      if (!okOver && !okUnder) {
        textMessage += "between " + timeLimitMin + "' & " + timeLimitMax + "'";
        goodFormat = limitFlag.task.goal.success;
      } else if (okUnder) {
        textMessage += "less than " + timeLimitMax + "'";
        badFormat = limitFlag.task.limit.failure;
        goodFormat = limitFlag.task.limit.success;
      } else {
        textMessage += "more than " + timeLimitMin + "'";
        badFormat = limitFlag.task.goal.failure;
        buttonCaption = "Not enough anyway!";
      }
      if (confirmPopup) {
        buttonCaption = "<button>" + buttonCaption + "</button>";
        iziToast.success({
          timeout: 6000,
          displayMode: "replace",
          id: "timing",
          zindex: 999,
          title: textTitle,
          message: textMessage,
          position: "bottomCenter",
          drag: false,
          close: true,
          buttons: [
            [
              "<button>Great!</button>",
              async (instance, toast) => {
                updateBlock(
                  blockUID,
                  leftPart + goodFormat + " " + rightPart,
                  true
                );
                instance.hide({ transitionOut: "fadeOut" }, toast, "button");
              },
              true,
            ],
            [
              buttonCaption,
              async (instance, toast) => {
                updateBlock(
                  blockUID,
                  leftPart + badFormat + " " + rightPart,
                  true
                );
                instance.hide({ transitionOut: "fadeOut" }, toast, "button");
              },
            ],
          ],
        });
      }
    } else {
      if ((exceeded && withMin) || (insufficient && withMax)) {
        textMessage += "between " + timeLimitMin + "' & " + timeLimitMax + "'";
        buttonCaption = "Too much!";
        if (insufficient) {
          badFormat = limitFlag.task.goal.failure;
          goodFormat = limitFlag.task.limit.success;
          buttonCaption = "Not enough!";
        }
      } else if ((!okUnder && !insufficient) || exceeded) {
        buttonCaption = "Too much!";
        goodFormat = limitFlag.task.limit.success;
        if (!triggered) {
          textMessage = "Default alert time is " + timeLimitMax + "'";
        } else {
          textMessage += "less than " + timeLimitMax + "'";
        }
      } else {
        if (!triggered) {
          textMessage = "Default alert time is " + timeLimitMax + " '.";
        } else {
          textMessage += "more than " + timeLimitMin + " '.";
        }
        buttonCaption = "Not enough!";
        badFormat = limitFlag.task.goal.failure;
        goodFormat = limitFlag.task.goal.success;
      }

      if (confirmPopup) {
        buttonCaption = "<button>" + buttonCaption + "</button>";
        iziToast.warning({
          timeout: 6000,
          displayMode: "replace",
          id: "timing",
          zindex: 999,
          title: textTitle,
          message: textMessage,
          position: "bottomCenter",
          drag: false,
          close: true,
          buttons: [
            [
              "<button>Good anyway!</button>",
              async (instance, toast) => {
                updateBlock(
                  blockUID,
                  leftPart + goodFormat + " " + rightPart,
                  true
                );
                instance.hide({ transitionOut: "fadeOut" }, toast, "button");
              },
            ],
            [
              buttonCaption,
              async (instance, toast) => {
                updateBlock(
                  blockUID,
                  leftPart + badFormat + " " + rightPart,
                  true
                );
                instance.hide({ transitionOut: "fadeOut" }, toast, "button");
              },
              true,
            ],
          ],
        });
      } else leftPart = leftPart + badFormat;
    }
  }
  updateBlock(blockUID, leftPart + rightPart, true);
}

function scanTriggerWords(s, refs, callBack, once) {
  let result = [];
  let hasCat = false;
  let tag = "";
  s = s.toLowerCase();
  triggerTab.forEach((cat, i) => {
    if (refs.includes(cat.uid) || s.includes(cat.word.toLowerCase())) {
      result = callBack(cat, i, -1, result);
      hasCat = true;
      if (once) return result;
    }
    if (cat.children) {
      cat.children.forEach((subCat, j) => {
        if (
          refs.includes(subCat.uid) ||
          s.includes(subCat.word.toLowerCase())
        ) {
          result = callBack(
            subCat,
            i,
            j,
            result,
            hasCat,
            tag,
            subCat.word.toLowerCase()
          );
          if (once) return result;
          tag = subCat.word.toLowerCase();
        }
      });
      hasCat = false;
    }
  });
  if (result.length == 0) return callBack(null, -1, -1);
  return result;
}

function getLimitFromTriggerWord(tw, i = 0, j = 0) {
  if (tw == null) return [i, j];
  return tw.getLimitByInterval("task");
}

function extractLimit(s, shift) {
  let t = "";
  let i = 0;
  while (i + shift < s.length && !isNaN(s.charAt(i + shift))) {
    t += s.charAt(i + shift);
    i++;
  }
  return t;
}

function getLeftShift(firstSplit) {
  let shift = firstSplit.length - 2;
  if (shift < 0) shift = 0;
  return shift;
}

function getSecondTimestampStr(split, shift, sepIndex) {
  if (split.length > 2) {
    let h = parseInt(split[1].slice(-2));
    let m = parseInt(split[2].slice(0, 2));
    let hasSndTime = isNaN(h) == false && isNaN(m) == false;
    if (sepIndex >= shift + 5 && sepIndex < shift + 7 && hasSndTime)
      return getNormalizedTimestamp(h, m);
  }
  return null;
}

function getDifferenceBetweenTwoTimeStamps(begin, end) {
  let difference = end.mTotal - begin.mTotal;
  if (difference < 0) difference = 1440 + difference;
  return difference;
  /* version returning another timestamp
  let h = end.h - begin.h;
  if (h < 0) h = 24 - begin.h + end.h;
  let m = end.m - begin.m;
  if (m < 0) {
    m = 60 + m;
    h -= 1;
  }
  return getNormalizedTimestamp(h, m);*/
}

function concatTimeStamps(begin, end, elapsed) {
  return (
    begin +
    intervalSeparator +
    end +
    " " +
    durationFormat.replace("<d>", elapsed) +
    " "
  );
}

/*======================================================================================================*/
/* TOTAL TIME */
/*======================================================================================================*/

function totalTime(currentUID) {
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
      let dSplit = durationFormat.split("<d>");
      let right = "";
      if (dSplit.length > 1) {
        right = dSplit[1];
      }
      let result = extractDelimitedNumberFromString(
        blockContent,
        dSplit[0],
        right
      );
      //let triggerIndex = getTriggerIndex(blockContent);
      let refs = getBlocksUidReferencedInThisBlock(tree[i].uid);
      let triggerIndex = scanTriggerWords(
        blockContent,
        refs,
        getTriggerIndexes,
        false
      );
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
            } else {
              let sub = cat.children[index[1]];
              if (!hasCatTag) {
                if (indexStr.includes(",-1]")) {
                  let splLeft = indexStr.split(",-1]");
                  for (let k = 0; k < splLeft.length - 1; k++) {
                    let splRight = splLeft[k].split("[");
                    let catIndex = splRight[splRight.length - 1];
                    if (triggerTab[catIndex].word == sub.word) {
                      isOnlyTag = true;
                    }
                  }
                  if (!isOnlyTag) {
                    cat.time += result;
                  }
                } else {
                  cat.time += result;
                }
                if (!isOnlyTag) {
                  sub.time += result;
                }
              } else {
                let itsCat = JSON.stringify([index[0], -1]);
                if (indexStr.includes(itsCat)) {
                  sub.time += result;
                }
              }
            }
            lastCat = index[0];
          }
        }
      }
      total += result;
    }
  }
  return total;
}

function extractDelimitedNumberFromString(blockContent, before, after) {
  let number = 0;
  if (blockContent.includes(after)) {
    let leftPart = blockContent.split(after)[0];
    if (leftPart.length > 0) {
      let splitted = leftPart.split(before);
      let length = splitted.length;
      if (length > 0) {
        let n = splitted[length - 1];
        if (!isNaN(n)) {
          number = parseInt(n);
        }
        if (isNaN(number)) {
          number = 0;
        }
      }
    }
  }
  return number;
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

function formatDisplayTime(w, title, formatTag) {
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

var Output = function (s) {
  this.text = s;
  this.children = [];

  this.setChildren = function (t) {
    this.children = t;
  };
  this.getText = function () {
    return this.text;
  };
};

function getTriggeredTime(t) {
  let totalOutput = new Output(t);
  let cat = [];
  for (let i = 0; i < triggerTab.length; i++) {
    if (triggerTab[i].time != 0) {
      let title;
      if (titleIsRef) {
        title = "((" + triggerTab[i].uid + "))";
      } else {
        title = triggerTab[i].word;
      }
      let formatedCatTotal = formatDisplayTime(
        triggerTab[i],
        title,
        triggerTab[i].format
      );
      let catOutput = new Output(formatedCatTotal);
      cat.push(catOutput);
      let sub = [];
      if (displaySubCat) {
        for (let j = 0; j < triggerTab[i].children.length; j++) {
          let child = triggerTab[i].children[j];
          if (child.time != 0 && child.display) {
            if (titleIsRef) {
              title = "((" + child.uid + "))";
            } else {
              title = child.word;
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

function convertMinutesTohhmm(time) {
  let h = Math.floor(time / 60);
  let m = time % 60;
  let timeString = "";
  if (h > 0) {
    timeString += h + "h";
  }
  if (m < 10) {
    m = "0" + m.toString();
  }
  if (h == 0) {
    m += "'";
  }
  timeString += m;
  return timeString;
}

/*======================================================================================================*/
/* LOAD EXTENSION AND GET SETTINGS */
/*======================================================================================================*/

function getParameters() {
  if (categoriesUID != null) getTriggerWords(normalizeUID(categoriesUID));
  if (limitsUID != null) getLimits(normalizeUID(limitsUID));
  switch (flagsDropdown) {
    case "Color block tags (green/red)":
      limitFlag = getLimitFlags("Tags");
      break;
    case "Customized":
      limitFlag = getLimitFlags("Customized", customFlags);
      break;
    default:
      limitFlag = getLimitFlags("Icons");
  }
}

function getTriggerWords(parentUid) {
  let triggerTree = getChildrenTree(parentUid);

  if (triggerTree) {
    for (let i = 0; i < triggerTree.length; i++) {
      let w = triggerTree[i];
      let hide = false;
      if (w.string.includes("{hide}")) {
        hide = true;
        w.string = w.string.replace("{hide}", "");
      }
      triggerTab.push(new TriggerWord(w.string, w.uid, null, ""));
      if (w.children) {
        for (let j = 0; j < w.children.length; j++) {
          let hideSub = false;
          let t = w.children[j].string;
          if (t.includes("{hide}")) {
            t = t.replace("{hide}", "");
            hideSub = true;
          }
          let format = "";
          triggerTab[i].addChildren(t, w.children[j].uid, "", format);
          if (hide || hideSub) {
            triggerTab[i].children[
              triggerTab[i].children.length - 1
            ].display = false;
          }
        }
      }
    }
  }
}

function getLimits(uid) {
  let tree = getChildrenTree(uid);
  if (tree) {
    tree.forEach((limitType) => {
      if (limitType.string.toLowerCase().includes("goal")) {
        getLimitsInterval("goal", limitType.children);
      }
      if (limitType.string.toLowerCase().includes("limit")) {
        getLimitsInterval("limit", limitType.children);
      }
    });
  }
}

function getLimitsInterval(type, tree) {
  if (tree) {
    tree.forEach((limitInterval) => {
      let content = limitInterval.string.toLowerCase();
      if (content.includes("day")) {
        getLimitsByTypeAndInterval(type, "day", limitInterval.children);
      }
      if (content.includes("task")) {
        getLimitsByTypeAndInterval(type, "task", limitInterval.children);
      }
    });
  }
}

function getLimitsByTypeAndInterval(type, interval, tree) {
  if (tree) {
    tree.forEach((limitDuration) => {
      if (limitDuration.children) {
        let duration = limitDuration.string.replace(/[^0-9]+/g, "");
        if (!isNaN(duration)) {
          limitDuration.children.forEach((catRef) => {
            let tw = triggerTab.find(
              (item) => item.uid === catRef.string.slice(2, -2)
            );
            if (tw == undefined)
              tw = searchSubCatByUidOrWord(catRef.string.slice(2, -2), "uid");
            if (tw != null && tw != undefined)
              tw.setLimit(type, interval, parseInt(duration));
          });
        }
      }
    });
  }
}

function searchSubCatByUidOrWord(value, attr) {
  for (let i = 0; i < triggerTab.length; i++) {
    let subCat = triggerTab[i].children;
    if (subCat) {
      let tw = subCat.find((item) => item[attr] === value);
      if (tw != undefined) {
        return tw;
      }
    }
  }
  return null;
}

function getLimitFlags(type, input = "") {
  let goalS, goalF, limitS, limitF;
  if (type == "Icons") return limitFlagDefault;
  if (type == "Tags") {
    goalS = "#.good-time";
    goalF = "#.insufficient-time";
    limitS = "#.good-time";
    limitF = "#.exceeded-time";
  }
  if (type == "Customized") {
    let splitInput = input.split(",");
    console.log(splitInput);
    if (!(splitInput.length == 2 || splitInput.length == 4))
      return limitFlagDefault;
    if (splitInput.length == 2) {
      goalS = splitInput[0];
      limitS = splitInput[0];
      goalF = splitInput[1];
      limitF = splitInput[1];
    } else {
      goalS = splitInput[0];
      goalF = splitInput[1];
      limitS = splitInput[2];
      limitF = splitInput[3];
    }
  }
  return (limitFlag = {
    task: {
      goal: { success: goalS, failure: goalF },
      limit: { success: limitS, failure: limitF },
    },
    day: {
      goal: { success: goalS, failure: goalF },
      limit: { success: limitS, failure: limitF },
    },
  });
}

function registerPaletteCommands() {
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Elapsed time",
    callback: () => {
      const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      elapsedTime(startUid);
    },
  });
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Total time",
    callback: () => {
      const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      totalTime(startUid);
    },
  });
}

function registerSmartblocksCommands(extensionAPI) {
  const panel = extensionAPI;
  const elapCmd = {
    text: "ELAPSEDTIME",
    help: "Calcul elapsed time between now an a timestamps at the beginning of the block",
    handler: (context) => () => {
      elapsedTime(context.targetUid);
      return "";
    },
  };
  const totalCmd = {
    text: "TOTALTIME",
    help: "Calcul total elapsed time and total by category in sibbling blocks or first level of children blocks",
    handler: (context) => () => {
      totalTime(context.targetUid);
      return "";
    },
  };
  const updCatCmd = {
    text: "UPDATECATSFORET",
    help: "Update categories/subcategories and parent block reference for Elapsed Time extension. 1. Block reference of the parent block.",
    handler: (context) => () => {
      categoriesUID = context.variables.triggerUID;
      panel.settings.set("categoriesSetting", categoriesUID);
      getTriggerWords(normalizeUID(categoriesUID));
      return "";
    },
  };
  const updLimCmd = {
    text: "UPDATELIMITSFORET",
    help: "Update Goals/Limits and parent block reference for Elapsed Time extension. 1. Block reference of the parent block.",
    handler: (context) => () => {
      limitsUID = context.variables.triggerUID;
      panel.settings.set("limitsSetting", limitsUID);
      getLimits(normalizeUID(limitsUID));
      return "";
    },
  };
  if (window.roamjs?.extension?.smartblocks) {
    window.roamjs.extension.smartblocks.registerCommand(elapCmd);
    window.roamjs.extension.smartblocks.registerCommand(totalCmd);
    window.roamjs.extension.smartblocks.registerCommand(updCatCmd);
    window.roamjs.extension.smartblocks.registerCommand(updLimCmd);
  } else {
    document.body.addEventListener(
      `roamjs:smartblocks:loaded`,
      () =>
        window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(elapCmd) &&
        window.roamjs.extension.smartblocks.registerCommand(totalCmd) &&
        window.roamjs.extension.smartblocks.registerCommand(updCatCmd) &&
        window.roamjs.extension.smartblocks.registerCommand(updLimCmd)
    );
  }
}

function correctUidInput(uid) {
  if (uid.length != 9 || uid.length == 13) {
    return normalizeUID(uid);
  } else {
    console.log(
      "CategoriesUID has to be a valid block reference, with or without brackets."
    );
    return null;
  }
}

const panelConfig = {
  tabTitle: "Elapsed time calculator",
  settings: [
    {
      id: "categoriesSetting",
      name: "Categories",
      description:
        "Parent block reference where your categories and subcategories are listed:",
      action: {
        type: "input",
        onChange: (evt) => {
          categoriesUID = correctUidInput(evt.target.value);
          extensionAPI.settings.set("categoriesSetting", categoriesUID);
          if (categoriesUID != null) getTriggerWords(categoriesUID);
        },
      },
    },
    {
      id: "limitsSetting",
      name: "Goals and Limits",
      description:
        "Parent block reference where your goals and limits are set:",
      action: {
        type: "input",
        onChange: (evt) => {
          limitsUID = correctUidInput(evt.target.value);
          extensionAPI.settings.set("limitsSetting", limitsUID);
          if (limitsUID != null) getLimits(limitsUID);
        },
      },
    },
    {
      id: "flagsDropdown",
      name: "Predefined Flags",
      description:
        "Choose a set of predefined flags or choose 'Customized' and fill the input filed below:",
      action: {
        type: "select",
        items: ["🎯,⚠️,👍,🛑", "Color block tags (green/red)", "Customized"],
        onChange: (evt) => {
          if (evt == "Color block tags (green/red)")
            limitFlag = getLimitFlags("Tags");
          else {
            if (evt == "🎯,⚠️,👍,🛑") limitFlag = getLimitFlags("Icons");
            else limitFlag = getLimitFlags("Customized", customFlags);
          }
        },
      },
    },
    {
      id: "flagsSetting",
      name: "Customized Flags",
      description:
        "Set flags to insert, separated by a comma: goal reached or not, (and optionally) limit respected or exceeded:",
      action: {
        type: "input",
        placeholder: "goal-success,goal-fail [,limit-success,limit-fail]",
        onChange: (evt) => {
          if (evt.target.value.includes(","))
            limitFlag = getLimitFlags("Customized", evt.target.value);
        },
      },
    },
    {
      id: "displaySetting",
      name: "Display subcategories",
      description: "Display subcategories in Total time per day",
      action: {
        type: "switch",
        onChange: () => {
          displaySubCat = !displaySubCat;
        },
      },
    },
    {
      id: "popupSetting",
      name: "Display confirmation popup",
      description:
        "Ask for confirmation before applying a flag to the current block (automatic if disable):",
      action: {
        type: "switch",
        onChange: () => {
          confirmPopup = !confirmPopup;
        },
      },
    },
    {
      id: "defaultTimeSetting",
      name: "Default alert time",
      description:
        "Time limit (in minutes) beyond which an alert & confirmation popup (if enabled) will appear if no limit is defined for the block (default: 90)",
      action: {
        type: "input",
        placeholder: "90",
        onChange: (evt) => {
          if (!isNaN(evt.target.value))
            defaultTimeLimit = parseInt(evt.target.value);
        },
      },
    },
    {
      id: "intervalSetting",
      name: "Interval separator",
      description:
        "Characters to insert between two timestamps to specify an interval (don't forget the spaces if required):",
      action: {
        type: "input",
        onChange: (evt) => {
          intervalSeparator = evt.target.value;
          extensionAPI.settings.set("intervalSetting", intervalSeparator);
        },
      },
    },
    {
      id: "durationSetting",
      name: "Elapsed time format for an interval",
      description:
        "Format to emphasize the elapsed time, <d> being the required placeholder for the elapsed time value:",
      action: {
        type: "input",
        onChange: (evt) => {
          if (evt.target.value.includes("<d>"))
            durationFormat = evt.target.value;
        },
      },
    },
    {
      id: "totalTitleSetting",
      name: "Total parent block format",
      description:
        "Format of the 'Total time' parent block, <th> being the required placeholder for the total time value:",
      action: {
        type: "input",
        onChange: (evt) => {
          if (evt.target.value.includes("<th>")) totalTitle = evt.target.value;
        },
      },
    },
    {
      id: "totalCatSetting",
      name: "Total per category format",
      description:
        "Format of each category's 'Total time'. Placeholders: <th> for total time, <category> and <limit> for limit format defined below:",
      action: {
        type: "input",
        onChange: (evt) => {
          if (
            evt.target.value.includes("<th>") &&
            evt.target.value.includes("<category>")
          )
            totalFormat = evt.target.value;
        },
      },
    },
    {
      id: "limitFormatSetting",
      name: "Limit per category format",
      description:
        "Format of the limit display for each category. Placeholders: <flag> for limit flag, <type> for 'Goal' or 'Limit', <value> for predefined limit value:",
      action: {
        type: "input",
        onChange: (evt) => {
          limitFormat = evt.target.value;
        },
      },
    },
  ],
};

export default {
  onload: ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);
    categoriesUID = extensionAPI.settings.get("categoriesSetting");
    limitsUID = extensionAPI.settings.get("limitsSetting");
    if (extensionAPI.settings.get("displaySetting") == null)
      extensionAPI.settings.set("button-setting", true);
    displaySubCat = extensionAPI.settings.get("displaySetting");
    if (extensionAPI.settings.get("flagsDropdown") == null)
      extensionAPI.settings.set("flagsDropdown", "🎯,⚠️,👍,🛑");
    flagsDropdown = extensionAPI.settings.get("flagsDropdown");
    if (extensionAPI.settings.get("flagsSetting") == null)
      extensionAPI.settings.set("flagsSetting", "");
    customFlags = extensionAPI.settings.get("flagsSetting");
    if (extensionAPI.settings.get("popupSetting") == null)
      extensionAPI.settings.set("popupSetting", true);
    confirmPopup = extensionAPI.settings.get("popupSetting");
    if (extensionAPI.settings.get("defaultTimeSetting") == null)
      extensionAPI.settings.set("defaultTimeSetting", 90);
    defaultTimeLimit = extensionAPI.settings.get("defaultTimeSetting");
    if (extensionAPI.settings.get("intervalimeSetting") == null)
      extensionAPI.settings.set("intervalSetting", " - ");
    intervalSeparator = extensionAPI.settings.get("intervalSetting");
    if (extensionAPI.settings.get("durationSetting") == null)
      extensionAPI.settings.set("durationSetting", "(**<d>'**)");
    durationFormat = extensionAPI.settings.get("durationSetting");
    if (extensionAPI.settings.get("totalTitleSetting") == null)
      extensionAPI.settings.set("totalTitleSetting", "Total time: **(<th>)**");
    totalTitle = extensionAPI.settings.get("totalTitleSetting");
    if (extensionAPI.settings.get("totalCatSetting") == null)
      extensionAPI.settings.set(
        "totalCatSetting",
        "<category>: **(<th>)** <limit>"
      );
    totalFormat = extensionAPI.settings.get("totalCatSetting");
    if (extensionAPI.settings.get("limitFormatSetting") == null)
      extensionAPI.settings.set(
        "limitFormatSetting",
        "<flag> (<type>: <value>')"
      );
    limitFormat = extensionAPI.settings.get("limitFormatSetting");

    registerPaletteCommands();
    registerSmartblocksCommands(extensionAPI);
    getParameters();
    console.log("Elapsed Time Calculator loaded.");

    function setLimitUidInPanel(uid) {
      extensionAPI.settings.set("limitsSetting", normalizeUID(uid));
    }
  },
  onunload: () => {
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Elapsed time",
    });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Total time",
    });
    console.log("Elapsed Time Calculator unloaded.");
  },
};
