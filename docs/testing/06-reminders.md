# 06 — Reminders editor

1. New reminder → schedule kind **Once**. **Expected:** a date-time picker (calendar + hour/minute
   columns), defaulting to the next hour.
2. Kind **Daily**: add three times with "Add time", remove one with ×, toggle weekday chips.
   **Expected:** the summary line under the schedule updates; with no weekday selected it reads
   "every day".
3. Kind **Interval**: set every 30 min, window 09:00–12:00 via time pickers.
4. Kind **Monthly**: pick days 1 and 15 in the grid; the last selected day cannot be unselected.
5. Set Starts on / Ends on with the date pickers; clear Ends on with ×.
6. Remove a schedule with the × icon (tooltip "Remove schedule") when more than one exists.
7. Description: select text and press the Bold, Italic, bulleted and numbered toolbar buttons and
   ⌘B/⌘I. Switch to Preview. **Expected:** Markdown renders; toggling again removes formatting.
8. Delivery: switch Default → Custom, toggle channel tiles, pick a sound, press "Test delivery".
9. Save. **Expected:** next occurrences shown before saving match the list after saving.
10. Press Escape while a picker is open. **Expected:** only the picker closes, not the dialog.
