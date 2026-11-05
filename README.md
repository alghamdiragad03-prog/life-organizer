# Life Organizer 🗓️

A personal web app (PWA) for organizing your schedule and tasks. Works on phone and desktop, and offline after the first visit.

## Features
- **Today**: completion progress, today's schedule (current event highlighted, past events dimmed), today's tasks, and overdue tasks.
- **Tasks**: priority (high / medium / low), due date and time, categories, notes, filters.
- **Schedule**: weekly view starting Sunday; events can be one-off, daily, weekly, or weekdays (Sun–Thu), with colors and locations.
- Gregorian + Hijri date, dark mode, undo after deleting or completing.
- Export / import your data as a JSON backup.

Data is stored on your device only (localStorage).

## Run locally
Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

## Install on your phone
1. Enable GitHub Pages (Settings → Pages → Branch: `main`).
2. Open the link on your phone → "Add to Home Screen".
