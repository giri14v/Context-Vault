const API = "http://localhost:8000";
const ALARM_NAME = "contextvault-poll";
const POLL_INTERVAL_MINUTES = 2;
const notificationMap = {};
// ── Ensure alarm always exists ────────────────────────────────────────────────

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: POLL_INTERVAL_MINUTES,
    });
    console.log("[CV] Alarm created.");
  } else {
    console.log("[CV] Alarm active. Next fire:", new Date(existing.scheduledTime).toLocaleTimeString());
  }
}

chrome.runtime.onInstalled.addListener(() => ensureAlarm());
chrome.runtime.onStartup.addListener(() => ensureAlarm());
ensureAlarm();

// ── Alarm handler ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log("[CV] Alarm fired:", alarm.name);
  if (alarm.name !== ALARM_NAME) return;
  await pollDueReminders();
});

// ── Token helpers ─────────────────────────────────────────────────────────────

function getTokens() {
  return new Promise((resolve) =>
    chrome.storage.local.get(["access_token", "refresh_token"], resolve)
  );
}

function saveAccessToken(token) {
  return new Promise((resolve) =>
    chrome.storage.local.set({ access_token: token }, resolve)
  );
}

async function refreshAccessToken(refreshToken) {
  try {
    const res = await fetch(`${API}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access || null;
  } catch (e) {
    console.error("[CV] Token refresh error:", e);
    return null;
  }
}

// ── Poll due reminders ────────────────────────────────────────────────────────

async function pollDueReminders() {
  let { access_token, refresh_token } = await getTokens();
  if (!access_token) {
    console.log("[CV] No token, skipping poll.");
    return;
  }

  console.log("[CV] Polling...");
  let res = await fetchDueReminders(access_token);

  if (res.status === 401 && refresh_token) {
    console.log("[CV] Refreshing token...");
    const newToken = await refreshAccessToken(refresh_token);
    if (!newToken) return;
    await saveAccessToken(newToken);
    access_token = newToken;
    res = await fetchDueReminders(newToken);
  }

  if (!res.ok) {
    console.error("[CV] Poll failed:", res.status);
    return;
  }

  const reminders = await res.json().catch(() => []);
  console.log("[CV] Due reminders:", reminders.length);

  for (const reminder of reminders) {
    const fired = await fireNotification(reminder);
    if (fired) {
      await markSent(reminder.id, access_token);
    }
  }
}

async function fetchDueReminders(token) {
  return fetch(`${API}/reminders/due/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Mark sent (called only after notification confirmed) ──────────────────────

async function markSent(reminderId, token) {
  try {
    const res = await fetch(`${API}/reminders/${reminderId}/sent/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      console.log("[CV] Marked sent:", reminderId);
    } else {
      console.warn("[CV] Failed to mark sent:", reminderId, res.status);
    }
  } catch (e) {
    console.error("[CV] markSent error:", e);
  }
}

// ── Fire Chrome notification — returns true if created successfully ────────────

function fireNotification(reminder) {
  return new Promise((resolve) => {
    const bookmark = reminder?.bookmark || {};

    const title = "ContextVault Reminder";
    const message = bookmark.title || "Saved bookmark";

    // 🔥 Show notes if available, else fallback to URL
    const contextMessage = bookmark.notes
      ? bookmark.notes.slice(0, 80)
      : (bookmark.url || "").slice(0, 80);

    const notifId = `reminder-${reminder.id}`;

    // 🔥 Store URL for click handling
    notificationMap[notifId] = bookmark.url;

    chrome.notifications.create(
      notifId,
      {
        type: "basic",
        iconUrl: "icon.png",
        title: title,
        message: message,
        contextMessage: contextMessage,
        priority: 2,
      },
      (createdId) => {
        if (chrome.runtime.lastError) {
          console.error("[CV] Notification error:", chrome.runtime.lastError.message);
          resolve(false);
        } else {
          console.log("[CV] Notification fired:", createdId);
          resolve(true);
        }
      }
    );
  });
}

// ── Open URL on notification click ───────────────────────────────────────────

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith("reminder-")) return;

  const url = notificationMap[notificationId];

  if (url) {
    chrome.tabs.create({ url });
  }

  chrome.notifications.clear(notificationId);
});


function attachBookmarkActions() {
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await apiFetch(`/bookmarks/${id}/`, { method: "DELETE" });
      loadBookmarks();
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openEditScreen(id);
    });
  });
}