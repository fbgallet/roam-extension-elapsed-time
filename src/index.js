//import { displayTotalTimesTable } from "./components";
import {
  createCategoriesBlock,
  createLimitsBlock,
  createSettingsPage,
} from "./data";
import { elapsedTime, simpleIziMessage } from "./elapsedTime";
import {
  getTotalTimeForCurrentPage,
  totalTime,
  totalTimeForGivenPeriod,
} from "./totalTime";
import {
  addPullWatch,
  escapeCharacters,
  getBlockAttributes,
  getChildrenTree,
  getCurrentBlockUidOrCreateIt,
  getPageUidByAnyBlockUid,
  getRegexFromArray,
  getStringsAroundPlaceHolder,
  normalizeUID,
  removePullWatch,
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
  limitFormat,
  autoCopyTotalToClipboard,
  displayTotalAsTable,
  remoteElapsedTime,
  includePomodoros;
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
  resetLimit() {
    this.limit.type = "undefined";
    this.limit.task = 0;
    this.limit.day = 0;
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
      let topTrigger = new Category(w.string, w.uid, null, "");
      categoriesArray.push(topTrigger);
      if (w.children) {
        getSubCategories(w.children, topTrigger, hide);
      }
    }
    categoriesNames = categoriesArray.map((trigger) => trigger.name);
    categoriesRegex = getRegexFromArray(categoriesNames);
  } else {
    categoriesArray.length = 0;
    categoriesNames.length = 0;
    categoriesRegex = null;
  }
  //console.log(categoriesArray);
  //console.log(categoriesNames);

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

export function getLimits(uid) {
  let tree = uid ? getChildrenTree(uid) : null;
  if (tree) {
    tree.forEach((limitType) => {
      if (limitType.string.toLowerCase().includes("goal")) {
        getLimitsInterval("goal", limitType.children);
      } else if (limitType.string.toLowerCase().includes("limit")) {
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
}

function registerPaletteCommands(extensionAPI) {
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Elapsed time in current block",
    callback: () => {
      const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      elapsedTime(startUid);
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Total for current day or page",
    callback: async () => {
      let startUid = await getCurrentBlockUidOrCreateIt();
      setTimeout(() => {
        let scopeUid = getPageUidByAnyBlockUid(startUid);
        totalTime(startUid, scopeUid);
      }, 50);
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: simple Total in context (sibbling/children blocks)",
    callback: () => {
      const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      totalTime(startUid, startUid, false);
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Total for current week",
    callback: async () => {
      totalTimeForGivenPeriod("week");
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Total for current month",
    callback: async () => {
      totalTimeForGivenPeriod("month");
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Total for current quarter",
    callback: async () => {
      totalTimeForGivenPeriod("quarter");
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Total for current year",
    callback: async () => {
      totalTimeForGivenPeriod("year");
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label:
      "Time Tracker: Total according to natural language expression in current block",
    callback: () => {
      const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      if (!startUid) return;
      totalTimeForGivenPeriod(null, startUid);
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Total for current page and all its references",
    callback: () => {
      let startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      // setTimeout(() => {
      let scopeUid = getPageUidByAnyBlockUid(startUid);
      getTotalTimeForCurrentPage(startUid, scopeUid);
      // }, 50);
    },
  });

  // TODO
  //
  // extensionAPI.ui.commandPalette.addCommand({
  //   label: "Time Tracker: Total time in table",
  //   callback: async () => {
  //     let total = await getTotalTimeFromPreviousDays(null, 31);
  //     displayTotalTimesTable();
  //   },
  // });

  if (getBlockAttributes(categoriesUID)) {
    addOpenCategoriesAndLimitsCommands(extensionAPI);
  } else {
    addOpenSettingsCommand(extensionAPI);
  }
}

function addOpenSettingsCommand(extensionAPI) {
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Set categories list, goals & limits",
    callback: async () => {
      if (normalizeUID(categoriesUID) || normalizeUID(limitsUID)) {
        simpleIziMessage(
          "Categories block reference and/or Goals&Limits block reference are already defined, open extension settings to change them.",
          "red"
        );
        return;
      }
      let pageUid = await createSettingsPage(extensionAPI);
      if (!pageUid) return;
      categoriesUID = await createCategoriesBlock(pageUid, extensionAPI);
      limitsUID = await createLimitsBlock(pageUid, extensionAPI);
      addOpenCategoriesAndLimitsCommands(extensionAPI);
    },
  });
}

function addOpenCategoriesAndLimitsCommands(
  extensionAPI,
  catUid = categoriesUID,
  limitUid = limitsUID
) {
  updateOpenCategoriesCommand(extensionAPI, catUid);
  updateOpenLimitsCommand(extensionAPI, limitUid);
  removeOpenSettingsCommand(extensionAPI);
}

function updateOpenCategoriesCommand(extensionAPI, catUid = categoriesUID) {
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Open categories list in sidebar",
    callback: async () => {
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "block", "block-uid": catUid },
      });
    },
  });
}
function updateOpenLimitsCommand(extensionAPI, limitsUid = limitsUID) {
  extensionAPI.ui.commandPalette.addCommand({
    label: "Time Tracker: Open goals & limits in sidebar",
    callback: async () => {
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "block", "block-uid": limitsUid },
      });
    },
  });
}

function removeOpenSettingsCommand(extensionAPI) {
  extensionAPI.ui.commandPalette.removeCommand({
    label: "Time Tracker: Set categories list, goals & limits",
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
    help:
      "Calcul total elapsed time in current page (by default)." +
      "\n- First argument (optional): period (week, month, quarter or year)." +
      "\n- Second argument (optional): if true, return only total, without categories.",
    handler:
      (context) =>
      async (period = null, byCategories = true) => {
        //period = context.variables.period;
        if (!period)
          totalTime(
            context.targetUid,
            await getPageUidByAnyBlockUid(context.targetUid),
            byCategories === false ? false : true
          );
        else totalTimeForGivenPeriod(period, context.targetUid);
        return "";
      },
  };
  // const updCatCmd = {
  //   text: "UPDATECATSFORET",
  //   help: "Update categories/subcategories and parent block reference for Elapsed Time extension. 1. Block reference of the parent block.",
  //   handler: (context) => () => {
  //     categoriesUID = context.variables.triggerUID;
  //     panel.settings.set("categoriesSetting", categoriesUID);
  //     getCategories(normalizeUID(categoriesUID));
  //     return "";
  //   },
  // };
  // const updLimCmd = {
  //   text: "UPDATELIMITSFORET",
  //   help: "Update Goals/Limits and parent block reference for Elapsed Time extension. 1. Block reference of the parent block.",
  //   handler: (context) => () => {
  //     limitsUID = context.variables.triggerUID;
  //     panel.settings.set("limitsSetting", limitsUID);
  //     getLimits(normalizeUID(limitsUID));
  //     return "";
  //   },
  // };

  if (window.roamjs?.extension?.smartblocks) {
    window.roamjs.extension.smartblocks.registerCommand(elapCmd);
    window.roamjs.extension.smartblocks.registerCommand(totalCmd);
    // window.roamjs.extension.smartblocks.registerCommand(updCatCmd);
    // window.roamjs.extension.smartblocks.registerCommand(updLimCmd);
  } else {
    document.body.addEventListener(`roamjs:smartblocks:loaded`, () => {
      window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(elapCmd);
      window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(totalCmd);
      // window.roamjs?.extension.smartblocks &&
      //   window.roamjs.extension.smartblocks.registerCommand(updCatCmd);
      // window.roamjs?.extension.smartblocks &&
      //   window.roamjs.extension.smartblocks.registerCommand(updLimCmd);
    });
  }
}

function correctUidInput(uid) {
  if (uid.length == 9 || uid.length == 13) {
    return normalizeUID(uid);
  } else {
    simpleIziMessage(
      "Categories or Goals & Limits reference has to be a valid block reference, with or without brackets.",
      "red"
    );
    return null;
  }
}

export default {
  onload: ({ extensionAPI }) => {
    const panelConfig = {
      tabTitle: "Time Tracker",
      settings: [
        {
          id: "remoteTime",
          name: "Remote elapsed time",
          description:
            "When running Elapsed time command, search for a timestamp in the previous sibbling block and calculate corresponding elapsed time before inserting a timestamp in current block:",
          action: {
            type: "switch",
            onChange: () => {
              remoteElapsedTime = !remoteElapsedTime;
            },
          },
        },
        {
          id: "displayTotalSetting",
          name: "Display total mode",
          description:
            "Display inline total as blocks outline or as Roam {{table}}",
          action: {
            type: "select",
            items: ["blocks", "table"],
            onChange: (sel) => {
              sel === "blocks"
                ? (displayTotalAsTable = false)
                : (displayTotalAsTable = true);
            },
          },
        },
        {
          id: "displaySetting",
          name: "Display subcategories",
          description: "Display subcategories in Total",
          action: {
            type: "switch",
            onChange: () => {
              displaySubCat = !displaySubCat;
            },
          },
        },
        {
          id: "pomodoros",
          name: "Pomodoros",
          description: "Take pomodoros into account in total calculation:",
          action: {
            type: "switch",
            onChange: () => {
              includePomodoros = !includePomodoros;
            },
          },
        },
        {
          id: "autoCopyToClipboard",
          name: "Copy total to clipboard",
          description:
            "Automatically copy simple total time table to clipboard when displaying total:",
          action: {
            type: "switch",
            onChange: (evt) => {
              autoCopyTotalToClipboard = !autoCopyTotalToClipboard;
            },
          },
        },
        {
          id: "categoriesSetting",
          name: "Categories",
          description:
            "Parent block reference where your categories and subcategories are listed:",
          action: {
            type: "input",
            onChange: (evt) => {
              categoriesUID = correctUidInput(evt.target.value);
              if (!categoriesUID) addOpenSettingsCommand(extensionAPI);
              else addOpenCategoriesAndLimitsCommands(extensionAPI);
              getCategories(categoriesUID);
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
              if (limitsUID != null)
                addOpenCategoriesAndLimitsCommands(extensionAPI);
              if (!limitsUID && !categoriesUID)
                addOpenSettingsCommand(extensionAPI);
              getLimits(limitsUID);
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
            items: [
              "🎯,⚠️,👍,🛑",
              "Color block tags (green/red)",
              "Customized",
            ],
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
            "Format of the 'Total time' parent block, use <th> (time in hour) or <tm> (time in minutes) placeholder:",
          action: {
            type: "input",
            onChange: (evt) => {
              if (evt.target.value.includes("<th>"))
                totalTitle = evt.target.value;
            },
          },
        },
        {
          id: "totalCatSetting",
          name: "Total per category format",
          description:
            "Format of each category's 'Total time'. Placeholders: <th> or <tm> for total time, <category> and <limit> for limit format defined below:",
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
    extensionAPI.settings.panel.create(panelConfig);
    if (extensionAPI.settings.get("remoteTime") == null)
      extensionAPI.settings.set("remoteTime", true);
    remoteElapsedTime = extensionAPI.settings.get("remoteTime");
    if (extensionAPI.settings.get("pomodoros") == null)
      extensionAPI.settings.set("pomodoros", true);
    includePomodoros = extensionAPI.settings.get("pomodoros");
    categoriesUID = normalizeUID(
      extensionAPI.settings.get("categoriesSetting")
    );
    if (categoriesUID)
      getBlockAttributes(categoriesUID)
        ? addPullWatch(categoriesUID, getCategories)
        : extensionAPI.settings.set("categoriesSetting", undefined);
    limitsUID = normalizeUID(extensionAPI.settings.get("limitsSetting"));
    if (limitsUID)
      getBlockAttributes(limitsUID)
        ? addPullWatch(limitsUID, getLimits)
        : extensionAPI.settings.set("limitsSetting", undefined);
    if (extensionAPI.settings.get("displayTotalSetting") == null)
      extensionAPI.settings.set("displayTotalSetting", "blocks");
    extensionAPI.settings.get("displayTotalSetting") === "blocks"
      ? (displayTotalAsTable = false)
      : (displayTotalAsTable = true);
    if (extensionAPI.settings.get("displaySetting") == null)
      extensionAPI.settings.set("displaySetting", true);
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
      extensionAPI.settings.set("totalTitleSetting", "Total time: **<th>**");
    totalTitle = extensionAPI.settings.get("totalTitleSetting");
    if (extensionAPI.settings.get("totalCatSetting") == null)
      extensionAPI.settings.set(
        "totalCatSetting",
        "<category>: **<th>** <limit>"
      );
    totalFormat = extensionAPI.settings.get("totalCatSetting");
    if (extensionAPI.settings.get("limitFormatSetting") == null)
      extensionAPI.settings.set(
        "limitFormatSetting",
        "<flag> (<type>: <value>')"
      );
    limitFormat = extensionAPI.settings.get("limitFormatSetting");
    if (extensionAPI.settings.get("autoCopyToClipboard") == null)
      extensionAPI.settings.set("autoCopyToClipboard", true);
    autoCopyTotalToClipboard = extensionAPI.settings.get("autoCopyToClipboard");

    registerPaletteCommands(extensionAPI);
    registerSmartblocksCommands(extensionAPI);
    getParameters();
    console.log("Elapsed Time Calculator loaded.");
  },
  onunload: () => {
    console.log("Elapsed Time Calculator unloaded.");
    if (categoriesUID) removePullWatch(categoriesUID, getCategories);
    if (limitsUID) removePullWatch(limitsUID, getLimits);
  },
};
