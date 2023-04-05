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

export function getBlockContent(uid) {
  return window.roamAlphaAPI.q(`[:find (pull ?page [:block/string])
                      :where [?page :block/uid "${uid}"]  ]`)[0][0].string;
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

export function updateBlock(uid, content, isOpen) {
  setTimeout(function () {
    window.roamAlphaAPI.updateBlock({
      block: { uid: uid, string: content, open: isOpen },
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
  if (blockContent.includes(after)) {
    let leftPart = blockContent.split(after)[0];
    if (leftPart.length > 0) {
      let splitted = leftPart.split(before);
      let length = splitted.length;
      if (length > 0) {
        let n = splitted[length - 1];
        if (!isNaN(n) && n != "") {
          number = parseInt(n);
          return number;
        }
        if (isNaN(number)) {
          return "NaN";
        }
      }
    }
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
