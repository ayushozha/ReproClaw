(function () {
  "use strict";

  const HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  function repositoriesEscape(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
  }

  function repositoriesParseRepoName(url) {
    if (!url) return { full: "unknown", host: "" };
    if (typeof url === "string" && url.startsWith("demo:")) {
      return { full: url.slice(5) || "demo/repo", host: "demo", isDemo: true };
    }
    try {
      const u = new URL(url);
      const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (parts.length >= 2) {
        return { full: `${parts[0]}/${parts[1].replace(/\.git$/, "")}`, host: u.host };
      }
      return { full: u.pathname.replace(/^\//, "") || u.host, host: u.host };
    } catch (_) {
      return { full: String(url), host: "" };
    }
  }

  function repositoriesGuessLanguage(repoFull) {
    if (!repoFull) return null;
    const lower = repoFull.toLowerCase();
    const hints = [
      ["pytorch", "Python"],
      ["tensorflow", "Python"],
      ["jax", "Python"],
      ["transformers", "Python"],
      ["-py", "Python"],
      ["python", "Python"],
      ["numpy", "Python"],
      ["scikit", "Python"],
      ["rust", "Rust"],
      ["-rs", "Rust"],
      ["golang", "Go"],
      ["-go", "Go"],
      ["javascript", "JavaScript"],
      ["typescript", "TypeScript"],
      ["-ts", "TypeScript"],
      [".js", "JavaScript"],
      ["cpp", "C++"],
      ["c++", "C++"],
    ];
    for (const [needle, lang] of hints) {
      if (lower.includes(needle)) return lang;
    }
    return null;
  }

  function repositoriesScoreBand(score) {
    if (typeof score !== "number" || Number.isNaN(score)) return "na";
    if (score >= 75) return "strong";
    if (score >= 50) return "fair";
    return "weak";
  }

  function repositoriesRelativeTime(input) {
    if (!input) return "never";
    const ts = typeof input === "string" ? Date.parse(input) : Number(input);
    if (!Number.isFinite(ts)) return "unknown";
    const diff = (Date.now() - ts) / 1000;
    if (diff < 45) return "just now";
    if (diff < 90) return "1 min ago";
    if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
    if (diff < 5400) return "1 hr ago";
    if (diff < 86400) return `${Math.round(diff / 3600)} hr ago`;
    if (diff < 172800) return "yesterday";
    if (diff < 2592000) return `${Math.round(diff / 86400)} d ago`;
    if (diff < 5184000) return "1 mo ago";
    return `${Math.round(diff / 2592000)} mo ago`;
  }

  function repositoriesGroup(audits) {
    const map = new Map();
    for (const audit of audits) {
      const url = audit.repo_url || audit.repository || "";
      const key = url || `audit:${audit.id || Math.random()}`;
      if (!map.has(key)) {
        const parsed = repositoriesParseRepoName(url);
        map.set(key, {
          key,
          repo_url: url,
          name: parsed.full,
          host: parsed.host,
          isDemo: !!parsed.isDemo,
          language: repositoriesGuessLanguage(parsed.full),
          audits: [],
        });
      }
      map.get(key).audits.push(audit);
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.audits.sort((a, b) => repositoriesAuditTime(b) - repositoriesAuditTime(a));
      const latestDone = g.audits.find((a) => (a.status === "done" || a.status === "completed") && typeof a.score === "number");
      g.latestAudit = g.audits[0] || null;
      g.latestDone = latestDone || g.latestAudit;
      g.latestScore = latestDone && typeof latestDone.score === "number" ? latestDone.score : null;
      g.auditCount = g.audits.length;
      g.lastSeen = repositoriesAuditTime(g.audits[0]);

      const verdicts = { verified: 0, flagged: 0, needs_review: 0, unsupported: 0 };
      const flaggedPaths = new Map();
      const evidencePaths = new Map();
      for (const a of g.audits) {
        const claims = Array.isArray(a.claims) ? a.claims : [];
        for (const c of claims) {
          const v = (c && c.verdict) || "";
          if (verdicts[v] !== undefined) verdicts[v] += 1;
          const evidence = Array.isArray(c && c.evidence) ? c.evidence : [];
          for (const e of evidence) {
            const path = (e && (e.path || e.file || e.file_path)) || "";
            if (!path) continue;
            evidencePaths.set(path, (evidencePaths.get(path) || 0) + 1);
            if (v === "flagged") {
              flaggedPaths.set(path, (flaggedPaths.get(path) || 0) + 1);
            }
          }
        }
      }
      g.claimSummary = verdicts;
      g.flaggedPaths = Array.from(flaggedPaths.entries()).sort((a, b) => b[1] - a[1]);
      g.topFlaggedPath = g.flaggedPaths[0] ? g.flaggedPaths[0][0] : "";
      g.topEvidence = Array.from(evidencePaths.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      g.hasConcerns = verdicts.flagged > 0 || verdicts.needs_review > 0;
    }
    return groups;
  }

  function repositoriesAuditTime(audit) {
    if (!audit) return 0;
    const candidates = [audit.completed_at, audit.updated_at, audit.created_at, audit.started_at];
    for (const c of candidates) {
      if (!c) continue;
      const t = Date.parse(c);
      if (Number.isFinite(t)) return t;
    }
    return 0;
  }

  function repositoriesGithubIcon() {
    return (
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<rect x="3.5" y="2" width="9" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" />' +
        '<path d="M3.5 11h9" stroke="currentColor" stroke-width="1.5" />' +
        '<path d="M6.5 13.5l1-1 1 1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />' +
      "</svg>"
    );
  }

  function repositoriesArrowIcon() {
    return (
      '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<path d="M2 6h7M6 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />' +
      "</svg>"
    );
  }

  function repositoriesRenderCard(group) {
    const band = repositoriesScoreBand(group.latestScore);
    const scoreText = group.latestScore !== null ? Math.round(group.latestScore) : "--";
    const auditCount = group.auditCount;
    const auditLabel = auditCount === 1 ? "1 audit" : `${auditCount} audits`;
    const last = group.lastSeen ? repositoriesRelativeTime(group.lastSeen) : "no audits";
    const latestId = group.latestDone && group.latestDone.id ? group.latestDone.id : "";
    const linkHref = latestId ? `/dashboard?audit=${encodeURIComponent(latestId)}` : "/dashboard";
    const tag = group.isDemo
      ? '<span class="repositories-view-card-tag demo">Demo</span>'
      : group.language
        ? `<span class="repositories-view-card-tag">${repositoriesEscape(group.language)}</span>`
        : "";
    const flagged = group.topFlaggedPath
      ? `<div class="repositories-view-card-flagged">
           <span class="repositories-view-card-flagged-label">Top flagged path</span>
           <span class="repositories-view-card-flagged-path mono" title="${repositoriesEscape(group.topFlaggedPath)}">${repositoriesEscape(group.topFlaggedPath)}</span>
         </div>`
      : "";

    return `
      <button type="button" class="repositories-view-card" data-repositories-card-key="${repositoriesEscape(group.key)}">
        <div class="repositories-view-card-head">
          <span class="repositories-view-card-icon" aria-hidden="true">${repositoriesGithubIcon()}</span>
          <span>
            <span class="repositories-view-card-name">${repositoriesEscape(group.name)}</span>
            <span class="repositories-view-card-meta">${repositoriesEscape(last)} · ${repositoriesEscape(auditLabel)}</span>
          </span>
          <span class="repositories-view-card-score band-${band}">
            ${repositoriesEscape(String(scoreText))}<small>/100</small>
          </span>
        </div>
        <div class="repositories-view-card-stats">
          <div class="repositories-view-card-stat verified">
            <span class="repositories-view-card-stat-dot" aria-hidden="true"></span>
            <span class="repositories-view-card-stat-label">Verified claims</span>
            <span class="repositories-view-card-stat-value">${group.claimSummary.verified}</span>
          </div>
          <div class="repositories-view-card-stat flagged">
            <span class="repositories-view-card-stat-dot" aria-hidden="true"></span>
            <span class="repositories-view-card-stat-label">Flagged</span>
            <span class="repositories-view-card-stat-value">${group.claimSummary.flagged}</span>
          </div>
          <div class="repositories-view-card-stat review">
            <span class="repositories-view-card-stat-dot" aria-hidden="true"></span>
            <span class="repositories-view-card-stat-label">Needs review</span>
            <span class="repositories-view-card-stat-value">${group.claimSummary.needs_review}</span>
          </div>
        </div>
        ${flagged}
        <div class="repositories-view-card-foot">
          <a class="repositories-view-card-link" href="${repositoriesEscape(linkHref)}" data-repositories-card-link>
            Open latest audit ${repositoriesArrowIcon()}
          </a>
          ${tag}
        </div>
      </button>
    `;
  }

  function repositoriesRenderDrawerBody(group) {
    const historyItems = group.audits
      .map((a) => {
        const score = typeof a.score === "number" ? Math.round(a.score) : "--";
        const band = repositoriesScoreBand(typeof a.score === "number" ? a.score : null);
        const ts = repositoriesAuditTime(a);
        const time = ts ? repositoriesRelativeTime(ts) : "queued";
        const title = a.paper_title || a.title || a.subject || `Audit ${a.id || ""}`.trim() || "Audit";
        const link = a.id ? `/dashboard?audit=${encodeURIComponent(a.id)}` : "/dashboard";
        const status = a.status ? repositoriesEscape(a.status) : "";
        return `
          <li class="repositories-view-history-item">
            <span class="repositories-view-history-score band-${band}">${repositoriesEscape(String(score))}</span>
            <div class="repositories-view-history-meta">
              <span class="repositories-view-history-title">${repositoriesEscape(title)}</span>
              <span class="repositories-view-history-time">${repositoriesEscape(time)}${status ? ` · ${status}` : ""}</span>
            </div>
            <a class="repositories-view-history-link" href="${repositoriesEscape(link)}">Open</a>
          </li>
        `;
      })
      .join("");

    const evidenceItems = group.topEvidence.length
      ? group.topEvidence
          .map(
            ([path, count]) => `
              <li class="repositories-view-evidence-item">
                <span class="repositories-view-evidence-path mono" title="${repositoriesEscape(path)}">${repositoriesEscape(path)}</span>
                <span class="repositories-view-evidence-count">${count}×</span>
              </li>
            `
          )
          .join("")
      : '<li class="repositories-view-evidence-item"><span class="repositories-view-evidence-path">No evidence collected yet.</span></li>';

    const repoLink = group.repo_url && !group.isDemo
      ? `<a class="repositories-view-card-link" href="${repositoriesEscape(group.repo_url)}" target="_blank" rel="noreferrer">View on GitHub ${repositoriesArrowIcon()}</a>`
      : "";

    return `
      <section class="repositories-view-drawer-section">
        <span class="repositories-view-drawer-section-label">Overview</span>
        <div class="repositories-view-card-stats" style="border-top:0;padding-top:0;">
          <div class="repositories-view-card-stat verified">
            <span class="repositories-view-card-stat-dot" aria-hidden="true"></span>
            <span class="repositories-view-card-stat-label">Verified across audits</span>
            <span class="repositories-view-card-stat-value">${group.claimSummary.verified}</span>
          </div>
          <div class="repositories-view-card-stat flagged">
            <span class="repositories-view-card-stat-dot" aria-hidden="true"></span>
            <span class="repositories-view-card-stat-label">Flagged across audits</span>
            <span class="repositories-view-card-stat-value">${group.claimSummary.flagged}</span>
          </div>
          <div class="repositories-view-card-stat review">
            <span class="repositories-view-card-stat-dot" aria-hidden="true"></span>
            <span class="repositories-view-card-stat-label">Needs review across audits</span>
            <span class="repositories-view-card-stat-value">${group.claimSummary.needs_review}</span>
          </div>
        </div>
        ${repoLink}
      </section>
      <section class="repositories-view-drawer-section">
        <span class="repositories-view-drawer-section-label">Audit history</span>
        <ul class="repositories-view-history">${historyItems || ""}</ul>
      </section>
      <section class="repositories-view-drawer-section">
        <span class="repositories-view-drawer-section-label">Most-cited evidence</span>
        <ul class="repositories-view-evidence">${evidenceItems}</ul>
      </section>
    `;
  }

  function repositoriesSort(groups, mode) {
    const arr = groups.slice();
    if (mode === "score") {
      arr.sort((a, b) => (b.latestScore ?? -1) - (a.latestScore ?? -1));
    } else if (mode === "count") {
      arr.sort((a, b) => b.auditCount - a.auditCount);
    } else {
      arr.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    }
    return arr;
  }

  function repositoriesFilter(groups, query) {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) =>
      g.name.toLowerCase().includes(q) || (g.repo_url || "").toLowerCase().includes(q)
    );
  }

  window.setupRepositoriesView = function setupRepositoriesView(root) {
    if (!root || root.dataset.repositoriesReady === "true") return;
    root.dataset.repositoriesReady = "true";

    const grid = root.querySelector("[data-repositories-grid]");
    const loading = root.querySelector("[data-repositories-loading]");
    const empty = root.querySelector("[data-repositories-empty]");
    const error = root.querySelector("[data-repositories-error]");
    const errorMsg = root.querySelector("[data-repositories-error-msg]");
    const emptyMsg = root.querySelector("[data-repositories-empty-msg]");
    const countEl = root.querySelector("[data-repositories-count]");
    const status = root.querySelector("[data-repositories-status]");
    const statusLabel = root.querySelector("[data-repositories-status-label]");
    const refreshBtn = root.querySelector("[data-repositories-refresh]");
    const retryBtn = root.querySelector("[data-repositories-retry]");
    const searchInput = root.querySelector("[data-repositories-search]");
    const sortSelect = root.querySelector("[data-repositories-sort]");
    const summaryRepos = root.querySelector('[data-repositories-summary="repos"]');
    const summaryAvg = root.querySelector('[data-repositories-summary="avg"]');
    const summaryLang = root.querySelector('[data-repositories-summary="lang"]');
    const summaryConcerns = root.querySelector('[data-repositories-summary="concerns"]');
    const drawer = root.querySelector("[data-repositories-drawer]");
    const drawerTitle = root.querySelector("[data-repositories-drawer-title]");
    const drawerBody = root.querySelector("[data-repositories-drawer-body]");
    const drawerCloseTargets = root.querySelectorAll("[data-repositories-drawer-close]");

    const state = {
      groups: [],
      filteredGroups: [],
      query: "",
      sort: "latest",
      loaded: false,
    };

    function setStatus(label, mode) {
      if (statusLabel) statusLabel.textContent = label;
      if (status) status.dataset.state = mode || "idle";
    }

    function showState({ showLoading, showEmpty, showError, message }) {
      if (loading) loading.hidden = !showLoading;
      if (empty) empty.hidden = !showEmpty;
      if (error) error.hidden = !showError;
      if (showError && errorMsg && message) errorMsg.textContent = message;
      if (showEmpty && emptyMsg && message) emptyMsg.textContent = message;
    }

    function renderSummary(groups) {
      const visible = groups;
      const repos = visible.length;
      const scored = visible.filter((g) => typeof g.latestScore === "number");
      const avg = scored.length
        ? Math.round(scored.reduce((acc, g) => acc + g.latestScore, 0) / scored.length)
        : null;
      const langCounts = new Map();
      for (const g of visible) {
        if (!g.language) continue;
        langCounts.set(g.language, (langCounts.get(g.language) || 0) + 1);
      }
      const topLang = Array.from(langCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      const concerns = visible.filter((g) => g.hasConcerns).length;

      if (summaryRepos) summaryRepos.textContent = String(repos);
      if (summaryAvg) summaryAvg.textContent = avg !== null ? String(avg) : "--";
      if (summaryLang) summaryLang.textContent = topLang ? topLang[0] : "--";
      if (summaryConcerns) summaryConcerns.textContent = String(concerns);
    }

    function render() {
      if (!grid) return;
      let visible = repositoriesFilter(state.groups, state.query);
      const onlyDemo = state.groups.length > 0 && state.groups.every((g) => g.isDemo);
      if (!onlyDemo) {
        visible = visible.filter((g) => !g.isDemo);
      }
      visible = repositoriesSort(visible, state.sort);
      state.filteredGroups = visible;

      if (countEl) {
        countEl.textContent = visible.length === 1 ? "1 shown" : `${visible.length} shown`;
      }

      renderSummary(visible);

      if (!state.loaded) {
        grid.innerHTML = "";
        return;
      }

      if (visible.length === 0) {
        grid.innerHTML = "";
        showState({
          showLoading: false,
          showEmpty: true,
          showError: false,
          message: state.query
            ? "No repositories match that search."
            : "Email a paper plus repo to ReproClaw and the audited codebase will appear here.",
        });
        return;
      }

      showState({ showLoading: false, showEmpty: false, showError: false });
      grid.innerHTML = visible.map(repositoriesRenderCard).join("");
    }

    function openDrawer(group) {
      if (!drawer || !drawerBody || !drawerTitle) return;
      drawerTitle.textContent = group.name;
      drawerBody.innerHTML = repositoriesRenderDrawerBody(group);
      drawer.hidden = false;
      drawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
      if (!drawer) return;
      drawer.hidden = true;
      drawer.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    async function load() {
      setStatus("Loading", "loading");
      showState({ showLoading: true, showEmpty: false, showError: false });
      try {
        const res = await fetch("/audits", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const audits = Array.isArray(data) ? data : Array.isArray(data && data.audits) ? data.audits : [];
        state.groups = repositoriesGroup(audits);
        state.loaded = true;
        showState({ showLoading: false, showEmpty: false, showError: false });
        setStatus(`Synced ${repositoriesRelativeTime(Date.now())}`, "idle");
        render();
      } catch (err) {
        state.loaded = true;
        state.groups = [];
        showState({
          showLoading: false,
          showEmpty: false,
          showError: true,
          message: err && err.message ? `The audits endpoint returned: ${err.message}` : "The audits endpoint did not respond.",
        });
        setStatus("Failed", "error");
        if (grid) grid.innerHTML = "";
        renderSummary([]);
      }
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.query = e.target.value || "";
        render();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        state.sort = e.target.value || "latest";
        render();
      });
    }

    if (refreshBtn) refreshBtn.addEventListener("click", load);
    if (retryBtn) retryBtn.addEventListener("click", load);

    if (grid) {
      grid.addEventListener("click", (event) => {
        const link = event.target.closest("[data-repositories-card-link]");
        if (link) {
          event.stopPropagation();
          return;
        }
        const card = event.target.closest("[data-repositories-card-key]");
        if (!card) return;
        const key = card.getAttribute("data-repositories-card-key");
        const group = state.filteredGroups.find((g) => g.key === key) || state.groups.find((g) => g.key === key);
        if (group) openDrawer(group);
      });
    }

    drawerCloseTargets.forEach((el) => el.addEventListener("click", closeDrawer));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer && !drawer.hidden) closeDrawer();
    });

    load();
  };
})();
