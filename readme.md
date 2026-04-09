# ContextVault

A Chrome extension for context-aware bookmarking with smart reminders.

## Features

- Save bookmarks with notes
- Context tagging system
- Smart reminders with repeat logic
- Bookmark manager (edit, delete, search)
- Chrome notifications

## Tech Stack

- Django + DRF
- PostgreSQL
- Chrome Extension (Manifest V3)

## Setup

### Backend

cd backend
pip install -r requirements.txt
python manage.py runserver

### Extension

1. Go to chrome://extensions/
2. Enable Developer Mode
3. Click "Load Unpacked"
4. Select extension folder
