import {
  convertStringDurationToMinutes,
  getChildrenTree,
  getLonguestPageTitleFromUids,
  getRegexFromArray,
} from "./util";

/************************* CATEGORIES STATE **************************/
export let categoriesArray = [];
export let categoriesNames = [];
export let categoriesAsRef = [];
export let categoriesRegex;

const TYPE = {
  text: "text",
  pageRef: "pageRef",
  blockRef: "blockRef",
};

export class Category {
  constructor(s, uid, refs, f, parent = null) {
    this.name = s.trim();
    this.uid = uid;
    this.display = true;
    this.type = this.getType(s.trim());
    this.limit = { type: "undefined", task: 0, day: 0 };
    this.time = 0;
    this.format = f;
    this.children = [];
    this.parent = parent;
    this.ref =
      this.type === "pageRef"
        ? refs.length === 1
          ? refs[0]["uid"]
          : // in case of nested page title, get the longest (wrapping the other)
            getLonguestPageTitleFromUids(refs.map((ref) => ref.uid))
        : null;
  }
  addChildren(s, u, r, f) {
    return this.children.push(new Category(s, u, r, f));
  }
  getOnlyWord(s) {
    s = s.split("{")[0];
    return s.trim();
  }
  getLimitByInterval(interval) {
    return [this.limit[interval], this.limit.type];
  }
  getType(name) {
    const uidRegex = /^\(\([^\)]{9}\)\)$/g;
    const pageOrTagRegex = /^#?(\[\[.*\]\])$|^#[^\s]+$/g;
    if (uidRegex.test(name)) return TYPE.blockRef;
    if (pageOrTagRegex.test(name)) return TYPE.pageRef;
    else return TYPE.text;
  }
  setLimit(type, interval, time) {
    this.limit.type = type;
    this.limit[interval] = time;
  }
  resetLimit() {
    this.limit.type = "undefined";
    this.limit.task = 0;
    this.limit.day = 0;
    this.limit.week = 0;
    this.limit.month = 0;
  }
  addTime(time) {
    this.time += time;
    if (this.parent) this.parent.addTime(time);
  }
  addChildrenTime() {
    this.children.forEach((child) => {
      child.addChildrenTime();
      this.time += child.time;
    });
  }
  isParentOf(tw) {
    if (this.children.filter((child) => tw.uid === child.uid).length != 0)
      return true;
    else return false;
  }
  isAncestorOf(tw) {
    let isAncestor = this.isParentOf(tw);
    if (!isAncestor) {
      isAncestor =
        this.children.length &&
        this.children.some((child) => child.isAncestorOf(tw));
    }
    return isAncestor;
  }
  hasSameAncestor(tw) {
    let hasSameAncestor = this.parent?.isAncestorOf(tw);
    if (!hasSameAncestor && this.parent?.parent)
      hasSameAncestor = this.parent.hasSameAncestor(tw);
    return hasSameAncestor;
  }
  hasChildrenWithName(name) {
    return this.children.find((child) => child.name === name) != undefined;
  }
  getChildrenWithName(name) {
    return this.children.find((child) => child.name === name);
  }
}

/*======================================================================================================*/
/* CATEGORIES */
/*======================================================================================================*/

export function scanCategories(s, refs, callBack, once) {
  let result = [];
  let hasCat = false;
  let tag = "";
  s = s.toLowerCase();
  for (let i = 0; i < categoriesArray.length; i++) {
    const cat = categoriesArray[i];
    if (refs.includes(cat.uid) || s.includes(cat.name.toLowerCase())) {
      result = callBack(cat, i, -1, result);
      hasCat = true;
      if (once) return result;
    }
    if (cat.children) {
      for (let j = 0; j < cat.children.length; j++) {
        const subCat = cat.children[j];
        if (
          refs.includes(subCat.uid) ||
          s.includes(subCat.name.toLowerCase())
        ) {
          result = callBack(
            subCat,
            i,
            j,
            result,
            hasCat,
            tag,
            subCat.name.toLowerCase()
          );
          if (once) return result;
          tag = subCat.name.toLowerCase();
        }
      }
      hasCat = false;
    }
  }
  if (result.length == 0) return callBack(null, -1, -1);
  return result;
}

export function getCategories(parentUid) {
  categoriesArray.length = 0;
  categoriesNames.length = 0;
  let triggerTree = parentUid ? getChildrenTree(parentUid) : null;

  if (triggerTree) {
    for (let i = 0; i < triggerTree.length; i++) {
      let w = triggerTree[i];
      let hide = false;
      if (w.string.includes("{hide}")) {
        hide = true;
        w.string = w.string.replace("{hide}", "");
      }
      let topTrigger = new Category(w.string, w.uid, w.refs, "");
      categoriesArray.push(topTrigger);
      if (w.children) {
        getSubCategories(w.children, topTrigger, hide);
      }
    }
    categoriesNames = categoriesArray
      .filter((cat) => cat.type !== "pageRef")
      .map((cat) => cat.name);
    categoriesRegex = getRegexFromArray(categoriesNames);
    categoriesAsRef = categoriesArray
      .filter((cat) => cat.type === "pageRef")
      .map((cat) => cat.ref);
  } else {
    categoriesArray.length = 0;
    categoriesNames.length = 0;
    categoriesRegex = null;
  }

  function getSubCategories(tree, topTrigger, hideTop) {
    for (let j = 0; j < tree.length; j++) {
      let hideSub = false;
      let t = tree[j].string;
      if (t.includes("{hide}")) {
        t = t.replace("{hide}", "");
        hideSub = true;
      }
      let format = "";
      let subTrigger = new Category(
        t,
        tree[j].uid,
        tree[j].refs,
        format,
        topTrigger
      );
      topTrigger.children.push(subTrigger);
      categoriesArray.push(subTrigger);
      if (hideTop || hideSub) {
        topTrigger.children[topTrigger.children.length - 1].display = false;
      }
      if (tree[j].children)
        getSubCategories(tree[j].children, subTrigger, hideSub);
    }
  }
}

/*======================================================================================================*/
/* LIMITS */
/*======================================================================================================*/

export function getLimits(uid) {
  let tree = uid ? getChildrenTree(uid) : null;
  if (tree) {
    tree.forEach((limitType) => {
      if (limitType.string?.toLowerCase().includes("goal")) {
        getLimitsInterval("goal", limitType.children);
      } else if (limitType.string?.toLowerCase().includes("limit")) {
        getLimitsInterval("limit", limitType.children);
      }
    });
  } else resetLimits();
}

function resetLimits() {
  categoriesArray.forEach((cat) => cat.resetLimit());
}

function getLimitsInterval(type, tree) {
  if (tree) {
    tree.forEach((limitInterval) => {
      let content = limitInterval.string?.toLowerCase();
      if (limitInterval.children) {
        if (content.includes("day")) {
          getLimitsByTypeAndInterval(type, "day", limitInterval.children);
        } else if (content.includes("interval")) {
          getLimitsByTypeAndInterval(type, "task", limitInterval.children);
        } else if (content.includes("week")) {
          getLimitsByTypeAndInterval(type, "week", limitInterval.children);
        } else if (content.includes("month")) {
          getLimitsByTypeAndInterval(type, "month", limitInterval.children);
        }
      }
    });
  }
}

function getLimitsByTypeAndInterval(type, interval, tree) {
  if (tree) {
    tree.forEach((limitDuration) => {
      if (limitDuration.children) {
        let duration = limitDuration.string
          ? convertStringDurationToMinutes(limitDuration.string)
          : undefined;
        if (!isNaN(duration)) {
          limitDuration.children.forEach((catRef) => {
            let tw = categoriesArray.find(
              (item) => item.uid === catRef.string?.slice(2, -2)
            );
            if (tw == undefined)
              tw = searchSubCatByUidOrWord(catRef.string?.slice(2, -2), "uid");
            if (tw != null && tw != undefined)
              tw.setLimit(type, interval, parseInt(duration));
          });
        }
      }
    });
  }
}

function searchSubCatByUidOrWord(value, attr) {
  for (let i = 0; i < categoriesArray.length; i++) {
    let subCat = categoriesArray[i].children;
    if (subCat) {
      let tw = subCat.find((item) => item[attr] === value);
      if (tw != undefined) {
        return tw;
      }
    }
  }
  return null;
}
