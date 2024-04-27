import { durationRegex } from ".";

const limitDurationRegex = /([0-9][0-9]?[0-9]?) ?(h|'|min)([0-9]{1,2})?/i;

const numberRegex =
  /\d+|one|two|three|for|five|six|seven|height|nine|ten|eleven|twelve|thirteen|fourteen|fithteen|twenty|thirty|forty|fithty|sixty|hundred/;
const periodRegex =
  /day|week|month|quarter|year|jour|semaine|mois|trimestre|année/;
const pastAdjectiveRegex =
  /last|previous|former|past|prior|yesterday|dernier|dernière|précédent|passé|hier/;
const presentAdjectiveRegex =
  /this|current|present|that|actual|ce |cette |en cours/;

export function getTreeByPageTitle(pageTitle) {
  return window.roamAlphaAPI.q(`[:find ?uid ?s 
							   :where [?b :node/title "${pageTitle}"]
									  [?b :block/children ?cuid]
									  [?cuid :block/uid ?uid]
									  [?cuid :block/string ?s]]`);
}

export function getChildrenTree(uid) {
  if (uid) {
    let result = window.roamAlphaAPI.q(`[:find (pull ?page
      [:block/uid :block/string :block/children :block/order {:block/refs [:block/uid]}
         {:block/children ...} ])
       :where [?page :block/uid "${uid}"]  ]`);
    if (result.length > 0) return result[0][0].children;
  }
  return null;
}

export function getParentUID(uid) {
  let q = `[:find ?u 
            :where [?p :block/uid ?u] 
            	[?p :block/children ?e]
            	[?e :block/uid "${uid}"]]`;
  return window.roamAlphaAPI.q(q)[0][0];
}

export function getBlockAttributes(uid) {
  let result = window.roamAlphaAPI.pull("[*]", [":block/uid", uid]);
  if (result)
    return {
      string: result[":block/string"],
      open: result[":block/open"],
      order: result[":block/order"],
      heading: result[":block/heading"],
      align: result[":block/text-align"],
      view: result[":block/view-type"],
    };
  else return null;
}

export function getBlockContent(uid) {
  let result = window.roamAlphaAPI.q(`[:find (pull ?page [:block/string])
                      :where [?page :block/uid "${uid}"]  ]`);
  if (result[0][0]) return result[0][0].string;
  else return null;
  // return window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid])[
  //   ":block/string"
  // ];
}

export function getBlocksUidReferencedInThisBlock(uid) {
  let q = `[:find ?u 
            :where 
              [?r :block/uid "${uid}"] 
              [?r :block/refs ?x] 
              [?x :block/uid ?u] ]`;
  return window.roamAlphaAPI.q(q).flat();
}

export function getPageNameByPageUid(uid) {
  let r = window.roamAlphaAPI.data.pull("[:node/title]", [":block/uid", uid]);
  if (r != null) return r[":node/title"];
  else return "undefined";
}

export function getLonguestPageTitleFromUids(uids) {
  const longestPageTitleUid = uids.reduce((longestUid, currentUid) => {
    const longestPageTitle = getPageNameByPageUid(longestUid);
    const currentPageTitle = getPageNameByPageUid(currentUid);
    return currentPageTitle.length > longestPageTitle.length
      ? currentUid
      : longestUid;
  }, "");
  return longestPageTitleUid;
}

export async function getMainPageUid() {
  let uid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  let pageUid = window.roamAlphaAPI.pull("[{:block/page [:block/uid]}]", [
    ":block/uid",
    uid,
  ]);
  if (pageUid === null) return uid;
  return pageUid[":block/page"][":block/uid"];
}

export function getPageUidByAnyBlockUid(blockUid) {
  let pageUid = window.roamAlphaAPI.data.pull("[{:block/page [:block/uid]}]", [
    ":block/uid",
    blockUid,
  ]);
  if (pageUid === null) return blockUid;
  return pageUid[":block/page"][":block/uid"];
}
export function getPageTitleByBlockUid(uid) {
  return window.roamAlphaAPI.pull("[{:block/page [:block/uid :node/title]}]", [
    ":block/uid",
    uid,
  ])[":block/page"][":node/title"];
}

export function getPageUidByTitle(title) {
  let result = window.roamAlphaAPI.pull("[:block/uid]", [":node/title", title]);
  if (result) return result[":block/uid"];
  else return null;
}

export function getPageUidByPageName(page) {
  let p = window.roamAlphaAPI.q(`[:find (pull ?e [:block/uid]) 
							     :where [?e :node/title "${page}"]]`);
  if (p.length == 0) return undefined;
  else return p[0][0].uid;
}

export function getBlocksIncludingRef(uid) {
  return window.roamAlphaAPI.q(
    `[:find ?u ?s ?uidp
         :where [?r :block/uid ?u]
              [?r :block/page ?p]
              [?p :block/uid ?uidp]
              [?r :block/refs ?b]
                [?r :block/string ?s]
            [?b :block/uid "${uid}"]]`
  );
}

export function updateBlock(uid, content) {
  setTimeout(function () {
    window.roamAlphaAPI.updateBlock({
      block: { uid: uid, string: content },
    });
  }, 50);
}

export async function createBlock(
  parent,
  content,
  fixedUid = false,
  open = true,
  order = "last"
) {
  let uid;
  if (fixedUid) {
    uid = await window.roamAlphaAPI.util.generateUID();
    await window.roamAlphaAPI.createBlock({
      location: { "parent-uid": parent, order: order },
      block: { uid: uid, string: content, open: open },
    });
    return uid;
  } else {
    await window.roamAlphaAPI.createBlock({
      location: { "parent-uid": parent, order: order },
      block: { string: content, open: open },
    });
  }
}

export function simpleCreateBlock(
  parent,
  uid,
  content,
  open = true,
  order = "last"
) {
  if (uid)
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": parent, order: order },
      block: { uid: uid, string: content, open: open },
    });
  else
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": parent, order: order },
      block: { string: content, open: open },
    });
}

export async function addChildrenBlocks(
  parentUid,
  array,
  returnUids = false,
  open = true
) {
  let blocksUid = [];
  for (let i = 0; i < array.length; i++) {
    let uid = await createBlock(parentUid, array[i], returnUids, open);
    blocksUid.push(uid);
    if (i == array.length - 1 && returnUids) return blocksUid;
  }
}

export async function getCurrentBlockUidOrCreateIt() {
  let uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
  if (!uid) {
    let pageUid = await getMainPageUid();
    let pageTree = getChildrenTree(pageUid);
    uid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": pageUid, order: pageTree.length },
      block: { uid: uid, string: "" },
    });
  }
  return uid;
}

export function addPullWatch(uid, callback) {
  console.log("Pullwatch on " + uid);
  window.roamAlphaAPI.data.addPullWatch(
    "[:block/children :block/string {:block/children ...}]",
    `[:block/uid "${uid}"]`,
    function a(before, after) {
      //console.log("after", after);
      callback(uid);
    }
  );
}
export function removePullWatch(uid, callback) {
  console.log("Removed pullwatch");
  window.roamAlphaAPI.data.removePullWatch(
    "[:block/children :block/string {:block/children ...}]",
    `[:block/uid "${uid}"]`,
    function a(before, after) {
      callback(uid);
    }
  );
}

export function normalizeUID(uid) {
  if (!uid) return undefined;
  if (uid.length == 9) return uid;
  if (uid.length == 13 && uid.includes("((") && uid.includes("))"))
    return uid.slice(2, -2);
  console.log("Invalid block reference (uid).");
  return undefined;
}

export function simulateClick(el) {
  const options = {
    bubbles: true,
    cancelable: true,
    view: window,
    target: el,
    which: 1,
    button: 0,
  };
  el.dispatchEvent(new MouseEvent("mousedown", options));
  el.dispatchEvent(new MouseEvent("mouseup", options));
  el.dispatchEvent(new MouseEvent("click", options));
}

// DATE & TIME FUNCTIONS

export function convertMinutesTohhmm(time) {
  let h = Math.floor(time / 60);
  let m = time % 60;
  let timeString = "";
  if (h > 0) {
    timeString += h + "h";
    if (m < 10) {
      m = "0" + m.toString();
    }
  }
  if (h == 0) {
    m += "'";
  }
  timeString += m;
  return timeString;
}

export function convertMinutesToDecimals(minutes) {
  let hours = Math.floor(minutes / 60);
  let decimal = (minutes % 60) / 60;
  decimal = parseFloat(decimal.toFixed(2));
  let hourDecimal = hours + decimal;
  return hourDecimal.toFixed(2);
}

export function convertStringDurationToMinutes(string) {
  let match = string.match(limitDurationRegex);
  if (!match) return null;
  let min = 0,
    h = 0;
  if (match[2] === "'" || match[2] === "min") {
    min = parseInt(match[1]);
  } else if (match[2].toLowerCase() === "h") {
    h = parseInt(match[1]);
    min = match[3] != undefined ? parseInt(match[3]) : 0;
  }
  return min + h * 60;
}

export function getYesterdayDate(date = null) {
  if (!date) date = new Date();
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

export function getWeek(date = null) {
  if (!date) date = new Date();
  let startDate = new Date(date.getFullYear(), 0, 1);
  let days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
  return Math.ceil(days / 7);
}

export function addZero(i) {
  if (isNaN(i) && i.charAt(0) === "0") return i;
  let nb = parseInt(i);
  if (nb < 10) {
    nb = "0" + nb;
  }
  return nb;
}

export function getNormalizedTimestamp(h, m) {
  return addZero(h) + ":" + addZero(m);
}

export function getWeekNumber(date) {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const day = (date.getDay() + 6) % 7;
  const daysSinceOneJan = (date - oneJan) / 86400000 + 1;
  const week = Math.floor((daysSinceOneJan - day + 10) / 7);
  return week;
}

export function getQuarter(date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function dateIsInPeriod(day, period, dateFlag) {
  let r = false;
  switch (period) {
    case "week":
      getWeekNumber(day) == dateFlag ? (r = true) : (r = false);
      break;
    case "month":
      day.getMonth() == dateFlag ? (r = true) : (r = false);
      break;
    case "quarter":
      getQuarter(day) == dateFlag ? (r = true) : (r = false);
      break;
    case "year":
      day.getFullYear() == dateFlag ? (r = true) : (r = false);
      break;
  }
  return r;
}

export async function getNbOfDaysFromBlock(uid) {
  let content = getBlockContent(uid);
  let result, periodValue;
  if (!content) return null;
  let number = content.match(numberRegex);
  if (number) {
    number = number[0].trim();
    if (isNaN(number)) number = convertAlphabeticNumberToValue(number);
    else number = parseInt(number);
  }
  if (!number) number = 1;
  let period = content.match(periodRegex);
  if (period) {
    periodValue = convertPeriodInNumberOfDays(period[0]);
  } else periodValue = 1;
  let present = content.match(presentAdjectiveRegex);
  if (present) {
    result = periodValue;
  } else result = number * periodValue;
  let last = content.match(pastAdjectiveRegex);
  if (last && period) {
    result = "last " + period[0];
  }
  //console.log(result);
  return result;
}

function getLastDayOfPreviousWeek(day) {
  //let lastWeek = new Date(day.getTime() - 7 * 24 * 60 * 60 * 1000);
  let dayToSustract = day.getDay();
  if (dayToSustract == 0) dayToSustract = 7;
  //console.log(dayToSustract);
  return new Date(day.getTime() - dayToSustract * 24 * 60 * 60 * 1000);
}

function getLastDayOfPreviousMonth(day) {
  let lastMonth = new Date(day.getFullYear(), day.getMonth() - 1, 1);
  return new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
}

function getLastDayOfPreviousQuarter(day) {
  let quarterStartMonth = Math.floor(day.getMonth() / 3) * 3;
  let lastQuarter = new Date(day.getFullYear(), quarterStartMonth - 3, 1);
  return new Date(lastQuarter.getFullYear(), lastQuarter.getMonth() + 3, 0);
}

function getLastDayOfPreviousYear(day) {
  return new Date(day.getFullYear() - 1, 12, 31);
}

export function getLastDayOfPreviousPeriod(today, period) {
  switch (period) {
    case "week":
      return getLastDayOfPreviousWeek(today);
    case "month":
      return getLastDayOfPreviousMonth(today);
    case "quarter":
      return getLastDayOfPreviousQuarter(today);
    case "year":
      return getLastDayOfPreviousYear(today);
    default:
      return getYesterdayDate(today);
  }
}

export function convertPeriodInNumberOfDays(period) {
  switch (period) {
    case "week":
      return 7;
    case "month":
      return 31;
    case "quarter":
      return 92;
    case "year":
      return 366;
    default:
      return 1;
  }
}

function convertAlphabeticNumberToValue(number) {
  switch (number) {
    case "one":
      return 1;
    case "two":
      return 2;
    case "three":
      return 3;
    case "four":
      return 4;
    case "five":
      return 5;
    case "six":
      return 6;
    case "seven":
      return 7;
    case "eight":
      return 8;
    case "nine":
      return 9;
    case "ten":
      return 10;
    case "eleven":
      return 11;
    case "twelve":
      return 12;
    case "thirteen":
      return 13;
    case "fourteen":
      return 14;
    case "fifteen":
      return 15;
    case "twenty":
      return 20;
    case "thirty":
      return 30;
    case "forty":
      return 40;
    case "fithty":
      return 50;
    case "sixty":
      return 60;
    case "hundred":
      return 100;
    default:
      return null;
  }
}

export function extractDelimitedNumberFromString(blockContent) {
  let match = blockContent.match(durationRegex);
  if (match) {
    return match[1];
  }
  return -1;
}

export function getStringsAroundPlaceHolder(string, placeholder) {
  let split = string.split(placeholder);
  let left = split[0];
  let right;
  split.length > 1 ? (right = split[1]) : (right = "");
  return [left, right];
}

export function getSingleRegexFromArray(arr) {
  const regexStr = arr.join("");
  const regex = new RegExp(`${regexStr}`, "g");
  return regex;
}

export function getRegexFromArray(arr) {
  const regexStr = arr.map((str) => escapeCharacters(str)).join("|");
  const regex = new RegExp(`${regexStr}`, "gi");
  return regex;
}

export function escapeCharacters(str) {
  return str.replaceAll(/[.*+?^${}()|\[\]\\]/g, "\\$&");
}

export function sumOfArrayElements(array) {
  let s = 0;
  for (let i = 0; i < array.length; i++) {
    s += array[i];
  }
  return s;
}

export function getCommonElements(arr1, arr2) {
  return arr1.filter((elt) => arr2.includes(elt));
}
