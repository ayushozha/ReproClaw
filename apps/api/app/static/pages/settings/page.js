window.setupSettingsView = function setupSettingsView(root) {
  if (!root) return;

  const state = {
    secretRevealed: false,
    savedPillTimer: 0,
    dataState: "loading",
  };

  function settingsEscape(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function settingsFormatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    const units = ["B", "KB", "MB", "GB"];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i += 1;
    }
    const rounded = n >= 10 || i === 0 ? Math.round(n) : Math.round(n * 10) / 10;
    return rounded + " " + units[i];
  }

  const savedPill = root.querySelector("#settings-saved-pill");
  function settingsShowSaved(label) {
    if (!savedPill) return;
    const text = savedPill.querySelector("span:last-child");
    if (text) text.textContent = label || "Saved";
    savedPill.dataset.state = "visible";
    if (state.savedPillTimer) {
      window.clearTimeout(state.savedPillTimer);
    }
    state.savedPillTimer = window.setTimeout(() => {
      savedPill.dataset.state = "hidden";
    }, 1600);
  }

  // ── Sub-nav active state ──────────────────────────────────────────
  const subnavItems = Array.from(root.querySelectorAll(".settings-subnav-item"));
  function settingsSetActiveSection(sectionId) {
    subnavItems.forEach((item) => {
      const target = item.getAttribute("href") || "";
      const isActive = target === "#" + sectionId;
      item.classList.toggle("active", isActive);
      if (isActive) {
        item.setAttribute("aria-current", "true");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  }
  if (subnavItems.length) {
    settingsSetActiveSection(subnavItems[0].dataset.section
      ? "settings-" + subnavItems[0].dataset.section
      : "");
  }
  subnavItems.forEach((item) => {
    item.addEventListener("click", () => {
      const id = (item.getAttribute("href") || "").replace(/^#/, "");
      if (id) settingsSetActiveSection(id);
    });
  });

  // Update active section on scroll using IntersectionObserver
  const sections = Array.from(root.querySelectorAll(".settings-panel"));
  if (sections.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length && visible[0].target.id) {
          settingsSetActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.4, 0.8] }
    );
    sections.forEach((sec) => observer.observe(sec));
  }

  // ── Reveal toggle for masked secret ───────────────────────────────
  root.querySelectorAll("[data-settings-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-settings-toggle");
      const input = root.querySelector("#" + targetId);
      if (!input) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      btn.setAttribute("aria-pressed", reveal ? "true" : "false");
      btn.setAttribute("aria-label", reveal ? "Hide secret" : "Reveal secret");
      state.secretRevealed = reveal;
    });
  });

  // ── Copy buttons ──────────────────────────────────────────────────
  root.querySelectorAll("[data-settings-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-settings-copy");
      const input = root.querySelector("#" + targetId);
      if (!input) return;
      const value = input.value || "";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          input.select();
          document.execCommand("copy");
        }
        settingsShowSaved("Copied");
      } catch (err) {
        settingsShowSaved("Copy failed");
      }
    });
  });

  // ── Slider live readout (read-only) ───────────────────────────────
  const tokenSlider = root.querySelector("#settings-models-tokens");
  const tokenValue = root.querySelector("#settings-models-tokens-value");
  if (tokenSlider && tokenValue) {
    tokenSlider.addEventListener("input", () => {
      tokenValue.textContent = tokenSlider.value;
    });
  }

  // ── Action buttons (stubs) ────────────────────────────────────────
  const actionLabels = {
    "save-account": "Profile saved",
    "sign-out": "Signed out",
    "agentmail-test": "Test sent",
    "nia-resync": "Resync queued",
    "save-models": "Models saved",
    "save-defaults": "Defaults saved",
    "export-json": "Export queued",
    "refresh-data": "Refreshed",
    "reset-demo": "Demo reset",
    "delete-conversations": "Conversations deleted",
  };

  root.querySelectorAll("[data-settings-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-settings-action") || "";
      if (action === "refresh-data") {
        settingsLoadData();
      }
      if (action === "nia-resync") {
        const sync = root.querySelector("#settings-nia-sync");
        if (sync) sync.textContent = settingsTimestamp(new Date());
      }
      settingsShowSaved(actionLabels[action] || "Saved");
    });
  });

  function settingsTimestamp(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return (
      date.getUTCFullYear() +
      "-" +
      pad(date.getUTCMonth() + 1) +
      "-" +
      pad(date.getUTCDate()) +
      " " +
      pad(date.getUTCHours()) +
      ":" +
      pad(date.getUTCMinutes()) +
      " UTC"
    );
  }

  // ── Data section: counts from /audits + /chat/conversations ────────
  const statsRoot = root.querySelector("#settings-data-stats");
  const stateMsg = root.querySelector("#settings-data-state-msg");
  const auditsEl = root.querySelector("#settings-stat-audits");
  const claimsEl = root.querySelector("#settings-stat-claims");
  const convsEl = root.querySelector("#settings-stat-conversations");
  const storageEl = root.querySelector("#settings-stat-storage");

  function settingsRenderCounts(audits, conversations, errored) {
    if (!statsRoot) return;
    if (errored) {
      statsRoot.dataset.state = "error";
      if (stateMsg) stateMsg.textContent = "Could not load counts. Check API connectivity.";
      if (auditsEl) auditsEl.textContent = "—";
      if (claimsEl) claimsEl.textContent = "—";
      if (convsEl) convsEl.textContent = "—";
      if (storageEl) storageEl.textContent = "—";
      return;
    }

    const auditsList = Array.isArray(audits) ? audits : [];
    const convsList = Array.isArray(conversations) ? conversations : [];
    let claimsCount = 0;
    let storageEstimate = 0;
    auditsList.forEach((a) => {
      if (a && Array.isArray(a.claims)) claimsCount += a.claims.length;
      if (a && typeof a.report_text === "string") storageEstimate += a.report_text.length;
      storageEstimate += 2048;
    });
    convsList.forEach((c) => {
      storageEstimate += 1024;
      if (c && Array.isArray(c.messages)) {
        c.messages.forEach((m) => {
          if (m && typeof m.content === "string") storageEstimate += m.content.length;
        });
      }
    });

    statsRoot.dataset.state = "ready";
    if (stateMsg) stateMsg.textContent = "";
    if (auditsEl) auditsEl.textContent = String(auditsList.length);
    if (claimsEl) claimsEl.textContent = String(claimsCount);
    if (convsEl) convsEl.textContent = String(convsList.length);
    if (storageEl) storageEl.textContent = settingsFormatBytes(storageEstimate);
  }

  async function settingsFetchJson(path) {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error("Request failed: " + res.status);
    }
    const body = await res.json();
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.items)) return body.items;
    if (body && Array.isArray(body.audits)) return body.audits;
    if (body && Array.isArray(body.conversations)) return body.conversations;
    return body;
  }

  async function settingsLoadData() {
    if (!statsRoot) return;
    statsRoot.dataset.state = "loading";
    if (stateMsg) stateMsg.textContent = "Loading counts…";
    if (auditsEl) auditsEl.textContent = "--";
    if (claimsEl) claimsEl.textContent = "--";
    if (convsEl) convsEl.textContent = "--";
    if (storageEl) storageEl.textContent = "--";

    try {
      const [audits, conversations] = await Promise.all([
        settingsFetchJson("/audits").catch(() => null),
        settingsFetchJson("/chat/conversations").catch(() => null),
      ]);
      const failed = audits === null && conversations === null;
      settingsRenderCounts(audits, conversations, failed);
    } catch (err) {
      settingsRenderCounts(null, null, true);
    }
  }

  settingsLoadData();
};
