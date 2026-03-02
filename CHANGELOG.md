## v.5 (February 2026) Major update - Dashboards & Category manager

### New feature:

- Dashboard for visualization of Totals & Trends (charts) for DNP or specific Pages
- Category manager dialog box
- Category autocomplete picker with /Time tracker slash command (or Elapsed time Command palette command)

### Updates:

- '#tags' are a new and specific type of transversal category
- Removed total per week/month/quarter/year from Command palette (use Dashboard or Smartblocks to get results inline)

### Fixes

- Bug if there was a blank block in category outline
- TODO & DONE component were mispositioned after timestamp insertion
- Certainly a lot of other small bugs have been fixed (since a major refactoring has been achieved)

## v.4 (May 3rd, 2024) important fixes

### New feature:

- embeded blocks can now be taken into account (in option)
- new command: "Total for current block and all its references"

### Updates:

- page references as category are now recognized regardless of how they are written. `[[page]]`, `#page` or `#[[page]]`
- uncategorized total has been added to clipboard copy

### Fixes

- Total was not reliable when multiple sub-categories were mentionned in the same block or hierachy (time could be added multiple times to the higher sub-total).
- Decimals are rounded to 2 and properly displayed in tables
- Small bugs in the display of total for current page and its refs (was not working if no block focused, and total=0 was not displayed)

## v.3 (August 23rd, 2023) small add-ons

### Updates:

- added `<diff>` placeholder for customizable flags inserted when the goals are achieved or not, and the limits are exceeded or not. Insert the time difference in minutes with the goal or the limit.or
- added `<period>` placeholder for the total by period title (parent block): insert the period name (day, week, etc.) or the corresponding number of days if not a standard period.
- added `<td>` to display total times in decimal hours (ex.: 1h30 is displayed as 1.5)

## v.2 (June 12th, 2023) **Major update**

### New features:

- **Total by period** ! Week, month, quarter, year or any given period
- Total on current page is now calculated on all block levels, not only sibbling blocks
- Simplified configuration with `Set categories and Goals & limits` command and Categories and Goals & limits changes auto-updated
- Roam {{table}} view of total (in option), also copied to clipboard for easy export
- `Remote elapsed time` for very seamless interstitial journaling
- Total for a given page and all its references

### Updates:

- `Elapsed time` command is way more versatile and replace existing buttons by timestamp
- Categories admit any number of sub-categories levels
- Goals & limits can be set for week or month
- A page reference `[[category]]` is applied to all children elapsed times (unless a distinct, not sub-category of the former, is mentioned)
- Pomodoros are taken into account in total (in option)

## Fixes:

- Timestamp without 0*:0* (e.g.: 9:20) are taken into account an automatically converted to hh:ss

And a lot of fixes and large refactoring of the code
