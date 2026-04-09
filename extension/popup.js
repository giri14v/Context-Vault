const API = "http://localhost:8000";

// ── State ─────────────────────────────────────────────────────────────────────
let editMode = false;
let editingId = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
function getToken() {
  return new Promise((resolve) =>
    chrome.storage.local.get(["access_token"], (r) => resolve(r.access_token))
  );
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function setStatus(elId, message, type) {
  const el = document.getElementById(elId);
  el.textContent = message;
  el.className = `status ${type}`;
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function resetForm() {
  document.getElementById("save-title").value = "";
  document.getElementById("save-notes").value = "";
  document.getElementById("save-remind-at").value = "";
  document.getElementById("repeat-count").value = "";
  document.getElementById("repeat-interval").value = "";
  document.querySelectorAll(".chip.selected").forEach((c) => c.classList.remove("selected"));
  document.getElementById("save-status").className = "status";
}

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const token = await getToken();
  if (token) {
    await initSaveScreen();
  } else {
    showScreen("screen-login");
  }

  // Login
  document.getElementById("btn-login").addEventListener("click", async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();
    if (!username || !password) return setStatus("login-status", "Please fill in all fields.", "error");

    const { ok, data } = await apiFetch("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (ok) {
      chrome.storage.local.set({
        access_token: data.access,
        refresh_token: data.refresh,
        username,
      });
      await initSaveScreen();
    } else {
      setStatus("login-status", "Invalid credentials.", "error");
    }
  });

  // Logout
  document.getElementById("btn-logout").addEventListener("click", () => {
    chrome.storage.local.clear();
    showScreen("screen-login");
  });

  // Save bookmark
  document.getElementById("btn-save").addEventListener("click", handleSave);

  // View bookmarks
  document.getElementById("btn-view-bookmarks").addEventListener("click", () => {
    loadBookmarks();
    showScreen("screen-list");
  });

  // Back button
  document.getElementById("btn-back").addEventListener("click", () => {
    showScreen("screen-save");
  });

  // Search
  document.getElementById("search-input").addEventListener("input", loadBookmarks);
});

// ── Save screen init ──────────────────────────────────────────────────────────
async function initSaveScreen() {
  showScreen("screen-save");

  // Show username in footer
  chrome.storage.local.get(["username"], (r) => {
    document.getElementById("footer-user").textContent = r.username || "";
  });

  // Pre-fill URL and title from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    
    // 🔥 FAILSAFE: Check if tab exists + valid URL
    if (tab && tab.url && tab.url.startsWith('http')) {
      document.getElementById("save-url").value = tab.url;
      document.getElementById("save-title").value = tab.title || "";
      console.log("[CV] Tab loaded:", tab.url);
    } else {
      // 🔥 FALLBACK: Prompt user to enter URL manually
      document.getElementById("save-url").value = "";
      document.getElementById("save-title").value = "";
      setStatus("save-status", "No active tab detected. Please enter URL manually.", "warning");
      console.warn("[CV] No valid tab found");
    }
  });

  // Load contexts
  await loadContexts();

  // Reset edit mode
  editMode = false;
  editingId = null;
  document.getElementById("btn-save").textContent = "Save bookmark";
}

async function loadContexts() {
  const container = document.getElementById("context-list");
  const { ok, data } = await apiFetch("/bookmarks/contexts/");

  if (!ok) {
    container.innerHTML = `<span style="font-size:12px;color:#c0392b;">Failed to load contexts.</span>`;
    return;
  }

  if (data.length === 0) {
    container.innerHTML = `<span style="font-size:12px;color:#aaa;">No contexts yet. Create one from the API.</span>`;
    return;
  }

  container.innerHTML = "";
  data.forEach((ctx) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = ctx.name;
    chip.dataset.id = ctx.id;
    chip.addEventListener("click", () => chip.classList.toggle("selected"));
    container.appendChild(chip);
  });
}

// ── Handle save ───────────────────────────────────────────────────────────────
async function handleSave() {
  const url = document.getElementById("save-url").value.trim();
  const title = document.getElementById("save-title").value.trim();
  const notes = document.getElementById("save-notes").value.trim();
  const remindAt = document.getElementById("save-remind-at").value;
  const repeatCount = parseInt(document.getElementById("repeat-count").value) || 0;
  const repeatInterval = parseInt(document.getElementById("repeat-interval").value) || 0;

  if (!url || url.length === 0 || url === "undefined") {
    return setStatus("save-status", "Valid URL required!", "error");
  }

  if (repeatInterval > 0 && repeatInterval < 2) {
    setStatus("save-status", "Intervals below 2 min may be delayed.", "error");
    return;
  }

  if (!url || !title) {
    return setStatus("save-status", "URL and title are required.", "error");
  }

  const selectedIds = [...document.querySelectorAll(".chip.selected")].map((c) =>
    parseInt(c.dataset.id)
  );

  // Save bookmark
  const { ok, data } = await apiFetch(editMode ? `/bookmarks/${editingId}/` : "/bookmarks/", {
    method: editMode ? "PUT" : "POST",
    body: JSON.stringify({ 
      url, 
      title, 
      notes, 
      context_ids: selectedIds 
    }),
  });

  if (!ok) {
    const msg = data?.url?.[0] || data?.detail || "Failed to save bookmark.";
    return setStatus("save-status", msg, "error");
  }

  const bookmarkId = editMode ? editingId : data.id;

  // Schedule reminder if set
  if (remindAt) {
    const remindAtUTC = new Date(remindAt).toISOString();
    console.log("[CV] Scheduling reminder at UTC:", remindAtUTC);
    const reminderRes = await apiFetch("/reminders/", {
      method: "POST",
      body: JSON.stringify({
        bookmark_id: bookmarkId,
        remind_at: remindAtUTC,
        repeat_count: repeatCount,
        repeat_interval_minutes: repeatInterval
      }),
    });
    console.log("[CV] Reminder create response:", reminderRes);
  }

  setStatus("save-status", "Saved successfully!", "success");

  // Reset form after short delay
  setTimeout(() => {
    resetForm();
    // Refresh tab data for new bookmark
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      document.getElementById("save-url").value = tab.url || "";
      document.getElementById("save-title").value = tab.title || "";
    });
    // Reset edit mode
    editMode = false;
    editingId = null;
    document.getElementById("btn-save").textContent = "Save bookmark";
  }, 1800);
}

// ── Bookmark List ─────────────────────────────────────────────────────────────
async function loadBookmarks() {
  const { data: bookmarks } = await apiFetch("/bookmarks/");
  const searchTerm = document.getElementById("search-input").value.toLowerCase();
  
  const filteredBookmarks = bookmarks.filter(b => 
    b.title.toLowerCase().includes(searchTerm) || 
    (b.notes && b.notes.toLowerCase().includes(searchTerm))
  );
  
  renderBookmarks(filteredBookmarks);
}

function renderBookmarks(bookmarks) {
  const container = document.getElementById("bookmark-list");
  container.innerHTML = "";

  if (bookmarks.length === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;">No bookmarks found.</div>';
    return;
  }

  bookmarks.forEach((b) => {
    const div = document.createElement("div");
    div.className = "bookmark-item";
    div.innerHTML = `
    <div class="bookmark-content" data-url="${b.url}">
      <strong class="bookmark-title">${b.title}</strong><br/>
      <small style="color:#666;">${b.url}</small><br/>
      ${b.notes ? `<h5>${b.notes}</h5><br/>` : ''}
    </div>
    <div>
      <button class="delete-btn btn" data-id="${b.id}">Delete</button>
    </div>
  `;
    container.appendChild(div);
  });

  attachActions();
}

function attachActions() {
  // Delete buttons
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.onclick = async () => {
      if (confirm("Delete this bookmark?")) {
        await apiFetch(`/bookmarks/${btn.dataset.id}/`, { method: "DELETE" });
        loadBookmarks();
      }
    };
  });

  // Edit buttons
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.onclick = async () => {
      const { data } = await apiFetch("/bookmarks/");
      const bookmark = data.find((x) => x.id == btn.dataset.id);

      if (bookmark) {
        // Populate form
        document.getElementById("save-url").value = bookmark.url;
        document.getElementById("save-title").value = bookmark.title;
        document.getElementById("save-notes").value = bookmark.notes || "";
        
        // Select contexts
        const chips = document.querySelectorAll(".chip");
        chips.forEach(chip => {
          chip.classList.remove("selected");
          if (bookmark.contexts?.some(ctx => ctx.id == chip.dataset.id)) {
            chip.classList.add("selected");
          }
        });

        editMode = true;
        editingId = bookmark.id;
        document.getElementById("btn-save").textContent = "Update bookmark";
        showScreen("screen-save");
      }
    };
  });
  document.querySelectorAll(".bookmark-content").forEach((el) => {
    el.addEventListener("click", () => {
          const url = el.dataset.url;

          if (url) {
            chrome.tabs.create({ url });
          }
    });
  });
}

