# Elapsed Time Calculator

Easily **track the time spent on your activities and calculate the total daily time spent on them**, organized by categories and sub-categories, and see if predefined **limits or goals** are respected. Helps to implement **interstitial journaling**.

![Elapsed time demo](https://user-images.githubusercontent.com/74436347/184550335-ac5acde2-c9f9-459b-8e30-ec239abd7041.gif)


⚠️ This extension works more easily in combination with `TimeStamp Buttons and elapsed time calculator` **SmartBlocks**. Once 'Smartblocks extension' from RoamDepot is installed, install 'TimeStamp Buttons and elapsed time calculator' from the SmartBlocks Store (open command palette with Ctrl-Cmd + P, then search for "SmartBlocks Store").

## Features and instructions

- **Elapsed time from now**: place your cursor anywhere in a block containing a timestamp and run `Elapsed time` from the command palette (Ctr/Cmd + P). Timestamp from nom and elapsed time until now, in minutes, will be automatically inserted after the first timestamp.

- **Elapsed time between two timestamps**: place your cursor anywhere in a block with two timestamps separeted by `-` (default, see above for user settings) and run `Elapsed time`: the number of minutes between the two timestamps will be inserted after them. Or just click on a SmartBlock button, see below for configuration.

- **Total time**: place your cursor in a sibbling block or direct parent block of a set of blocks containing an elapsed time (calculated with the command mentioned above) and run `Total time` from the command palette. Total time spent will be inserted and, if categories have been specified, total per catetogies & sub-categories.

- **Categories and sub-categories**: you can define a list of categories, used as trigger words for elapsed time calculation of an interval and for more details in the total calculation. Just write them in plain text **or mention them as block reference** (so you can easily find the right category with block search) in a block where you want to measure the elapsed time on the correspoding task.

  - Each category can be subdivided in sub-categories (e.g. 'reading', subdivided in 'article' and 'book'). If a sub-categorie is mentionned in the current block, the time will also be added to the parent categorie in total calculation, and sub-categories can be dispayed or not in the total calculation.

  - (Advanced use of categories) You can mention multiple categories in the same block, time will be added in all of them. A category can also be duplicated as a sub-category of another category and be used as a more general 'tag' for timetracking. E.g., if 'deep work' is defined as a category, it can also be a subcategory of 'reading'. If, in a block, you mention 'deep work' alone, the corresponding time will be added only to the 'deep work' category. But if you mention 'deep work reading', it will be added both to 'deep work' category and 'deep work' sub-category of 'reading' (and to 'reading').

- **Goals and limits**: for each category or sub-category, you can define a goal (minimum to reach) or a limit (maximum not to exceed). Depending on whether the limit is respected or not, a flag (by default, a set of icon but you can switch to color tags or customize your own flags) will be inserted in the block, after elapsed time or total time spent. By default, a popup window will ask for confirmation before inserting the flag for the current task. It will be automatically applied in the total time blocks. Goals or limits can be defined both for an interval (elapsed time between two timestamps for a given task) or for the day (list of intervals in the current page). You can set a goal or a limit inline, only for the current block, with `min:` and `max:` keyword, followed by a number of minutes. Native pomodoro timer is also taken into account as a limit (maximum) time.

## Configuration

- **Set your categories**: create anywhere in your graph a list of categories and, if needed, of sub-categories as children blocks of any given category. Copy the block reference of the direct parent block of this list in the corresponding field in the settings panel. Or run `Goals & limits setting template for Elapsed Time extension`, fill the template and click on the button to update extension settings.

- **Set goals and limits**: create anywhere in your graph a list with the following structure, and copy (or Ctrl/Cmd + Drag&Drop) block references of categories/sub-categories under the desired durations. Then, copy the block reference of the direct parent block of this list in the corresponding field in the settings panel. Or run `Categories & subcategories setting template for Elapsed Time extension` SmartBlock, which will generate a template that you can complete, and where you will drag&drop the needed block references.

  ```
  - Parent block [copy its block reference in settings panel]
    - Goals
      - interval
        -10'
          - ((block reference of a category or subcategory))
          - ...
        - 20'
          - ((...))
      - day
        - 60'
          - ((...))
    - Limits
      [same kind of structure as for Goals]
      - interval
        - ...
      - day
        - ...
  ```

- Follow the instructions for other user settings directly in the settings panel above.

- **Use the extension in your workflow with Smartblocks**: You have to install `TimeStamp Buttons and elapsed time calculator` Smartblocks. Then:

  - Run `Day log - Elapsed time` in your daily template or **Copy/Paste** the following buttons (or keep the templates you used with the previous version, which remains compatible)

    - `{{🕗↦:SmartBlock:Double timestamp buttons}}`: **in your daily template** for creating the **first timestamp**, which will allow to generate an indefinite number of intervals with a simple click.

    - `{{Total 🕗:SmartBlock:Total time spent}}`: where you want to calculate the **total time** spent during the day, **either in a sibling block** to the blocks containing the elapsed times, **or in their parent block**. You can also run `Total time button` to create this button in the right place.

  - You can copy and adapt the existing SmartBlocks to your needs (with a new name, otherwise they will be overwritten in case of update) or use `<%ELAPSEDTIME%>` and `<%TOTALTIME%>` commands in your own SmartBlocks.

---

For any question or suggestion, DM me on Twitter: [@fbgallet](https://twitter.com/fbgallet) or Roam Slack.
