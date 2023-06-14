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
  - Timestamp without 0_:0_ (e.g.: 9:20) are taken into account an automatically converted to hh:ss

And a lot of fixes and large refactoring of the code
