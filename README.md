# Time Tracker (formerly Elapsed Time Calculator)

Easily **track the time spent on your activities and calculate the total time spent on them**, organized by categories and sub-categories (and so on), and see if predefined **limits or goals** are respected. Helps to implement **interstitial journaling**.

Review total by day, week, month, quarter, year, or any given period of time.

v.2 introduce a lot of new features, see [changelog here](https://github.com/fbgallet/roam-extension-elapsed-time/blob/main/CHANGELOG.md)

![Elapsed time demo](https://user-images.githubusercontent.com/74436347/184550335-ac5acde2-c9f9-459b-8e30-ec239abd7041.gif)


⚠️ This extension works more easily in combination with `TimeStamp Buttons and elapsed time calculator` **SmartBlocks**. See 'SmartBlocks commands' section below for instructions.

## Features and instructions

All commands in command palette (Ctrl/Cmd + p) begin with "Time tracker: " and you can set custom hotkeys for each of them.

### Elapsed time
Calculate and insert elapsed time between two timestamp. The `Elapsed time` command has different behaviors depending on the context:
  - if the current block contains a timestamp, a second timestamp (now) will be added and the elapsped time calculated and inserted just after the timestamps, in the format defined in the settings (by default: (**30'**) ),
  - if it contains already two timestamps, the elapsed time will be (re)calculated,
  - if there is no timestamp (or a Smartblock button for a timestamp), a timestamp (now) will be inserted,

💡 If you set hotkeys for this command, **it will very easy, with the same hotkeys**, to insert a first timestamp, then insert the second and get the elapsed time.

Another way to insert easily timestamps and run this command is to use SmartBlocks command. For instructions, see 'SmartBlocks commands' section below.

### Total time
Total is calculated as the sum of elapsed times (formated by Time tracker, not only double timestamps) and pomodoros. It is displayed in a customizable format (category: **30'**) and in a basic outline of blocks by default, but cat also be displayed in Roam {{table}} and is copied in the clipboard in a simple text format.

Total is calculated can be calculated in different range of data or periods, depending on the command used:
  - `total in the entire page, by categories`: total and subtotals are calculated by category. An elapsed time is added to one or more categories if they are in the same block or if a category (provided it is a reference page) is in a parent block (see "Categories, goals and limits configuration" for more information).
  - `total for current week/month/quarter/year`: only days of the current week (or other period) are taken into account, relative to the Daily Note from which the command is run. If the command isn't run in a Daily Note, the reference is the current day. So, if you want to calculate the total of the last week, you can simply run the command in the corresponding sunday Daily Note.
  - `total according to natural language expression in current block`: simply write in natural language a period of time to be taken into account, relative to the Daily Note where you write, and run the command while the correspond block is focused. Day, week, month, quarter and year are supported as period. If no period is specified, the default unit is the day. '15' calculate the total of the last 15 days. If you want to total of the two last month, you can just write 'two months'. Other examples: "previous week", "2 quarters", etc. Natural language recognition is currently very basic and doesn't recognize given date or date range, significant improvements could be made if requested by users.
  - `simple total in context (sibbling/children blocks)`: only total is calcultated (without taking into account the categories), only in a subset of the page:
    -  if the command is executed in a block with children, the calculation will be done on all children and their children,
    -  otherwise, it will concern the sibbling blocks and their children.
  - `total for current page and all its references`: if you don't need to include references of the current page, use the previous command. this command browses all linked references of the current page, not only those that directly contain an elapsed time, but also those that could contain it in their children (experimental, may not be always accurate).

For any of these commands, 
  - if the cursor is in a block without children, total and total by categories will be inserted here
  - if the cursor is in a block with children, total and total by categories will be inserted as the last children, and a block reference to the total will be inserted in the current block
  - if no block is selected, the total will be inserted as the last block of the page

## Categories, goals and limits configuration: 

If categories, and Goals & Limits blocks are not already defined, run `Time Tracker: Set categories list, goals & limits` to configure your categories. It will open `[[roam/depot/time tracker]]` in the sidebar and insert a template to help you to enter your own categories. You can define manually block reference for categories list, or goals & limits list. Once its defined, all change in the corresping blocks and children blocks will automatically be taken into account. No more refresh or SmartBlock button is needed (corresponding SmartBlocks command are deprecated).

### Categories and sub-categories
  - You can define a list of categories, used as trigger words for elapsed time calculation of an interval and for more details in the total calculation. A category can consist in any string of characters (case unsensitive), in page reference or block reference. To mention a category, just write it in plain text or mention them as block reference (so you can easily find the right category with block search) in a block where you want to measure the elapsed time on the correspoding task. If the category is a `[[page reference]]`, it will be applied to all elapsed times in the children blocks (unless anoter category is specified).
  - Each category can be subdivided in sub-categories (e.g. 'reading', subdivided in 'article' and 'book'), and so forth. If a sub-category is mentionned in a block, the time will also be added to the parent categorie in total calculation. Two subcategories of two different categories can have the same name, in this case you will have to specify both the category and the subcategory in order to refer to it properly
  - You can mention multiple categories in the same block, time will be added in all of them.

### Goals and limits
- For each category or sub-category, you can define a goal (minimum to reach) or a limit (maximum not to exceed). Depending on whether the limit is respected or not, a flag (by default, a set of icon but you can switch to color tags or customize your own flags) will be inserted in the block, after elapsed time or total time spent. By default, a popup window will ask for confirmation before inserting the flag for the current task. It will be automatically applied in the total time blocks. Goals or limits can be defined both for an interval (elapsed time between two timestamps for a given task) or for the day (list of intervals in the current page).
- To configure goal or limit, copy/paste the block reference of a given category as a child of a numeric indication of the correspond time, child of `/interval` or `/day` block.
- You can set a goal or a limit inline, only for the current block, with `min:` and `max:` keyword, followed by a number of minutes. Native pomodoro timer is also taken into account as a limit (maximum) time.

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

## SmartBlocks commands

SmartBlocks make it easier to insert timestamps and trigger totals calculations with easily configurable buttons that can be inserted into your own templates.

Once 'Smartblocks extension' from RoamDepot is installed, install 'TimeStamp Buttons and elapsed time calculator' from the SmartBlocks Store (open command palette with Ctrl-Cmd + P, then search for "SmartBlocks Store"). Then you can run a set of command to insert buttons or calcultate total on different period of time. The most useful for beginners is the following:

  - `Day log - Elapsed time`: run it in your daily template to be prompted cyclically to insert a new timestamp and to calculate an elapsed time. You can also Copy/Paste the following buttons in your template (or keep the templates you used with the previous version, which remains compatible)
    - `{{🕗↦:SmartBlock:Double timestamp buttons}}`: **in your daily template** for creating the **first timestamp**, which will allow to generate an indefinite number of intervals with a simple click.
    - `{{Total 🕗:SmartBlock:Total time spent}}`: where you want to calculate the **total time** spent during the day, **either in a sibling block** to the blocks containing the elapsed times, **or in their parent block**. You can also run `Total time button` to create this button in the right place.
    - `{{🕗:SmartBlock:Strict interstitial journaling}}`: use it you want that the end timestamp of a given time interval to be exactly the beginning of the next one
  - `<%TOTALTIME:period%>` is a SmartBlock command to calculate the total for a given period of time (day by default, week, month, quarter, year)
  - You can copy and adapt the existing SmartBlocks to your needs (with a new name, otherwise they will be overwritten in case of update) or use `<%ELAPSEDTIME%>` and `<%TOTALTIME%>` commands in your own SmartBlocks.

---

### For any question or suggestion, DM me on Twitter and follow me to be informed of updates and new extensions: [@fbgallet](https://twitter.com/fbgallet)

To report some issue, follow this [link on GitHub](https://github.com/fbgallet/roam-extension-elapsed-time/issues) and click on 'New issue'.
