import iziToast from "izitoast";
import "../node_modules/izitoast/dist/css/iziToast.css";
import {
  addZero,
  extractDelimitedNumberFromString,
  getBlockContent,
  getBlocksUidReferencedInThisBlock,
  getNormalizedTimestamp,
  updateBlock,
} from "./util";
import {
  confirmPopup,
  defaultTimeLimit,
  durationFormat,
  intervalSeparator,
  limitFlag,
  scanTriggerWords,
} from ".";

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

class TimeStamp {
  constructor(tColon) {
    this.tColon = tColon;
    this.m = parseInt(tColon.slice(-2));
    this.h = parseInt(tColon.slice(0, 2));
    this.mTotal = this.h * 60 + this.m;
  }
}

export async function elapsedTime(blockUID) {
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
  rightPart = removePreviousDuration(rightPart);
  updateBlock(blockUID, leftPart + rightPart, true);
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
