import iziToast from "izitoast";
import "../node_modules/izitoast/dist/css/iziToast.css";

/************************* DEFAULT SETTINGS **************************/
var defaultTimeLimit = 60; // set to 0 if you want always popup notification
var limitPresets = true; // false if you want disable trigger words search
var inlineMinLimit = "goal:";
var inlineMaxLimit = "max:";
var pomoIsLimit = true; // Pomodotor timer as min trigger
var confirmPopup = true; // false if you want automatic formating without popup notification
var appendHourTag = false; // add a tag with the round current hour, like #19:00
/**********************************************************************/

var totalTitle = "Total time: **(<th>)**";
var triggerTab = [];
var intervalSeparator = " - ";
var durationFormat = "(**<d>'**)";
var totalFormat = "<category>: **(<th>)** <limit>";
var limitFormat = "<flag> (<type>: <value>')";
var limitFlag = {
  task: {
    goal: { success: "#.good-time", failure: "#.insufficient-time" },
    limit: { success: "#.good-time", failure: "#.exceeded-time" },
  },
  day: {
    goal: { success: "🎯", failure: "⚠️" },
    limit: { success: "👍", failure: "🛑" },
  },
};
var uncategorized;

function getTreeByPageTitle(pageTitle) {
  return window.roamAlphaAPI.q(`[:find ?uid ?s 
							   :where [?b :node/title "${pageTitle}"]
									  [?b :block/children ?cuid]
									  [?cuid :block/uid ?uid]
									  [?cuid :block/string ?s]]`);
}

function getChildrenTree(uid) {
  let q = `[:find (pull ?page
                       [:block/uid :block/string :block/children 
						{:block/children ...} ])
                    :where [?page :block/uid "${uid}"]  ]`;
  return window.roamAlphaAPI.q(q)[0][0].children;
}

function getParentUID(uid) {
  let q = `[:find ?u 
            :where [?p :block/uid ?u] 
            	[?p :block/children ?e]
            	[?e :block/uid "${uid}"]]`;
  return window.roamAlphaAPI.q(q)[0][0];
}

function TriggerWord(s, uid, l, f) {
  this.word = this.getOnlyWord(s);
  this.uid = uid;
  this.display = true;
  this.limit = l;
  this.time = 0;
  this.format = f;
  this.children = [];
}
TriggerWord.prototype.addChildren = function (s, u, l, f) {
  return this.children.push(new TriggerWord(s, u, l, f));
};
TriggerWord.prototype.getOnlyWord = function (s) {
  s = s.split("{")[0];
  return s.trim();
};

function getParameters() {
  let tree = getTreeByPageTitle(
    "roam/js/smartblocks/TimeStamp Buttons and elapsed time calculator"
  );
  for (let i = 0; i < tree.length; i++) {
    let parentUid = tree[i][0];
    switch (tree[i][1]) {
      case "Categories":
        getTriggerWords(parentUid);
        break;
      case "Duration format":
        getDurationFormat(parentUid);
        break;
      case "Separator":
        getSeparator(parentUid);
        break;
      case "Total format":
        getTotalFormat(parentUid);
        break;
      case "Limit format":
        getLimitFormat(parentUid);
        break;
      case "Limits flags":
        getLimitFlags(parentUid);
        break;
    }
  }
}

function getDurationFormat(parentUid) {
  let tree = getChildrenTree(parentUid);
  if (tree) {
    durationFormat = tree[0].string;
  }
}

function getSeparator(parentUid) {
  let tree = getChildrenTree(parentUid);
  if (tree) {
    let intervalSeparator = tree[0].string;
  }
}

function getTotalFormat(parentUid) {
  let tree = getChildrenTree(parentUid);
  if (tree) {
    let f0 = tree[0].string;
    let f1 = tree[1].string;
    if (f0.includes("<category>")) {
      totalFormat = f0;
    } else {
      totalTitle = f0;
    }
    if (f1.includes("<category>")) {
      totalFormat = f1;
    } else {
      totalTitle = f1;
    }
  }
}

function getLimitFormat(parentUid) {
  let tree = getChildrenTree(parentUid);
  if (tree) {
    limitFormat = tree[0].string;
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
          if (t.includes("limit:") || t.includes("goal:")) {
            triggerTab[triggerTab.length - 1].limit = getLimits(t);
          } else if (t.includes("format:")) {
            triggerTab[triggerTab.length - 1].format = getFormat(t);
          } else {
            if (t.includes("{hide}")) {
              t = t.replace("{hide}", "");
              hideSub = true;
            }
            let format = "";
            let limit = null;
            if (w.children[j].children) {
              for (let k = 0; k < w.children[j].children.length; k++) {
                let childS = w.children[j].children[k].string;
                if (childS.includes("limit:") || childS.includes("goal:")) {
                  limit = getLimits(childS);
                } else if (childS.includes("format:")) {
                  format = getFormat(childS);
                }
              }
            }
            triggerTab[i].addChildren(t, w.children[j].uid, limit, format);
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
}

function getLimits(s) {
  let limitsTab = [0, 0];
  let limitType = null;
  let limitString;
  if (s.includes("goal:")) {
    limitType = "goal";
    limitString = s.slice(5);
  } else if (s.includes("limit:")) {
    limitType = "limit";
    limitString = s.slice(6);
  }
  if (limitType != null) {
    let spl = limitString.split(",");
    for (let i = 0; i < spl.length; i++) {
      switch (spl[i].trim().slice(0, 2)) {
        case "t=":
          limitsTab[0] = spl[i].replace("t=", "").trim();
          break;
        case "d=":
          limitsTab[1] = spl[i].replace("d=", "").trim();
          break;
      }
    }
    return { type: limitType, task: limitsTab[0], day: limitsTab[1] };
  } else {
    return null;
  }
}

function getFormat(s) {
  if (s.includes("format:")) {
    return s.slice(7).trim();
  } else {
    return "";
  }
}

function flagByPeriod(period, type, result, s) {
  if (period == "" || period == "task") {
    limitFlag["task"][type][result] = s;
  }
  if (period == "" || period == "day") {
    limitFlag["day"][type][result] = s;
  }
}

function getLimitFlags(parentUid) {
  let triggerTree = getChildrenTree(parentUid);
  if (triggerTree) {
    for (let i = 0; i < triggerTree.length; i++) {
      let p = triggerTree[i];
      if (p.children) {
        for (let j = 0; j < p.children.length; j++) {
          let c1 = p.children[j];
          if (p.string == "goal" || p.string == "limit") {
            if (
              c1.string.includes("success:") ||
              c1.string.includes("failure:")
            ) {
              let flagString = c1.string.slice(8).trim();
              let period = "";
              let spl = flagString.split(",");
              for (let k = 0; k < spl.length; k++) {
                if (spl[k].trim().length > 1) {
                  switch (spl[k].trim().slice(0, 2)) {
                    case "t=":
                      period = "task";
                      flagString = spl[k].replace("t=", "").trim();
                      break;
                    case "d=":
                      period = "day";
                      flagString = spl[k].replace("d=", "").trim();
                      console.log(flagString);
                      break;
                  }
                }
                flagByPeriod(
                  period,
                  p.string,
                  c1.string.slice(0, 7),
                  flagString
                );
              }
            }
          }
        }
      }
    }
  }
}

/*==============================================================================================================================*/

/* ELAPSED TIME SB */

function getBlockContent(uid) {
  return window.roamAlphaAPI.q(`[:find (pull ?page [:block/string])
                      :where [?page :block/uid "${uid}"]  ]`)[0][0].string;
}

function TimeStamp(tColon) {
  (this.tColon = tColon),
    (this.m = parseInt(tColon.slice(-2))),
    (this.h = parseInt(tColon.slice(0, 2))),
    (this.mTotal = this.h * 60 + this.m);
}

function getNormalizedTimestamp(h, m) {
  return addZero(h) + ":" + addZero(m);
}

function addZero(i) {
  if (i < 10) {
    i = "0" + i;
  }
  return i;
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
  let h = end.h - begin.h;
  if (h < 0) h = 24 - begin.h + end.h;
  let m = end.m - begin.m;
  return getNormalizedTimestamp(h, m);
}

function concatTimeStamps(begin, end, elapsed) {
  return (
    begin +
    intervalSeparator +
    end +
    " " +
    durationFormat.replace("<d>", elapsed.mTotal) +
    " "
  );
}

async function updateBlock(uid, concent, isOpen) {
  await window.roamAlphaAPI.updateBlock({
    block: { uid: uid, string: content, open: isOpen },
  });
}

async function elapsedTime(blockUID) {
  let hourTag = "";
  let blockContent = getBlockContent(blockUID);
  let blockSplit = blockContent.split(":");
  let leftShift = getLeftShift(blockSplit[0]);
  let begin = new TimeStamp(blockContent.slice(leftShift, leftShift + 5));
  let title;
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
  let end = new TimeStamp(endStr);
  let elapsed = new TimeStamp(getDifferenceBetweenTwoTimeStamps(begin, end));
  let leftPart =
    blockSplit[0].slice(0, -2) +
    concatTimeStamps(begin.tColon, end.tColon, elapsed);
  if (appendHourTag) hourTag = " #[[" + begin.h + ":00]]";
  let rightPart = title.trim() + hourTag;
  compareToLimitsAndUpdate(leftPart, rightPart, elapsed.mTotal);
}

function compareToLimitsAndUpdate(leftPart, rightPart, elapsed) {
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
    let limitTab = getLimitOfFirstTriggerWord(rightPart.toLowerCase());
    let timeLimit = limitTab[0];
    if (timeLimit != 0) {
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

function getLimitOfFirstTriggerWord(s) {
  let timeLimit, limitType;
  let hasALimit = false;
  for (let i = 0; i < triggerTab.length; i++) {
    if (s.includes(triggerTab[i].word.toLowerCase())) {
      if (triggerTab[i].limit != null) {
        timeLimit = triggerTab[i].limit.task;
        limitType = triggerTab[i].limit.type;
      }
    }
    for (let j = 0; j < triggerTab[i].children.length; j++) {
      let tw = triggerTab[i].children[j];
      let wordLC = tw.word.toLowerCase();
      if (s.includes(wordLC)) {
        if (tw.limit != null) {
          timeLimit = tw.limit.task;
          limitType = tw.limit.type;
          hasALimit = true;
          break;
        }
      }
    }
    if (hasALimit) {
      break;
    }
  }
  return [timeLimit, limitType];
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

/*==============================================================================================================================*/
/* TOTAL TIME */

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
      let triggerIndex = getTriggerIndex(blockContent);
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

function getTriggerIndex(s) {
  s = s.toLowerCase();
  let indexTab = [];
  let hasCat = false;
  let tag = "";
  for (let i = 0; i < triggerTab.length; i++) {
    if (s.includes(triggerTab[i].word.toLowerCase())) {
      indexTab.push([i, -1]);
      hasCat = true;
    }
    for (let j = 0; j < triggerTab[i].children.length; j++) {
      let tw = triggerTab[i].children[j];
      let wordLC = tw.word.toLowerCase();
      if (s.includes(wordLC) && wordLC != tag) {
        indexTab.push([i, j]);
        if (hasCat) {
          tag = wordLC;
          let hasTagBefore = 0;
          let tagIndex = [];
          let tabWithoutCat = JSON.stringify(indexTab).replace(
            JSON.stringify([i, -1]),
            ""
          );
          if (tabWithoutCat.includes(",-1]")) {
            let left = tabWithoutCat.split(",-1]")[0].split("[");
            tagIndex = [left[left.length - 1], -1];
            hasTagBefore = 1;
          }
          indexTab.splice(0, indexTab.length - 2);
          if (tagIndex.length > 0) {
            indexTab.push(tagIndex);
          }
        }
      }
    }
    hasCat = false;
  }
  if (indexTab.length == 0) indexTab.push([-1, -1]);
  console.log(indexTab);
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
  } else return "";
}

var Output = function (s) {
  this.text = s;
  this.children = [];

  this.setChildren = function (t) {
    this.children = t;
  };
};

function getTriggeredTime(t) {
  let totalOutput = new Output(t);
  let cat = [];
  let titleIsRef = totalFormat.includes("{uid}");
  totalFormat = totalFormat.replace("{uid}", "");
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
      //      formatedCatTotal += displayLimit(triggerTab[i]);
      let catOutput = new Output(formatedCatTotal);
      cat.push(catOutput);
      let sub = [];
      if (triggerTab[i].display) {
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
            //            formatedSubTotal += displayLimit(child);
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

function insertTriggeredTime(uid, output) {
  if (output.children) {
    for (let i = 0; i < output.children.length; i++) {
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": uid, order: i },
        block: { string: output.children[i].text },
      });
    }
    if (uncategorized != 0) {
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": uid, order: output.children.length },
        block: { string: formatDisplayTime(null, "__Uncategorized__", "") },
      });
    }
  }
}

function convertMinutesTohhmm(time) {
  let h = Math.floor(time / 60);
  console.log(h);
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

/*==============================================================================================================================*/
/* LOAD */

export default {
  onload: () => {
    registerPaletteCommands();
    registerSmartblocksCommands();
    getParameters();
    console.log("Elapsed Time Calculator loaded.");
  },
  onunload: () => {
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Elapsed time",
    });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Total time",
    });
    console.log("Elapsed Time Calculator unloaded.");
    // remove commands
  },
};

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

function registerSmartblocksCommands() {
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
  if (window.roamjs?.extension?.smartblocks) {
    window.roamjs.extension.smartblocks.registerCommand(elapCmd);
    window.roamjs.extension.smartblocks.registerCommand(totalCmd);
  } else {
    document.body.addEventListener(
      `roamjs:smartblocks:loaded`,
      () =>
        window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(elapCmd) &&
        window.roamjs.extension.smartblocks.registerCommand(totalCmd)
    );
  }
}

/*==============================================================================================================================*/

/*  */
