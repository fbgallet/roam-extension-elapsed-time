import { getCategories } from "./categories";
import { simpleIziMessage } from "./notify";
import {
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
    simpleIziMessage(
      "[[roam/depot/time tracker]] already has some content. If the categories block reference is not set, set it manually in extension settings, or delete the page to generate a fresh template.",
      "red",
    );
    window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: { type: "block", "block-uid": pageUid },
    });
    return null;
  }
  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: { type: "block", "block-uid": pageUid },
  });
  return pageUid;
}

export async function createCategoriesBlock(parentUid, extensionAPI) {
  let titleUid = await createBlock(
    parentUid,
    "**Categories** for Time tracker {{Time Tracker/Manage categories}}",
    true,
    true,
  );
  let exA = await createBlock(titleUid, "Reading", true, true, 0);
  createBlock(exA, "Book");
  createBlock(exA, "Article");
  createBlock(titleUid, "Write");
  extensionAPI.settings.set("categoriesSetting", titleUid);
  return titleUid;
}
