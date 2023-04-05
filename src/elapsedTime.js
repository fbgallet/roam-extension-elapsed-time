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

const timestampRegex = /[0-9]{1,2}:[0-9]{1,2}/g;
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

export async function elapsedTime(blockUID) {
  let hourTag = "";
  let blockContent = getBlockContent(blockUID);
  // let blockSplit = blockContent.split(":");
  // let leftShift = getLeftShift(blockSplit[0]);
  let matchingTT = [...blockContent.matchAll(timestampRegex)];
  //let begin = new TimeStamp(blockContent.slice(leftShift, leftShift + 5));
  if (!matchingTT) return;
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
