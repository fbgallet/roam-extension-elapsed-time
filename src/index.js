import { displayTotalTimesTable } from "./components";
import { elapsedTime } from "./elapsedTime";
import {
  displayTotalByPeriod,
  extractDailyLog,
  getTotalTimeForCurrentPage,
  getTotalTimeFromPreviousDays,
  totalTime,
} from "./totalTime";
import {
  escapeCharacters,
  getChildrenTree,
  getRegexFromArray,
  getStringsAroundPlaceHolder,
  normalizeUID,
} from "./util";

/************************* PANEL SETTINGS VAR **************************/
var categoriesUID, limitsUID, flagsDropdown, customFlags;
export var confirmPopup,
  displaySubCat,
  limitFlag,
  defaultTimeLimit,
  totalTitle,
  intervalSeparator = " - ",
  durationFormat,
  durationRegex,
  splittedDurationFormat,
  totalFormat,
  limitFormat;
export const limitFlagDefault = {
  task: {
    goal: { success: "🎯", failure: "⚠️" },
    limit: { success: "👍", failure: "🛑" },
  },
  day: {
    goal: { success: "🎯", failure: "⚠️" },
    limit: { success: "👍", failure: "🛑" },
  },
};

const TYPE = {
  text: "text",
  pageRef: "pageRef",
  blockRef: "blockRef",
};

export var categoriesArray = [];
export var categoriesNames = [];
export var categoriesRegex;

class Category {
  constructor(s, uid, l, f, parent = null) {
    this.name = s;
    this.uid = uid;
    this.display = true;
    this.type = this.getType(s);
    this.limit = { type: "undefined", task: 0, day: 0 };
    this.time = 0;
    this.format = f;
    this.children = [];
    this.parent = parent;
  }
  addChildren(s, u, l, f) {
    return this.children.push(new Category(s, u, l, f));
  }
  getOnlyWord(s) {
    s = s.split("{")[0];
    return s.trim();
    //return s;
  }
  getLimitByInterval(interval) {
    return [this.limit[interval], this.limit.type];
  }
  getType(name) {
    const uidRegex = /^\(\([^\)]{9}\)\)$/g;
    const pageRegex = /^\[\[.*\]\]$/g; // very simplified, not recursive...
    if (uidRegex.test(name)) return TYPE.blockRef;
    if (pageRegex.test(name)) return TYPE.pageRef;
    else return TYPE.text;
  }
  setLimit(type, interval, time) {
    this.limit.type = type;
    this.limit[interval] = time;
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
  hasChildrenWithName(name) {
    return this.children.find((child) => child.name === name) != undefined;
  }
  getChildrenWithName(name) {
    return this.children.find((child) => child.name === name);
  }
}

/*======================================================================================================*/
/* LOAD EXTENSION AND GET SETTINGS */
/*======================================================================================================*/

function getParameters() {
  if (categoriesUID != null) getCategories(normalizeUID(categoriesUID));
  if (limitsUID != null) getLimits(normalizeUID(limitsUID));
  switch (flagsDropdown) {
    case "Color block tags (green/red)":
      limitFlag = getLimitFlags("Tags");
      break;
    case "Customized":
      limitFlag = getLimitFlags("Customized", customFlags);
      break;
    default:
      limitFlag = getLimitFlags("Icons");
  }
}

export function scanCategories(s, refs, callBack, once) {
  let result = [];
  let hasCat = false;
  let tag = "";
  s = s.toLowerCase();
  categoriesArray.forEach((cat, i) => {
    if (refs.includes(cat.uid) || s.includes(cat.name.toLowerCase())) {
      result = callBack(cat, i, -1, result);
      hasCat = true;
      if (once) return result;
    }
    if (cat.children) {
      cat.children.forEach((subCat, j) => {
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
      });
      hasCat = false;
    }
  });
  if (result.length == 0) return callBack(null, -1, -1);
  return result;
}

function getCategories(parentUid) {
  categoriesArray = [];
  let triggerTree = getChildrenTree(parentUid);

  if (triggerTree) {
    for (let i = 0; i < triggerTree.length; i++) {
      let w = triggerTree[i];
      let hide = false;
      if (w.string.includes("{hide}")) {
        hide = true;
        w.string = w.string.replace("{hide}", "");
      }
      let topTrigger = new Category(w.string, w.uid, null, "");
      categoriesArray.push(topTrigger);
      if (w.children) {
        getSubCategories(w.children, topTrigger, hide);
      }
    }
    categoriesNames = categoriesArray.map((trigger) => trigger.name);
    categoriesRegex = getRegexFromArray(categoriesNames);
  }
  console.log(categoriesArray);
  console.log(categoriesNames);

  function getSubCategories(tree, topTrigger, hideTop) {
    for (let j = 0; j < tree.length; j++) {
      let hideSub = false;
      let t = tree[j].string;
      if (t.includes("{hide}")) {
        t = t.replace("{hide}", "");
        hideSub = true;
      }
      let format = "";
      //supTrigger.addChildren(t, w.children[j].uid, "", format);
      let subTrigger = new Category(t, tree[j].uid, "", format, topTrigger);
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

function getLimits(uid) {
  let tree = getChildrenTree(uid);
  if (tree) {
    tree.forEach((limitType) => {
      if (limitType.string.toLowerCase().includes("goal")) {
        getLimitsInterval("goal", limitType.children);
      } else if (limitType.string.toLowerCase().includes("limit")) {
        getLimitsInterval("limit", limitType.children);
      }
    });
  }
}

function getLimitsInterval(type, tree) {
  if (tree) {
    tree.forEach((limitInterval) => {
      let content = limitInterval.string.toLowerCase();
      if (content.includes("day")) {
        getLimitsByTypeAndInterval(type, "day", limitInterval.children);
      } else if (content.includes("interval")) {
        getLimitsByTypeAndInterval(type, "task", limitInterval.children);
      }
    });
  }
}

function getLimitsByTypeAndInterval(type, interval, tree) {
  if (tree) {
    tree.forEach((limitDuration) => {
      if (limitDuration.children) {
        let duration = limitDuration.string.replace(/[^0-9]+/g, "");
        if (!isNaN(duration)) {
          limitDuration.children.forEach((catRef) => {
            let tw = categoriesArray.find(
              (item) => item.uid === catRef.string.slice(2, -2)
            );
            if (tw == undefined)
              tw = searchSubCatByUidOrWord(catRef.string.slice(2, -2), "uid");
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

function getLimitFlags(type, input = "") {
  let goalS, goalF, limitS, limitF;
  if (type == "Icons") return limitFlagDefault;
  if (type == "Tags") {
    goalS = "#.good-time";
    goalF = "#.insufficient-time";
    limitS = "#.good-time";
    limitF = "#.exceeded-time";
  }
  if (type == "Customized") {
    if (input === "") return limitFlagDefault;
    let splitInput = input.split(",");
    if (!(splitInput.length === 2 || splitInput.length === 4))
      return limitFlagDefault;
    if (splitInput.length == 2) {
      goalS = splitInput[0];
      limitS = splitInput[0];
      goalF = splitInput[1];
      limitF = splitInput[1];
    } else {
      goalS = splitInput[0];
      goalF = splitInput[1];
      limitS = splitInput[2];
      limitF = splitInput[3];
    }
  }
  return (limitFlag = {
    task: {
      goal: { success: goalS, failure: goalF },
      limit: { success: limitS, failure: limitF },
    },
    day: {
      goal: { success: goalS, failure: goalF },
      limit: { success: limitS, failure: limitF },
    },
  });
}

function setDurationRegex() {
  durationRegex = new RegExp(
    `${escapeCharacters(splittedDurationFormat[0])}([0-9]*)${escapeCharacters(
      splittedDurationFormat[1]
    )}`
  );
  console.log(durationRegex);
}

function registerPaletteCommands() {
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Elapsed time",
    callback: () => {
      const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      elapsedTime(startUid);
    },
  });
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Total time today",
    callback: () => {
      const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      totalTime(startUid);
    },
  });
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Total time 7 last days",
    callback: async () => {
      const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      let total = await getTotalTimeFromPreviousDays(null, 7);
      displayTotalByPeriod(startUid, total, "last 7 days");
    },
  });
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Total time table",
    callback: async () => {
      let total = await getTotalTimeFromPreviousDays(null, 31);
      displayTotalTimesTable();
    },
  });
}

function registerSmartblocksCommands(extensionAPI) {
  const panel = extensionAPI;
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
  const updCatCmd = {
    text: "UPDATECATSFORET",
    help: "Update categories/subcategories and parent block reference for Elapsed Time extension. 1. Block reference of the parent block.",
    handler: (context) => () => {
      categoriesUID = context.variables.triggerUID;
      panel.settings.set("categoriesSetting", categoriesUID);
      getCategories(normalizeUID(categoriesUID));
      return "";
    },
  };
  const updLimCmd = {
    text: "UPDATELIMITSFORET",
    help: "Update Goals/Limits and parent block reference for Elapsed Time extension. 1. Block reference of the parent block.",
    handler: (context) => () => {
      limitsUID = context.variables.triggerUID;
      panel.settings.set("limitsSetting", limitsUID);
      getLimits(normalizeUID(limitsUID));
      return "";
    },
  };
  if (window.roamjs?.extension?.smartblocks) {
    window.roamjs.extension.smartblocks.registerCommand(elapCmd);
    window.roamjs.extension.smartblocks.registerCommand(totalCmd);
    window.roamjs.extension.smartblocks.registerCommand(updCatCmd);
    window.roamjs.extension.smartblocks.registerCommand(updLimCmd);
  } else {
    document.body.addEventListener(`roamjs:smartblocks:loaded`, () => {
      window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(elapCmd);
      window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(totalCmd);
      window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(updCatCmd);
      window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(updLimCmd);
    });
  }
}

function correctUidInput(uid) {
  if (uid.length != 9 || uid.length == 13) {
    return normalizeUID(uid);
  } else {
    console.log(
      "CategoriesUID has to be a valid block reference, with or without brackets."
    );
    return null;
  }
}

const panelConfig = {
  tabTitle: "Elapsed time calculator",
  settings: [
    {
      id: "categoriesSetting",
      name: "Categories",
      description:
        "Parent block reference where your categories and subcategories are listed:",
      action: {
        type: "input",
        onChange: (evt) => {
          categoriesUID = correctUidInput(evt.target.value);
          if (categoriesUID != null) getCategories(categoriesUID);
        },
      },
    },
    {
      id: "limitsSetting",
      name: "Goals and Limits",
      description:
        "Parent block reference where your goals and limits are set:",
      action: {
        type: "input",
        onChange: (evt) => {
          limitsUID = correctUidInput(evt.target.value);
          if (limitsUID != null) getLimits(limitsUID);
        },
      },
    },
    {
      id: "flagsDropdown",
      name: "Predefined Flags",
      description:
        "Choose a set of predefined flags or choose 'Customized' and fill the input filed below:",
      action: {
        type: "select",
        items: ["🎯,⚠️,👍,🛑", "Color block tags (green/red)", "Customized"],
        onChange: (evt) => {
          if (evt == "Color block tags (green/red)")
            limitFlag = getLimitFlags("Tags");
          else {
            if (evt == "🎯,⚠️,👍,🛑") limitFlag = getLimitFlags("Icons");
            else limitFlag = getLimitFlags("Customized", customFlags);
          }
        },
      },
    },
    {
      id: "flagsSetting",
      name: "Customized Flags",
      description:
        "Set flags to insert, separated by a comma: goal reached or not, (and optionally) limit respected or exceeded:",
      action: {
        type: "input",
        placeholder: "goal-success,goal-fail [,limit-success,limit-fail]",
        onChange: (evt) => {
          customFlags = evt.target.value;
          if (customFlags.includes(","))
            limitFlag = getLimitFlags("Customized", customFlags);
          else {
            limitFlag = limitFlagDefault;
          }
        },
      },
    },
    {
      id: "displaySetting",
      name: "Display subcategories",
      description: "Display subcategories in Total time per day",
      action: {
        type: "switch",
        onChange: () => {
          displaySubCat = !displaySubCat;
        },
      },
    },
    {
      id: "popupSetting",
      name: "Display confirmation popup",
      description:
        "Ask for confirmation before applying a flag to the current block (automatic if disable):",
      action: {
        type: "switch",
        onChange: () => {
          confirmPopup = !confirmPopup;
        },
      },
    },
    {
      id: "defaultTimeSetting",
      name: "Default alert time",
      description:
        "Time limit (in minutes) beyond which an alert & confirmation popup (if enabled) will appear if no limit is defined for the block (default: 90)",
      action: {
        type: "input",
        placeholder: "90",
        onChange: (evt) => {
          if (!isNaN(evt.target.value))
            defaultTimeLimit = parseInt(evt.target.value);
        },
      },
    },
    {
      id: "intervalSetting",
      name: "Interval separator",
      description:
        "Characters to insert between two timestamps to specify an interval (don't forget the spaces if required):",
      action: {
        type: "input",
        onChange: (evt) => {
          intervalSeparator = evt.target.value;
        },
      },
    },
    {
      id: "durationSetting",
      name: "Elapsed time format for an interval",
      description:
        "Format to emphasize the elapsed time, <d> being the required placeholder for the elapsed time value:",
      action: {
        type: "input",
        onChange: (evt) => {
          if (evt.target.value.includes("<d>"))
            durationFormat = evt.target.value;
          splittedDurationFormat = getStringsAroundPlaceHolder(
            durationFormat,
            "<d>"
          );
          setDurationRegex();
        },
      },
    },
    {
      id: "totalTitleSetting",
      name: "Total parent block format",
      description:
        "Format of the 'Total time' parent block, <th> being the required placeholder for the total time value:",
      action: {
        type: "input",
        onChange: (evt) => {
          if (evt.target.value.includes("<th>")) totalTitle = evt.target.value;
        },
      },
    },
    {
      id: "totalCatSetting",
      name: "Total per category format",
      description:
        "Format of each category's 'Total time'. Placeholders: <th> for total time, <category> and <limit> for limit format defined below:",
      action: {
        type: "input",
        onChange: (evt) => {
          if (
            evt.target.value.includes("<th>") &&
            evt.target.value.includes("<category>")
          )
            totalFormat = evt.target.value;
        },
      },
    },
    {
      id: "limitFormatSetting",
      name: "Limit per category format",
      description:
        "Format of the limit display for each category. Placeholders: <flag> for limit flag, <type> for 'Goal' or 'Limit', <value> for predefined limit value:",
      action: {
        type: "input",
        onChange: (evt) => {
          limitFormat = evt.target.value;
        },
      },
    },
  ],
};

export default {
  onload: ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);
    categoriesUID = extensionAPI.settings.get("categoriesSetting");
    limitsUID = extensionAPI.settings.get("limitsSetting");
    if (extensionAPI.settings.get("displaySetting") == null)
      extensionAPI.settings.set("button-setting", true);
    displaySubCat = extensionAPI.settings.get("displaySetting");
    if (extensionAPI.settings.get("flagsDropdown") == null)
      extensionAPI.settings.set("flagsDropdown", "🎯,⚠️,👍,🛑");
    flagsDropdown = extensionAPI.settings.get("flagsDropdown");
    if (extensionAPI.settings.get("flagsSetting") == null)
      extensionAPI.settings.set("flagsSetting", "");
    customFlags = extensionAPI.settings.get("flagsSetting");
    if (extensionAPI.settings.get("popupSetting") == null)
      extensionAPI.settings.set("popupSetting", true);
    confirmPopup = extensionAPI.settings.get("popupSetting");
    if (extensionAPI.settings.get("defaultTimeSetting") == null)
      extensionAPI.settings.set("defaultTimeSetting", 90);
    defaultTimeLimit = extensionAPI.settings.get("defaultTimeSetting");
    if (extensionAPI.settings.get("intervalimeSetting") == null)
      extensionAPI.settings.set("intervalSetting", " - ");
    intervalSeparator = extensionAPI.settings.get("intervalSetting");
    if (extensionAPI.settings.get("durationSetting") == null)
      extensionAPI.settings.set("durationSetting", "(**<d>'**)");
    durationFormat = extensionAPI.settings.get("durationSetting");
    splittedDurationFormat = getStringsAroundPlaceHolder(durationFormat, "<d>");
    setDurationRegex();
    if (extensionAPI.settings.get("totalTitleSetting") == null)
      extensionAPI.settings.set("totalTitleSetting", "Total time: **(<th>)**");
    totalTitle = extensionAPI.settings.get("totalTitleSetting");
    if (extensionAPI.settings.get("totalCatSetting") == null)
      extensionAPI.settings.set(
        "totalCatSetting",
        "<category>: **(<th>)** <limit>"
      );
    totalFormat = extensionAPI.settings.get("totalCatSetting");
    if (extensionAPI.settings.get("limitFormatSetting") == null)
      extensionAPI.settings.set(
        "limitFormatSetting",
        "<flag> (<type>: <value>')"
      );
    limitFormat = extensionAPI.settings.get("limitFormatSetting");

    registerPaletteCommands();
    registerSmartblocksCommands(extensionAPI);
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
  },
};
