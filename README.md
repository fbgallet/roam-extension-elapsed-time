# Time Tracker (formerly Elapsed Time Calculator)

Easily **track the time spent on your activities and calculate the total time spent on them**, organized by categories and sub-categories (and so on), and see if predefined **limits or goals** are respected. Helps to implement **interstitial journaling**.

Review total by day, week, month, quarter, year, or any given period of time. Visualize trends over time with the built-in **Time Dashboard**.

🆕 in v.5 (March 2026)

- Dashboard to visualize Totals and Trends
- Category manager dialog box
- Category autocomplete picker with /Time tracker slash command

see [changelog here](https://github.com/fbgallet/roam-extension-elapsed-time/blob/main/CHANGELOG.md)

![Time Tracker short demo v 5 bis](https://github.com/user-attachments/assets/98821747-a3f4-473d-a0a4-4d7b2c31d969)

## Features and instructions

All commands in command palette (Ctrl/Cmd + p) begin with "Time tracker: " and you can set custom hotkeys for each of them.

A `/Time tracker` **slash command** is also available directly in any block — type `/tra` to quickly trigger it and insert a timestamp or calculate elapsed time without leaving the editor.

### Elapsed time

Calculate and insert elapsed time between two timestamp. The `Elapsed time` command has different behaviors depending on the context:

- if the current block contains a timestamp, a second timestamp (now) will be added and the elapsped time calculated and inserted just after the timestamps, in the format defined in the settings (by default: (**30'**) ),
- if it contains already two timestamps, the elapsed time will be (re)calculated,
- if there is no timestamp (or a Smartblock button for a timestamp), a timestamp (now) will be inserted,

If you set hotkeys for this command, **it will be very easy, with the same hotkeys**, to insert a first timestamp, then insert the second and get the elapsed time.

> [!TIP]
> 💥 with `Remote elapsed time` enabled (by default), if there is no timestamp in current block, a timestamp to be completed with a second one is searched in the previous sibbling block.
> So that the elapsed time will be calculated in the remote block. The now timestamp will also be inserted in the current block.
> This way, you need to use the '/tra' slash command or to press the hotkeys only one time to both calculate previous elapsed time and set the begin timestamp for the next activity, which makes interstitial journaling as seamless as possible!

Another way to insert easily timestamps and run this command is to use SmartBlocks command. For instructions, see 'SmartBlocks commands' section below.

### Category autocomplete picker

After inserting a timestamp (or just after elapsed time is calculated), a **category picker popover** automatically appears below the active block. It lists all your configured categories and tags so you can insert one without typing it manually:

- **Type** to filter the list in real time — characters are matched against category names and aliases. The popover closes automatically if no match is found.
- **↑ / ↓** to navigate, **Enter** or **Tab** to confirm the highlighted category, **Escape** to dismiss.
- **Click** any item to insert it immediately.
- Subcategories are shown indented under their parent. Task **goal** and **limit** badges are displayed next to each entry for quick reference.
- The selected category is inserted intelligently: after a single timestamp, after elapsed time, or replacing the filter characters you already typed.
- If the block already had elapsed time calculated, the limits/goals are **recomputed** automatically after insertion.
- An **⚙ Open Categories manager** shortcut at the top of the list lets you jump directly to the manager dialog.

You can also open the picker at any time with the command palette command `Time Tracker: Choose category` (a block must be focused).

If categories and limits/goals have been set, and if you have mentionned a category in the current block, a popup will appear at the bottom indicating if the limit/goal has been reached or exceeded. By pressing the 'Too much' or 'Not enough' button (selected by default), the corresponding flag will be inserted into the block, right after the elapsed time.

The flags are customizable (🎯,⚠️,👍,🛑 by default), you can change the icon and add a `<diff>` placeholder to insert the time difference with the limit or goal. For example, if the limit for Mail was 15' and the elapsed time is 25', `🛑+10` will be inserted.

### Total time

Total is calculated as the sum of elapsed times (⚠️ formated by Time tracker, double timestamps without calculated elapsed time are not taken into account!) and pomodoros (if no elapsed time in the block, and whether or not they have been completed). Embedded blocks can optionally be taken into account (not if the orginal blocks are on the same page as the embeds).

The easiest way to explore totals is by opening the new Dashboard (see below), but you can still insert totals inline. It is displayed in a customizable format (ex: `category: **30'**` with time expressed in minutes with `<tm>` placeholder, or hours and minutes with `<th>` or decimal hours with `<td>`). All totals and subtotals will be displayed in a basic outline of blocks by default, but can also be displayed in Roam {{table}} and is copied in the clipboard in a simple text format.

Total can be calculated in different range of data or periods, depending on the command used:

- `total for current day or page`: total and subtotals are calculated by category. An elapsed time is added to one or more categories if they are in the same block or if a category is in an ancestor block (see "Categories, goals and limits configuration" for more information). For other periods, use the next command or the Dashboard.
  💥 Just enter 'day' in the command palette to get the command.
- `total according to natural language expression in current block`: simply write in natural language a period of time to be taken into account, relative to the Daily Note where you write, and run the command while the correspond block is focused. Day, week, month, quarter and year are supported as period. If no period is specified, the default unit is the day. '15' calculate the total of the last 15 days. If you want to total of the two last month, you can just write 'two months'. Other examples: "previous week", "2 quarters", etc.
- `simple total in context (sibbling/children blocks)`: only total is calcultated (without taking into account the categories), only in a subset of the page:
  - if the command is executed in a block with children, the calculation will be done on all children and their children,
  - otherwise, it will concern the sibbling blocks and their children.
- `total for current page and all its references`: browses all linked references of the current page, not only those that directly contain an elapsed time, but also those that could contain it in their children (experimental, may not be always accurate).
- `total for current block and all its references`: browses all children and all linked references of the focused block (warning: a given elapsed time can be added twice if it's a children of another linked reference of the same block).

For any of these commands,

- if the cursor is in a block without children, total and total by categories will be inserted here
- if the cursor is in a block with children, total and total by categories will be inserted as the last children, and a block reference to the total will be inserted in the current block
- if no block is selected, the total will be inserted as the last block of the page

## 🆕 Dashboard (Totals & Trends)

The **Time Tracker Dashboard** is an interactive dialog that gives you a visual overview of your tracked time. Open it with the command `Time Tracker: Open Dashboard (Totals & Trends)` or via the `{{Time Tracker/Total dashboard}}` button (see below).

### Modes: Daily Notes vs Page

The dashboard operates in two modes, switchable via the toggle buttons in the header:

- **Daily Notes mode** (default) — surveys all your daily note pages over the selected period. This is the standard view for reviewing how you spent your time across days.
- **Page mode** — scopes all data to a specific Roam page and its block references. Use the page picker that appears at the top to select any page. This is useful for project-centric views, e.g. to see all time tracked under `[[My Project]]` blocks regardless of which day they were logged.

When you open the dashboard while focused on a **non-daily-note page**, it opens directly in Page mode with that page pre-selected.

### Totals tab

Shows a horizontal bar chart for each category over the selected period. Top-level categories display a **stacked bar** breaking down their subcategories. Goal and limit markers are shown on the bars so you can see at a glance whether you are on track. Click the expand arrow (▸) next to a category to drill down into its subcategories.

<img width="945" height="567" alt="image" src="https://github.com/user-attachments/assets/eb117a6f-af45-4d9d-a3cb-1250367c6d5a" />


### Trends tab

Shows time per category over time as a **stacked bar chart**. Select which categories to display using the checkbox tree on the left. Use the **Group by** switcher to aggregate data by day, week, month, or quarter. Goal and limit reference lines are drawn on the chart for each selected category.


<img width="1101" height="681" alt="image" src="https://github.com/user-attachments/assets/e9956afe-1692-4f64-a7c8-395a6aac7633" />


### Period selector

Use the preset buttons (Today / This Week / This Month / This Quarter) or pick a **Custom** date range. Navigate backward and forward with the ‹ › arrows.

Presets always cover the **full period** — This Week runs Monday through Sunday, This Month covers the entire calendar month, and This Quarter spans the full three-month block.

When you open the dashboard from a **daily note page** (via the command palette or a `{{Time Tracker/Total dashboard}}` button placed on a DNP), the presets use that note's date as their reference instead of today. For example, opening from a note dated last Monday will show "This Week" as that week (Monday–Sunday), not the current week.

### Opening the dashboard from a Roam button

You can place a native Roam button in any block or template to open the dashboard directly:

```
{{Time Tracker/Total dashboard}}
{{Time Tracker/Total dashboard:week}}
```

The optional period suffix (`:day`, `:week`, `:month`, `:quarter`) sets the initial period shown when the dialog opens. If the button is placed on a **past daily note**, the dashboard will automatically open relative to that date (e.g., `{{Time Tracker/Total dashboard:week}}` on last Monday's daily note will open the dashboard showing that week).

## 🆕 Categories, goals & limits manager

Instead of editing Roam blocks directly, you can now manage all your categories, subcategories, goals, limits, aliases and chart colors from a single **graphical dialog**.

Open it from:

- The **"Manage categories..."** button at the top of the extension settings panel, or
- The command `Time Tracker: Manage categories, goals & limits`, or
- A native Roam button: `{{Time Tracker/Manage categories}}`

### What you can do in the manager

<img width="613" height="431" alt="image" src="https://github.com/user-attachments/assets/7c8a9e79-91f8-43e3-af6d-f854c408abd9" />

- **Add** top-level categories or subcategories with the inline form
- **Rename** any category by clicking its name or the ✎ pencil icon
- **Delete** a category (with confirmation) — this also removes it from your Roam graph
- **Set goals and limits** per interval (task, day, week, month) directly in the editing panel. Existing goals/limits stored in Roam blocks are automatically migrated to the new settings-based storage on first open
- **Add aliases** — alternative names or page references (e.g. `[[My Project]]`) that will also match the category when calculating totals. This is especially useful when the category name in your graph differs from the label you want to display
- **Pick a chart color** for each category — used consistently across the Time Dashboard bars and trends chart. Choose from the palette, or click ✦ to open a full color picker

## Categories, goals and limits configuration

To get started, simply open the **Categories manager** (via the `Time Tracker: Manage categories, goals & limits` command, or the **"Manage categories..."** button in extension settings). If no categories block exists yet, the manager automatically creates one on `[[roam/depot/time tracker]]` and opens that page in the sidebar. You can also set a custom block reference for your categories list manually in the extension settings (`Categories` field). Once defined, any change to the corresponding blocks and their children is automatically reflected — no refresh needed.

### Categories and sub-categories

- You can define a list of categories, used as trigger words for elapsed time calculation of an interval and for more details in the total calculation. A category can consist in any string of characters (case unsensitive), or any page reference or block reference. To mention a category, just write it in plain text or mention it as block reference (so you can easily find the right category with block search) in a block where you want to measure the elapsed time on the correspoding task. Page references have to follow the strict Roam `[[page]]` syntax, since tags a processed differently (see below Tag categories)
- Each category can be subdivided in sub-categories (e.g. 'reading', subdivided in 'article' and 'book'), and so forth. If a sub-category is mentionned in a block, the time will also be added to the parent category in total calculation. Two subcategories of two different categories can have the same name, in this case you will have to specify both the category and the subcategory in order to refer to it properly
- You can mention multiple categories in the same block, time will be added in all of them but only once in their common ancestor, if they have one.

### Tag categories (transversal labels)

Any top-level category whose name starts with `#` (e.g. `#deep-work`, `#admin`) is treated as a **tag category**. Tags behave differently from regular categories:

- They accumulate time **independently** — the time is tracked against the tag but is **not added to the global total** and does not count toward any regular category.
- They are **transversal**: a block can match both a regular category and one or more tags simultaneously. The tag time is informational only.
- Tag categories **cannot have sub-categories**.
- They appear in the Dashboard alongside regular categories so you can visualize how much time was spent under each tag across any period.

### Goals and limits

- For each category or sub-category, you can define a goal (minimum to reach) or a limit (maximum not to exceed). Depending on whether the limit is respected or not, a flag (by default, a set of icon but you can switch to color tags or customize your own flags) will be inserted in the block, after elapsed time or total time spent. By default, a popup window will ask for confirmation before inserting the flag for the current task. It will be automatically applied in the total time blocks. Goals or limits can be defined both for an interval (elapsed time between two timestamps for a given task) or for a period: day, week or month.
- To configure goals or limits, use the **Categories manager** dialog described above. Alternatively, if you have existing block-based goals/limits, they will be offered for migration to the new settings-based storage when you first open the manager.
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

## If you want to support my work

If you want to encourage me to develop further and enhance Time Tracker extension, you can [buy me a coffee ☕ here](https://buymeacoffee.com/fbgallet) or [sponsor me on Github](https://github.com/sponsors/fbgallet). Thanks in advance for your support! 🙏

For any question or suggestion, DM me on **X/Twitter** and follow me to be informed of updates and new extensions : [@fbgallet](https://x.com/fbgallet), on Bluesky: [@fbgallet.bsky.social](https://bsky.app/profile/fbgallet.bsky.social) or on Mastodon: [@fbgallet](https://mastodon.social/home).

Please report any issue [here](https://github.com/fbgallet/roam-extension-elapsed-time/issues).
