# Time Tracker (formerly Elapsed Time Calculator)

Easily **track the time spent on your activities and calculate the total time spent on them**, organized by categories and sub-categories (and so on), and see if predefined **limits or goals** are respected. Helps to implement **interstitial journaling**.

Review total by day, week, month, quarter, year, or any given period of time.

see [changelog here](https://github.com/fbgallet/roam-extension-elapsed-time/blob/main/CHANGELOG.md)

![Elapsed time demo](https://user-images.githubusercontent.com/74436347/184550335-ac5acde2-c9f9-459b-8e30-ec239abd7041.gif)

### More comprehensive demo and small tutorial videos in [this Twitter/X thread](https://twitter.com/fbgallet/status/1668969876050829312).

## Features and instructions

All commands in command palette (Ctrl/Cmd + p) begin with "Time tracker: " and you can set custom hotkeys for each of them.

### Elapsed time

Calculate and insert elapsed time between two timestamp. The `Elapsed time` command has different behaviors depending on the context:

- if the current block contains a timestamp, a second timestamp (now) will be added and the elapsped time calculated and inserted just after the timestamps, in the format defined in the settings (by default: (**30'**) ),
- if it contains already two timestamps, the elapsed time will be (re)calculated,
- if there is no timestamp (or a Smartblock button for a timestamp), a timestamp (now) will be inserted,

💡 If you set hotkeys for this command, **it will very easy, with the same hotkeys**, to insert a first timestamp, then insert the second and get the elapsed time.

💥 with `Remote elapsed time` enabled (by default), if there is no timestamp in current block, a timestamp to be completed with a second one is searched in the previous sibbling block. So that the elapsed time will be calculated in the remote block. The now timestamp will also be inserted in the current block. This way, you need to press the hotkeys only one time to both calculate previous elapsed time and set the begin timestamp for the next activity, which makes interstitial journaling as seamless as possible.

Another way to insert easily timestamps and run this command is to use SmartBlocks command. For instructions, see 'SmartBlocks commands' section below.

If categories and limits/goals have been set, and if you have mentionned a category in the current block, a popup will appear at the bottom indicating if the limit/goal has been reached or exceeded. By pressing the 'Too much' or 'Not enough' button (selected by default), the corresponding flag will be inserted into the block, right after the elapsed time.

The flags are customizable (🎯,⚠️,👍,🛑 by default), you can change the icon and add a `<diff>` placeholder to insert the time difference with the limit or goal. For example, if the limit for Mail was 15' and the elapsed time is 25', `🛑+10` will be inserted.

### Total time

Total is calculated as the sum of elapsed times (⚠️ formated by Time tracker, double timestamps without calculated elapsed time are not taken into account!) and pomodoros (if no elapsed time in the block, and whether or not they have been completed). 🆕 New in v.4: Embedded blocks can optionally be taken into account (not if the orginal blocks are on the same page as the embeds).

It is displayed in a customizable format (ex: `category: **30'**` with time expressed in minutes with `<tm>` placeholder, or hours and minutes with `<th>` or decimal hours with `<td>`). All totals and subtotals will be displayed in a basic outline of blocks by default, but cat also be displayed in Roam {{table}} and is copied in the clipboard in a simple text format. A development envisaged for a later version is to propose a dynamic table and a graphic visualization of the data.

Total can be calculated in different range of data or periods, depending on the command used:

- `total for current day or page`: total and subtotals are calculated by category. An elapsed time is added to one or more categories if they are in the same block or if a category is in an ancestor block (see "Categories, goals and limits configuration" for more information).
  💥 Just enter 'day' in the command palette to get the command.
- `total for current week/month/quarter/year`: only days of the current week (or other period) are taken into account, relative to the Daily Note from which the command is run. If the command isn't run in a Daily Note, the reference is the current day. So, if you want to calculate the total of the last week, you can simply run the command in the corresponding sunday Daily Note.
- `total according to natural language expression in current block`: simply write in natural language a period of time to be taken into account, relative to the Daily Note where you write, and run the command while the correspond block is focused. Day, week, month, quarter and year are supported as period. If no period is specified, the default unit is the day. '15' calculate the total of the last 15 days. If you want to total of the two last month, you can just write 'two months'. Other examples: "previous week", "2 quarters", etc. Natural language recognition is currently very basic and doesn't recognize given date or date range, significant improvements could be made if requested by users.
- `simple total in context (sibbling/children blocks)`: only total is calcultated (without taking into account the categories), only in a subset of the page:
  - if the command is executed in a block with children, the calculation will be done on all children and their children,
  - otherwise, it will concern the sibbling blocks and their children.
- `total for current page and all its references`: if you don't need to include references of the current page, use the previous command. This command browses all linked references of the current page, not only those that directly contain an elapsed time, but also those that could contain it in their children (experimental, may not be always accurate).
- 🆕 New in v.4 `total for current page and all its references`: browses all children and all linked references of the focused block, not only those that directly contain an elapsed time, but also those that could contain it in their children (warning: a given elapsed time can be added twice if it's a children of another linked reference of the same block)

For any of these commands,

- if the cursor is in a block without children, total and total by categories will be inserted here
- if the cursor is in a block with children, total and total by categories will be inserted as the last children, and a block reference to the total will be inserted in the current block
- if no block is selected, the total will be inserted as the last block of the page

## Categories, goals and limits configuration:

If categories, and Goals & Limits blocks are not already defined, run `Time Tracker: Set categories list, goals & limits` to configure your categories. It will open `[[roam/depot/time tracker]]` in the sidebar and insert a template to help you to enter your own categories. You can paste manually the block reference of your categories list, or goals & limits list. Once its defined, all change in the corresping blocks and children blocks will automatically be taken into account. No more refresh or SmartBlock button is needed (corresponding SmartBlocks command are deprecated).

### Categories and sub-categories

- You can define a list of categories, used as trigger words for elapsed time calculation of an interval and for more details in the total calculation. A category can consist in any string of characters (case unsensitive), or any page reference or block reference. To mention a category, just write it in plain text or mention it as block reference (so you can easily find the right category with block search) in a block where you want to measure the elapsed time on the correspoding task. 🆕 New in v.4: page references will be recognized regardless of how they are written: `[[page]]`, `#page` or `#[[page]]`.
- Each category can be subdivided in sub-categories (e.g. 'reading', subdivided in 'article' and 'book'), and so forth. If a sub-category is mentionned in a block, the time will also be added to the parent category in total calculation. Two subcategories of two different categories can have the same name, in this case you will have to specify both the category and the subcategory in order to refer to it properly
- You can mention multiple categories in the same block, time will be added in all of them but only once in their common ancestor, if they have one.

### Goals and limits

- For each category or sub-category, you can define a goal (minimum to reach) or a limit (maximum not to exceed). Depending on whether the limit is respected or not, a flag (by default, a set of icon but you can switch to color tags or customize your own flags) will be inserted in the block, after elapsed time or total time spent. By default, a popup window will ask for confirmation before inserting the flag for the current task. It will be automatically applied in the total time blocks. Goals or limits can be defined both for an interval (elapsed time between two timestamps for a given task) or for a period: day, week or month.
- To configure goal or limit, copy/paste the block reference of a given category as a child of a numeric indication of the correspond time, child of `/interval` or `/day` block. Duration can be written in minutes (e.g.: 30') or in hours (e.g.: 2h30)
- You can set a goal or a limit inline, only for the current block, with `min:` and `max:` keyword, followed by a number of minutes. Native pomodoro timer is also taken into account as a limit (maximum) time.

## SmartBlocks commands

SmartBlocks make it easier to insert timestamps and trigger totals calculations with easily configurable buttons that can be inserted into your own templates.

Once 'Smartblocks extension' from RoamDepot is installed, copy [the SmartBlocks shared in this graph](https://roamresearch.com/#/app/Roam-En-Francais/page/Y0FgJscNZ) (since RoamJS SmartBlocks store in no more available) anywhere in your. Then you can run a set of command to insert buttons or calcultate total on different period of time. The most useful for beginners is the following:

- `Day log - Elapsed time`: run it in your daily template to be prompted cyclically to insert a new timestamp and to calculate an elapsed time. You can also Copy/Paste the following buttons in your template (or keep the templates you used with the previous version, which remains compatible)
  - `{{🕗↦:SmartBlock:Double timestamp buttons}}`: **in your daily template** for creating the **first timestamp**, which will allow to generate an indefinite number of intervals with a simple click.
  - `{{Total 🕗:SmartBlock:Total time spent}}`: where you want to calculate the **total time** spent during the day, **either in a sibling block** to the blocks containing the elapsed times, **or in their parent block**. You can also run `Total time button` to create this button in the right place.
  - `{{🕗:SmartBlock:Strict interstitial journaling}}`: use it you want that the end timestamp of a given time interval to be exactly the beginning of the next one

You can copy and adapt the existing SmartBlocks to your needs (with a new name, otherwise they will be overwritten in case of update)

### SmartBlocks commands to insert in your own SmartBlocks:

- `<%ELAPSEDTIME:separator%>`: run the same command as `Time tracker: Elapsed time`, but you can specify the separator between the time interval and the rest of the block. For example, if you want to use `|` separator, the command will be: `<%ELAPSEDTIME:|%>`
- `<%TOTALTIME:period,as table,categories%>` is a SmartBlock command to calculate the total for a given period of time (day by default, week, month, quarter, year). By default, total is displayed as blocks, with categories subtotals. For example, if you want to display the total for the current week as a table with all categories, the command will be: `<%TOTALTIME:week,true,true%>`
- or use and `<%TOTALTIME%>` commands in your own SmartBlocks.

---

### For any question or suggestion, DM me on Twitter and follow me to be informed of updates and new extensions: [@fbgallet](https://twitter.com/fbgallet)

To report some issue, follow this [link on GitHub](https://github.com/fbgallet/roam-extension-elapsed-time/issues) and click on 'New issue'.
