import {
  autoCopyTotalToClipboard,
  displaySubCat,
  limitFlag,
  limitFormat,
  totalFormat,
  totalTitle,
} from ".";
import { categoriesArray } from "./categories";
import { simpleIziMessage } from "./notify";
import {
  convertMinutesToDecimals,
  convertMinutesTohhmm,
  getBlockContent,
  simpleCreateBlock,
  simulateClick,
} from "./util";
import { getOutputForClipboard, getUncategorized, setOutputForClipboard } from "./totalTime";

let titleIsRef = true; // Trigger words are inserted as block references in Total display

/*========================================================================*/
// OUTPUT CLASS
/*========================================================================*/

export class Output {
  constructor(s, n, t = 0, l = null) {
    this.text = s;
    this.name = n;
    this.time = t;
    this.limit = l;
    this.children = [];
  }

  setChildren(child) {
    this.children = child;
  }
  addChild(child) {
    this.children.push(child);
  }
  getText() {
    return this.text;
  }
}

/*========================================================================*/
// FORMATTING
/*========================================================================*/

export function getDifferenceWithLimit(time, limit) {
  let diffToDisplay = "";
  let diff = time - limit;
  if (diff && diff !== 0)
    diff > 0
      ? (diffToDisplay = `+${convertMinutesTohhmm(diff)}`)
      : (diffToDisplay = `${convertMinutesTohhmm(diff)}`);
  return diffToDisplay;
}

function displayLimit(w, period = "day") {
  let parts = [];
  // Display goal flag
  if (w.limit?.goal?.[period] > 0) {
    let flag, comp;
    if (w.time >= w.limit.goal[period]) {
      flag = limitFlag.day.goal.success;
      comp = ">=";
    } else {
      flag = limitFlag.day.goal.failure;
      comp = "<";
    }
    let diffToDisplay = getDifferenceWithLimit(w.time, w.limit.goal[period]);
    parts.push(
      limitFormat
        .replace("<type>", "goal")
        .replace("<value>", convertMinutesTohhmm(w.limit.goal[period]))
        .replace("<flag>", flag)
        .replace("<comp>", comp)
        .replace("<diff>", diffToDisplay)
    );
  }
  // Display limit flag
  if (w.limit?.limit?.[period] > 0) {
    let flag, comp;
    if (w.time <= w.limit.limit[period]) {
      flag = limitFlag.day.limit.success;
      comp = "<=";
    } else {
      flag = limitFlag.day.limit.failure;
      comp = ">";
    }
    let diffToDisplay = getDifferenceWithLimit(w.time, w.limit.limit[period]);
    parts.push(
      limitFormat
        .replace("<type>", "limit")
        .replace("<value>", convertMinutesTohhmm(w.limit.limit[period]))
        .replace("<flag>", flag)
        .replace("<comp>", comp)
        .replace("<diff>", diffToDisplay)
    );
  }
  return parts.join(" ");
}

function formatDisplayTime(
  w,
  title,
  period = "day",
  formatTag = "",
  hide = false
) {
  let t;
  let l = "";
  const uncategorized = getUncategorized();
  if (w !== null) {
    t = w.time;
    l = displayLimit(w, period);
  } else t = uncategorized;
  let totalTitleToReturn = totalTitle;
  if (title == "") {
    return totalTitle
      .replace("<tm>", t.toString())
      .replace("<th>", convertMinutesTohhmm(t))
      .replace("<td>", convertMinutesToDecimals(t));
  } else if (title.includes("period:")) {
    let matchingPeriodPlaceholder = totalTitle.match(/\[.*<period>.*\]/g);
    if (matchingPeriodPlaceholder)
      if (totalTitle.includes("<period>") && matchingPeriodPlaceholder) {
        if (!isNaN(period)) {
          totalTitleToReturn = totalTitleToReturn.replace(
            matchingPeriodPlaceholder[0],
            title.split("period:")[1]
          );
        } else
          totalTitleToReturn = totalTitle.replace(
            matchingPeriodPlaceholder[0],
            matchingPeriodPlaceholder[0].slice(1, -1)
          );
      }
    return totalTitleToReturn
      .replace("<period>", period)
      .replace("<tm>", t.toString())
      .replace("<td>", convertMinutesToDecimals(t))
      .replace("<th>", convertMinutesTohhmm(t));
  }
  if (hide) return title;
  return (
    totalFormat
      .replace("<category>", title)
      .replace("<tm>", t.toString())
      .replace("<th>", convertMinutesTohhmm(t))
      .replace("<td>", convertMinutesToDecimals(t))
      .replace("<limit>", l)
      .trim() +
    " " +
    formatTag
  );
}

/*========================================================================*/
// BUILDING OUTPUT TREE
/*========================================================================*/

export function getTotalTimeOutput(total, period = "day", simple) {
  const uncategorized = getUncategorized();
  let periodToDisplay;
  if (period && isNaN(period)) {
    if (!period.includes("last")) periodToDisplay = `period: ${period}`;
    else periodToDisplay = `period: ${period}`;
  } else if (period && !isNaN(period))
    periodToDisplay = "period: since " + period + " days";
  else periodToDisplay = "";
  let totalOutput = new Output(null);
  if (simple) {
    totalOutput.text = formatDisplayTime({ time: total }, periodToDisplay, period);
    totalOutput.time = total;
    return totalOutput;
  }
  let parentCategories = categoriesArray.filter((cat) => !cat.parent && !cat.isTag);
  parentCategories.forEach((parent) => {
    setCategoryOutput(parent, totalOutput, period);
  });
  if (uncategorized !== 0)
    totalOutput.addChild(
      new Output(
        formatDisplayTime(null, "__Uncategorized__"),
        "Uncategorized",
        uncategorized
      )
    );
  // Tag categories (transversal) — displayed after regular categories, informational only
  let tags = categoriesArray.filter((cat) => cat.isTag && cat.time !== 0);
  tags.forEach((tag) => {
    let title = tag.name;
    if (tag.type === "pageRef") title += " ";
    let formatedTagTotal = formatDisplayTime(tag, title, period, "", false);
    totalOutput.addChild(new Output(formatedTagTotal, title, tag.time));
  });
  if (total === 0) {
    total =
      parentCategories.reduce((sum, cat) => sum + cat.time, 0) + uncategorized;
  }
  let displayTotal = formatDisplayTime({ time: total }, periodToDisplay, period);
  totalOutput.time = total;
  totalOutput.text = displayTotal;
  return totalOutput;
}

function setCategoryOutput(category, parentOutput, period = "day") {
  if (category.time !== 0) {
    let title;
    if (titleIsRef && category.type === "text") {
      title = "((" + category.uid + "))";
    } else {
      title = category.name;
      // space needed to not insert ':' in the tag name
      if (category.type === "pageRef") title += " ";
    }
    let hideTime =
      displaySubCat &&
      category.children &&
      category.children.filter((cat) => cat.time !== 0).length === 1 &&
      category.children.filter((cat) => cat.time !== 0)[0].time ===
        category.time
        ? true
        : false;
    let formatedCatTotal = formatDisplayTime(
      category,
      title,
      period,
      category.format,
      hideTime
    );
    let output = new Output(
      formatedCatTotal,
      title,
      category.time,
      displayLimit(category, period)
    );
    parentOutput.addChild(output);
    if (displaySubCat && category.children) {
      category.children.forEach((child) =>
        setCategoryOutput(child, output, period)
      );
    }
  }
}

/*========================================================================*/
// INSERTING INTO ROAM
/*========================================================================*/

export function prepareTotalTimeInsersion(uid, value, position = -1) {
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

export function insertTotalTimeByCategory(uid, output, isSub = false) {
  for (let i = 0; i < output.children.length; i++) {
    if (output.children[i] != undefined) {
      let catUid = window.roamAlphaAPI.util.generateUID();
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": uid, order: i },
        block: { uid: catUid, string: output.children[i].getText() },
      });
      if (output.children[i].children.length != 0)
        insertTotalTimeByCategory(catUid, output.children[i], true);
    }
  }
  return;
}

export function insertTableOfTotalByCategory(
  output,
  parentUid,
  shift = "",
  order = "last"
) {
  if (order == 0) {
    let tableComponent = output.time === 0 ? "" : "\n{{table}}";
    window.roamAlphaAPI.updateBlock({
      block: {
        uid: parentUid,
        string: output.text + tableComponent,
        open: false,
      },
    });
    order = "last";
    setTimeout(() => {
      simulateClick(document.querySelector(".roam-article"));
    }, 100);
  }
  if (output.children.length > 0)
    output.children.forEach((cat) => {
      let format = shift === "" ? "**" : "";
      let nameUid = window.roamAlphaAPI.util.generateUID();
      simpleCreateBlock(parentUid, nameUid, format + shift + cat.name + format);
      let timeUid = window.roamAlphaAPI.util.generateUID();
      let time = totalFormat.includes("<th>")
        ? convertMinutesTohhmm(cat.time)
        : totalFormat.includes("<td>")
        ? convertMinutesToDecimals(cat.time)
        : cat.time.toString();
      simpleCreateBlock(nameUid, timeUid, format + time + format);
      if (cat.limit) {
        simpleCreateBlock(timeUid, null, cat.limit);
      }
      if (cat.children.length > 0) {
        insertTableOfTotalByCategory(cat, parentUid, shift + "   ");
      }
    });
}

function getListOfTotalByCategory(categories, shift = "") {
  categories.forEach((cat) => {
    if (cat.time !== 0) {
      let time = totalFormat.includes("<td>")
        ? convertMinutesToDecimals(cat.time)
        : cat.time;
      setOutputForClipboard(
        getOutputForClipboard() + shift + cat.name + "\t" + time + "\n"
      );
    }
    if (cat.time !== 0 && cat.children != undefined) {
      getListOfTotalByCategory(cat.children, shift + "   ");
    }
  });
}

export function copyTotalToClipboard() {
  if (autoCopyTotalToClipboard) {
    const uncategorized = getUncategorized();
    const filteredCatArray = categoriesArray.filter((cat) => !cat.parent && !cat.isTag);
    if (uncategorized)
      filteredCatArray.push({ name: "Uncategorized", time: uncategorized });
    const tagCats = categoriesArray.filter((cat) => cat.isTag && cat.time !== 0);
    if (tagCats.length)
      filteredCatArray.push(...tagCats.map((t) => ({ name: t.name, time: t.time })));
    getListOfTotalByCategory(filteredCatArray);
    navigator.clipboard.writeText(getOutputForClipboard());
    simpleIziMessage(
      "Total times copied to clipboard in a simple table, easy to export."
    );
  }
}
