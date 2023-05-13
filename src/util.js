import { durationRegex } from ".";

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
      [:block/uid :block/string :block/children 
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
      heading: result[":block/heading"],
      align: result[":block/text-align"],
      view: result[":block/view-type"],
    };
  else return null;
}

export function getBlockContent(uid) {
  return window.roamAlphaAPI.q(`[:find (pull ?page [:block/string])
                      :where [?page :block/uid "${uid}"]  ]`)[0][0].string;
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
  let pageUid = window.roamAlphaAPI.pull("[{:block/page [:block/uid]}]", [
    ":block/uid",
    blockUid,
  ]);
  if (pageUid === null) return blockUid;
  return pageUid[":block/page"][":block/uid"];
}

export function getPageUidByTitle(title) {
  let result = window.roamAlphaAPI.pull("[:block/uid]", [":node/title", title]);
  if (result) return result[":block/uid"];
  else return null;
}

export function getBlocksIncludingRef(uid) {
  return window.roamAlphaAPI.q(
    `[:find ?u ?s
         :where [?r :block/uid ?u]
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

export function getNormalizedTimestamp(h, m) {
  return addZero(h) + ":" + addZero(m);
}

export function normalizeUID(uid) {
  if (uid.length == 9) return uid;
  if (uid.length == 13 && uid.includes("((") && uid.includes("))"))
    return uid.slice(2, -2);
  console.log("Invalid block reference (uid).");
  return undefined;
}

export function convertMinutesTohhmm(time) {
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

export function extractDelimitedNumberFromString(blockContent, before, after) {
  let number;
  let match = blockContent.match(durationRegex);
  console.log(match);
  if (match) {
    return match[1];
  }
  // if (blockContent.includes(after)) {
  //   let leftPart = blockContent.split(after)[0];
  //   if (leftPart.length > 0) {
  //     let splitted = leftPart.split(before);
  //     let length = splitted.length;
  //     if (length > 0) {
  //       let n = splitted[length - 1];
  //       if (!isNaN(n) && n != "") {
  //         number = parseInt(n);
  //         return number;
  //       }
  //       if (isNaN(number)) {
  //         return "NaN";
  //       }
  //     }
  //   }
  // }
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
