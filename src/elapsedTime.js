import { Intent } from "@blueprintjs/core";
import { confirmTimingPopup } from "./notify";
import {
  addZero,
  extractDelimitedNumberFromString,
  getBlockAttributes,
  getBlockContent,
  getBlocksUidReferencedInThisBlock,
  getChildrenTree,
  getParentUID,
  updateBlock,
} from "./util";
import {
  confirmPopup,
  defaultTimeLimit,
  durationFormat,
  intervalSeparator,
  limitFlag,
  remoteElapsedTime,
} from ".";
import { scanCategories } from "./categories";
import { getDifferenceWithLimit } from "./display";

/*======================================================================================================*/
/* ELAPSED TIME SB */
/*======================================================================================================*/

/************************* DEFAULT HIDDEN SETTINGS **************************/
var limitPresets = true; // false if you want disable trigger words search
var inlineMinLimit = "min:";
var inlineMaxLimit = "max:";
var pomoIsLimit = true; // Pomodotor timer as min trigger
var appendHourTag = false; // add a tag with the round current hour, like #19:00
/**********************************************************************/

const timestampRegex = /[0-9]{1,2}:[0-9]{1,2}/g;
const timestampButtonRegex = /{{[^\}]*:SmartBlock:[^\}]*buttons?}}/;
class TimeStamp {
  constructor(stringTT) {
    this.original = stringTT;
    let splited = stringTT.split(":");
    this.h = splited[0];
    this.m = splited[1];
    this.normalizedTT = addZero(this.h) + ":" + addZero(this.m);
    this.mTotal = parseInt(this.h) * 60 + parseInt(this.m);
  }

  getInterval(end) {
    let difference = end.mTotal - this.mTotal;
    if (difference < 0) difference = 1440 + difference;
    return difference;
  }

  concatWithAnotherTimeStamp(end, separator) {
    return this.normalizedTT + separator + end.normalizedTT;
  }
}

export async function elapsedTime(blockUID, separator = null) {
  let hourTag = "";
  let blockContent = getBlockContent(blockUID);
  blockContent = blockContent.replace(" {{⇥🕞:SmartBlock:Elapsed time}}", "");
  let matchingTT = [...blockContent.matchAll(timestampRegex)];
  if (matchingTT.length == 0) {
    // let hasTSinParent = false;
    // if (remoteElapsedTime)
    //   hasTSinParent = await searchTimestampInParentBlock(blockUID);
    // if (!hasTSinParent && firstLoop) {
    if (remoteElapsedTime) searchTimestampInPreviousSibbling(blockUID);
    let now = new Date();
    separator = separator ? " " + separator : "";
    let nowTS =
      new TimeStamp(now.getHours() + ":" + now.getMinutes()).normalizedTT +
      separator;
    let matchingButton = blockContent.match(timestampButtonRegex);
    if (matchingButton) {
      if (matchingButton[0].includes("Double"))
        nowTS += " {{⇥🕞:SmartBlock:Elapsed time}}";
      blockContent = blockContent.replace(matchingButton[0], nowTS);
    } else blockContent = nowTS + " " + blockContent;
    let focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
    updateBlock(blockUID, blockContent);
    setTimeout(() => {
      window.roamAlphaAPI.ui.setBlockFocusAndSelection({
        location: focusedBlock,
      });
    }, 200);
    return;
    //} else return false;
  }
  let begin = new TimeStamp(matchingTT[0][0]);
  let end;
  let title = "";
  if (matchingTT.length > 1) {
    title = blockContent.slice(matchingTT[1].index + matchingTT[1][0].length);
    end = new TimeStamp(matchingTT[1][0]);
  } else {
    let d = new Date();
    end = new TimeStamp(d.getHours() + ":" + d.getMinutes());
    title = blockContent.slice(matchingTT[0].index + matchingTT[0][0].length);
  }
  let elapsed = begin.getInterval(end);
  let leftPart =
    blockContent.slice(0, matchingTT[0].index) +
    begin.concatWithAnotherTimeStamp(end, intervalSeparator) +
    " " +
    durationFormat.replace("<d>", elapsed) +
    " ";
  if (appendHourTag) hourTag = " #[[" + begin.h + ":00]]";

  let rightPart = title.trim() + hourTag;
  compareToLimitsAndUpdate(blockUID, title, leftPart, rightPart, elapsed);
  //return true;
}

// async function searchTimestampInParentBlock(currentBlockUid) {
//   let parentUid = getParentUID(currentBlockUid);
//   let content = getBlockContent(parentUid);
//   if (!content) return false;
//   return await elapsedTime(parentUid, false);
// }
function searchTimestampInPreviousSibbling(currentBlockUid) {
  let parentUid = getParentUID(currentBlockUid);
  let order = getBlockAttributes(currentBlockUid).order;
  let previousSibbling = getChildrenTree(parentUid).find(
    (block) => block.order == order - 1
  );
  if (previousSibbling?.string.match(timestampRegex)?.length == 1) {
    elapsedTime(previousSibbling.uid);
  }
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
    let limitResult = scanCategories(rightPart, refs, getLimitFromCategorie, true);
    if (limitResult.goal > 0) {
      withMin = true;
      timeLimitMin = limitResult.goal;
      limitType = "Goal";
    }
    if (limitResult.limit > 0) {
      withMax = true;
      timeLimitMax = limitResult.limit;
      limitType = limitResult.goal > 0 ? "Goal & Limit" : "Limit";
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
    let badFormat = getLimitFlagFormat(
      limitFlag.task.limit.failure,
      elapsed,
      timeLimitMax
    );
    let goodFormat = getLimitFlagFormat(
      limitFlag.task.goal.success,
      elapsed,
      timeLimitMin
    );

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
        badFormat = getLimitFlagFormat(
          limitFlag.task.limit.failure,
          elapsed,
          timeLimitMax
        );
        goodFormat = getLimitFlagFormat(
          limitFlag.task.goal.success,
          elapsed,
          timeLimitMin
        );
      } else {
        textMessage += "more than " + timeLimitMin + "'";
        badFormat = getLimitFlagFormat(
          limitFlag.task.goal.failure,
          elapsed,
          timeLimitMin
        );
        buttonCaption = "Not enough anyway!";
      }
      if (confirmPopup) {
        confirmTimingPopup({
          title: textTitle,
          message: textMessage,
          goodLabel: "Great!",
          badLabel: buttonCaption,
          onGood: () => updateBlock(blockUID, leftPart + goodFormat + " " + rightPart),
          onBad: () => updateBlock(blockUID, leftPart + badFormat + " " + rightPart),
          intent: Intent.SUCCESS,
        });
      }
    } else {
      if ((exceeded && withMin) || (insufficient && withMax)) {
        textMessage += "between " + timeLimitMin + "' & " + timeLimitMax + "'";
        buttonCaption = "Too much!";
        if (insufficient) {
          badFormat = getLimitFlagFormat(
            limitFlag.task.goal.failure,
            elapsed,
            timeLimitMin
          );
          goodFormat = getLimitFlagFormat(
            limitFlag.task.limit.success,
            elapsed,
            timeLimitMax
          );
          buttonCaption = "Not enough!";
        }
      } else if ((!okUnder && !insufficient) || exceeded) {
        buttonCaption = "Too much!";
        goodFormat = getLimitFlagFormat(
          limitFlag.task.limit.success,
          elapsed,
          timeLimitMax
        );
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
        badFormat = getLimitFlagFormat(
          limitFlag.task.goal.failure,
          elapsed,
          timeLimitMin
        );
        goodFormat = getLimitFlagFormat(
          limitFlag.task.goal.success,
          elapsed,
          timeLimitMin
        );
      }

      if (confirmPopup) {
        confirmTimingPopup({
          title: textTitle,
          message: textMessage,
          goodLabel: "Good anyway!",
          badLabel: buttonCaption,
          onGood: () => updateBlock(blockUID, leftPart + goodFormat + " " + rightPart),
          onBad: () => updateBlock(blockUID, leftPart + badFormat + " " + rightPart),
          intent: Intent.WARNING,
        });
      } else leftPart = leftPart + badFormat;
    }
  }
  rightPart = removePreviousDuration(rightPart);
  updateBlock(blockUID, leftPart + rightPart);
}

function getLimitFlagFormat(flag, time, limit) {
  if (!flag.includes("<diff>")) return flag;
  let diffToDisplay;
  diffToDisplay = getDifferenceWithLimit(time, limit);
  let limitFlagFormat = flag.replace("<diff>", diffToDisplay).trim();
  return limitFlagFormat;
}

function removePreviousDuration(content) {
  let dSplit = durationFormat.split("<d>");
  let right = "";
  if (dSplit.length > 1) {
    right = dSplit[1];
  }
  let result = extractDelimitedNumberFromString(content, dSplit[0], right);
  if (result != -1) content = content.replace(dSplit[0] + result + right, "");
  return content.trim();
}

function getLimitFromCategorie(tw, i = 0, j = 0) {
  if (tw == null) return { goal: i, limit: j };
  return tw.getLimitByInterval("task");
}

function extractLimit(s, shift) {
  let t = "";
  let i = 0;
  while (i + shift < s.length && !isNaN(s.charAt(i + shift))) {
    t += s.charAt(i + shift);
    i++;
  }
  return parseInt(t) || 0;
}

