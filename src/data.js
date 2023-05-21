import { getCategories, getLimits } from ".";
import { simpleIziMessage } from "./elapsedTime";
import {
  addChildrenBlocks,
  addPullWatch,
  createBlock,
  getPageUidByPageName,
} from "./util";

export async function createSettingsPage(extensionAPI) {
  let pageUid = getPageUidByPageName("roam/depot/time tracker");
  if (!pageUid) {
    pageUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createPage({
      page: { title: "roam/depot/time tracker", uid: pageUid },
    });
  } else if (pageUid.children) {
    //TODO
    // récupérer les uids pertinents
    simpleIziMessage(
      "[[roam/depot/time tracker]] has aleready some content. If not defined, set block references to categories list and goals&limits list manually, in extension settings. Or delete the page to generate the config template again.",
      "red"
    );
    window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: { type: "block", "block-uid": pageUid },
    });
    return null;
  }
  let helpUid = await createBlock(
    pageUid,
    "How to set categories, goals and limits ?",
    true,
    true,
    0
  );
  createBlock(
    helpUid,
    "Simply write your categories below, in place of the examples, as plain text, or block ref, or page ref. You can add as many categories and levels of subcategories as you need."
  );
  createBlock(
    helpUid,
    "Copy/paste block ref or Ctrl+drag&drop a given category to a child block of any given goal or limit time. You can remove or add any duration as you need, in min' or h format."
  );
  createBlock(
    helpUid,
    "Changes are instantly taken into account, you do not need to refresh your graph."
  );
  //let settingsUid = await createBlock(pageUid, "User settings", true, 1, true);

  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: { type: "block", "block-uid": pageUid },
  });
  return pageUid;
}

export async function createCategoriesBlock(parentUid, extensionAPI) {
  let titleUid = await createBlock(
    parentUid,
    "**Categories** for Time tracker",
    true,
    true
  );
  let exA = await createBlock(titleUid, "Reading", true, true, 0);
  createBlock(exA, "Book");
  createBlock(exA, "Article");
  createBlock(titleUid, "Write");
  addPullWatch(titleUid, getCategories);
  extensionAPI.settings.set("categoriesSetting", titleUid);
  return titleUid;
}
export async function createLimitsBlock(parentUid, extensionAPI) {
  let titleUid = await createBlock(
    parentUid,
    "**Goals & Limits** for Time tracker",
    true,
    true
  );
  let goalUid = await createBlock(
    titleUid,
    "🎯 Goals (minimum to reach)",
    true,
    false
  );
  let limitUid = await createBlock(
    titleUid,
    "🛑 Limits (maximum not to exceed)",
    true,
    false
  );
  addIntervalByPeriod(goalUid);
  addIntervalByPeriod(limitUid);
  addPullWatch(titleUid, getLimits);
  extensionAPI.settings.set("limitsSetting", titleUid);
  return titleUid;

  async function addIntervalByPeriod(uid) {
    let periodsUid = await addChildrenBlocks(
      uid,
      ["/interval", "/day", "/week", "/month"],
      true
    );
    //console.log(periodsUid);
    if (periodsUid)
      periodsUid.forEach((period, index) => {
        switch (index) {
          case 0:
            addChildrenBlocks(period, ["15'", "30'", "45'", "1h", "1h30"]);
            break;
          case 1:
            addChildrenBlocks(period, ["30'", "45'", "1h", "2h", "3h"]);
            break;
          case 2:
            addChildrenBlocks(period, ["1h", "2h", "4h", "8h"]);
            break;
          case 3:
            addChildrenBlocks(period, ["1h", "4h", "8h", "20h", "100h"]);
        }
      });
  }
}
