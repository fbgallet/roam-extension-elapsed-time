# Elapsed Time Calculator

Easily **track the time spent on your activities and calculate the total daily time spent on them**, organized by categories and sub-categories, and see if predefined **limits or goals** are respected. Helps to implement **interstitial journaling**.

⚠️ This extension works more easily in combination with `TimeStamp Buttons and elapsed time calculator` **SmartBlocks**. Once 'Smartblocks extension' from RoamDepot is installed, install 'TimeStamp Buttons and elapsed time calculator' from the SmartBlocks Store (open command palette with Ctrl-Cmd + P, then search for "SmartBlocks Store").

## Features

- **Elapsed time from now**: place your cursor anywhere in a block containing a timestamp and run `Elapsed time` from the command palette (Ctr/Cmd + P). Elapsed time from now, in minutes, will be automatically inserted after the first timestamp and now timestamp.

- **Elapsed time between to timestamps**: place your cursor anywhere in a block with two timestamps separeted by `-` (default, see above for user settings) and run `Elapsed time`: the number of minutes between the two timestamps will be inserted after them.

- **Total time**: place your cursor in a sibbling block or direct parent block of a set of blocks containing an elapsed time (calculated with the command mentioned above). Total time spent and, if categories have been specified, total per catetogies & sub-categories will be inserted.

- **Categories and sub-categories**: you can define a list of categories, used as trigger words for elapsed time calculation of an interval and for more details in the total calculation. Just write them in plain text **or mentioned as block reference** in a block where you want to measure the elapsed time on the correspoding task.

  - Each category can be subdivided in sub-categories (e.g. 'reading', subdivided in 'article' and 'book'). If a sub-categorie is mentionned in the current block, the time will also be added to the parent categorie in total calculation, and sub-categories can be dispayed or not in the total calculation.

  - (Advanced use of categories) A category can be duplicated as a sub-category of another category and be used as a more general 'tag' for timetracking. E.g., if 'deep work' is defined as a category, it can also be a subcategory of 'reading'. If, in a block, you mention 'deep work' alone, the corresponding time will be added only to the 'deep work' category. But if you mention 'deep work reading', it will be added both to 'deep work' category and 'deep work' sub-category of 'reading' (and to 'reading').

- **Goals and limits**: for each category or sub-category, you can define a goal (minimum to reach) or a limit (maximum not to exceed). Depending on whether the limit is respected or not, a flag (some defined icon, or text, or tag) will be inserted in the block, after elapsed time or total time spent. By default, a popup window will ask for confirmation before inserting the flag for the current task. It will be automatically applied in the total time blocks. Goals or limits can be defined both for an interval (elapsed time between two timestamps for a given task) or for the day (list of intervals in the current page).

## Configuration

- **Set your categories**: create anywhere in your graph a list of categories and, if needed, of sub-categories as children blocks of any given category. Copy the block reference of the direct parent block of this list in the corresponding field in the settings panel. Or run `Goals & limits setting template for Elapsed Time extension` and fill the template.

- **Set goals and limits**: create anywhere in your graph a list with the following structure, and copy (or Ctrl/Cmd + Drag&Drop) block references of categories/sub-categories under the desired durations. Then, copy the block reference of the direct parent block of this list in the corresponding field in the settings panel. Or run `Categories & subcategories setting template for Elapsed Time extension` SmartBlock, which will generate the appropriate template.

  - Parent block (block reference to copy in panel settings)
    - Goals
      - interval
        -10'
        - ((block reference of a category or subcategory))
        - ...
        - 20'
          - ((...))
          - ...
      - day
        - 60'
          - ((...))
        - ...
    - Limits
      [same kind of structure as for Goals]
      - interval
        - ...
      - day
        - ...

- Follow the instructions for other user settings directly in the settings panel above.

- **Use the extension in your workflow with Smartblocks**: You have to install `TimeStamp Buttons and elapsed time calculator` Smartblocks. Then:

  - Run `Day log - Elapsed time` in your daily template or **Copy/Paste** the following buttons:

    - `{{🕗↦:SmartBlock:Double timestamp buttons}}`: **in your daily template** for creating the **first timestamp**.

    - `{{Total 🕗:SmartBlock:Total time spent}}`: where you want calculate the **total time** spent during the day, **either in a sibling block** to the blocks containing the elapsed times, **or in their parent block**. You can also run `Total time button` to create this button in the right place.

  - You can copy and adapt the existing SmartBlocks to your needs (with a new name, otherwise they will be overwritten in case of update) or use `<%ELAPSEDTIME%>` and `<%TOTALTIME%>` commands in your own SmartBlocks.

---

For any question or suggestion, DM me on Twitter: [@fbgallet](https://twitter.com/fbgallet) or Roam Slack.
