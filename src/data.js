import { getCategories, getLimits } from ".";
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
  } else {
    //TODO
    // récupérer les uids pertinents
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
    "Simply write your categories below, as plain text, or block ref, or page ref. You can add as many categories and levels of subcategories as you need."
  );
  createBlock(
    helpUid,
    "Copy/paste block ref of categories in children of any given goal or limit time. You can add any duration as you need."
  );
  //let settingsUid = await createBlock(pageUid, "User settings", true, 1, true);

  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: { type: "block", "block-uid": pageUid },
  });
  extensionAPI.ui.commandPalette.removeCommand({
    label: "Elapsed time: Set categories list, goals & limits",
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
    let periodsUid = await addChildrenBlocks(uid, ["/interval", "/day"], true);
    console.log(periodsUid);
    if (periodsUid)
      periodsUid.forEach((period) =>
        addChildrenBlocks(period, ["15'", "30'", "45'", "60'"])
      );
  }
}
