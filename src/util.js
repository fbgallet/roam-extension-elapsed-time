export function getTreeByPageTitle(pageTitle) {
  return window.roamAlphaAPI.q(`[:find ?uid ?s 
							   :where [?b :node/title "${pageTitle}"]
									  [?b :block/children ?cuid]
									  [?cuid :block/uid ?uid]
									  [?cuid :block/string ?s]]`);
}

export function getChildrenTree(uid) {
  if (uid)
    return window.roamAlphaAPI.q(`[:find (pull ?page
                     [:block/uid :block/string :block/children 
                        {:block/children ...} ])
                      :where [?page :block/uid "${uid}"]  ]`)[0][0].children;
  else return null;
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

export function addZero(i) {
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}
