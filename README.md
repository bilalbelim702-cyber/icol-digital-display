# ICOL Digital Salah Display

TV display for the Islamic Center of Lakeland. The clock and background use Eastern time in Lakeland, Florida. The display shows the five daily prayers, the next scheduled Iqamah, and announcements.

## Update prayer times and announcements

1. Open `schedule.json` in this repository on GitHub and choose the pencil icon.
2. Enter the approved Adhan and Iqamah times in 24-hour `HH:MM` format. For example, `"18:05"` appears as 6:05 PM. Use `""` for a time you want to leave blank. The schedule repeats daily until you update it.
3. Add announcements as quoted strings in the `announcements` list, separated by commas. The display rotates through them every 15 seconds.
4. Commit the changes. Once GitHub Pages publishes them, open displays check for the new schedule every minute.

GitHub repository write access controls editing. The display and its published content are public.

To show Friday prayer times, add a top-level `jumuah` object to `schedule.json` alongside `prayers` and `announcements`. Give it `khutbah` and `iqamah` fields using the same 24-hour format. Leave either field blank until the approved time is available.

The chandelier hall appears from 5 AM to 8 PM Lakeland time. The blue-hour mosque appears overnight. The Hijri date uses the civil calendar.

## Publish to GitHub Pages

Open **Settings → Pages** in this repository. Under **Build and deployment**, select **Deploy from a branch**, choose **main** and **/(root)**, then save. When deployment finishes, select **Visit site**.

Open the published address in Edge on Windows or in the browser on the Fire TV. On Windows, press **F11** for full screen. Check that the logo and clock are visible, the time matches Lakeland, and the prayer schedule matches the approved timetable.

To preview locally, serve the repository directory over HTTP and open its local address. The schedule is loaded over HTTP.

Maghrib uses the configured `sunsetOffsetMinutes` after calculated Lakeland sunset when the Adhan field is blank. A confirmed Maghrib Adhan can override the calculation. The [NOAA solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF) are used for the daily sunset estimate. The Friday table and countdown show Jumu’ah in the Dhuhr slot when a Friday khutbah or prayer time is set. The countdown includes Jumu’ah only if its prayer time is entered.

Prayer begins times and sunrise are calculated for Lakeland using Karachi twilight angles, the Hanafi Asr shadow rule, and local Eastern time. A configured Adhan time overrides the calculated start for that prayer. If a configured Iqamah falls outside the calculated opening (or after sunrise for Fajr), the board shows Check time and skips it in the countdown until the schedule is corrected.

## Phone controls

Open [Board controls](https://bilalbelim702-cyber.github.io/icol-digital-display/controls.html) to update daily Iqamah, Maghrib's offset, Jumu’ah, or announcements without editing JSON. Preview controls loads the current public timetable and does not publish anything.

For editing, generate a short-lived fine-grained GitHub token for only this repository with Contents Read and write. Enter it directly in Board controls. The token stays in memory and goes only to GitHub's API. Use Lock when finished. The editor requires the current file version when saving so it cannot silently overwrite a newer schedule.
