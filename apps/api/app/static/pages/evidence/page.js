window.setupEvidenceView = function (root) {
  if (!root) return;

  const state = {
    audits: [],
    rows: [],
    filtered: [],
    selectedId: null,
    loading: false,
    error: null,
    filters: { search: "", verdict: "", retrieval: "" },
    retrievalMethods: new Set(),
  };

  const els = {
    listPanel: root.querySelector("[data-evidence-list]"),
    listSummary: root.querySelector("[data-evidence-list-summary]"),
    loading: root.querySelector("[data-evidence-loading]"),
    empty: root.querySelector("[data-evidence-empty]"),
    error: root.querySelector("[data-evidence-error]"),
    errorText: root.querySelector("[data-evidence-error-text]"),
    pill: root.querySelector("[data-evidence-pill]"),
    pillText: root.querySelector("[data-evidence-pill-text]"),
    inputSearch: root.querySelector('[data-evidence-input="search"]'),
    inputVerdict: root.querySelector('[data-evidence-input="verdict"]'),
    inputRetrieval: root.querySelector('[data-evidence-input="retrieval"]'),
    refreshBtn: root.querySelector('[data-evidence-input="refresh"]'),
    statRows: root.querySelector('[data-evidence-stat="rows"]'),
    statFiles: root.querySelector('[data-evidence-stat="files"]'),
    statRepos: root.querySelector('[data-evidence-stat="repos"]'),
    statFlaggedPct: root.querySelector('[data-evidence-stat="flaggedPct"]'),
    detail: root.querySelector("[data-evidence-detail]"),
    detailEmpty: root.querySelector("[data-evidence-detail-empty]"),
    detailBody: root.querySelector("[data-evidence-detail-body]"),
    detailAudit: root.querySelector("[data-evidence-detail-audit]"),
    detailPath: root.querySelector("[data-evidence-detail-path]"),
    detailRange: root.querySelector("[data-evidence-detail-range]"),
    detailVerdict: root.querySelector("[data-evidence-detail-verdict]"),
    detailSeverity: root.querySelector("[data-evidence-detail-severity]"),
    detailClaim: root.querySelector("[data-evidence-detail-claim]"),
    detailSnippet: root.querySelector("[data-evidence-detail-snippet]"),
    detailReason: root.querySelector("[data-evidence-detail-reason]"),
    detailRetrieval: root.querySelector("[data-evidence-detail-retrieval]"),
    detailConfidence: root.querySelector("[data-evidence-detail-confidence]"),
    detailSource: root.querySelector("[data-evidence-detail-source]"),
    detailLink: root.querySelector("[data-evidence-detail-link]"),
  };

  const LANG_BY_EXT = {
    py: "python", js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    md: "markdown", json: "json", yml: "yaml", yaml: "yaml", toml: "toml",
    sh: "shell", bash: "shell", rb: "ruby", go: "go", rs: "rust",
    java: "java", c: "c", h: "c", cc: "c++", cpp: "c++", hpp: "c++",
    cs: "c#", php: "php", swift: "swift", kt: "kotlin", scala: "scala",
    html: "html", css: "css", scss: "scss", sql: "sql", r: "r",
    ipynb: "notebook", txt: "text", lock: "lock", cfg: "config",
    ini: "config", env: "config", dockerfile: "docker",
  };

  function evidenceEscape(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function evidenceLanguageFor(path) {
    if (!path) return "text";
    const lower = String(path).toLowerCase();
    if (lower.endsWith("dockerfile") || lower.includes("/dockerfile")) return "docker";
    const ext = lower.split(".").pop();
    return LANG_BY_EXT[ext] || "text";
  }

  function evidenceTruncateMiddle(path, max) {
    if (!path) return "";
    const text = String(path);
    if (text.length <= max) return text;
    const head = Math.ceil((max - 1) / 2);
    const tail = Math.floor((max - 1) / 2);
    return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
  }

  function evidenceFirstLines(snippet, n) {
    if (!snippet) return "";
    const lines = String(snippet).split(/\r?\n/);
    return lines.slice(0, n).join("\n");
  }

  function evidenceClaimPreview(text) {
    if (!text) return "";
    const flat = String(text).replace(/\s+/g, " ").trim();
    return flat.length > 160 ? flat.slice(0, 159) + "…" : flat;
  }

  function evidenceRowId(row) {
    return `${row.audit_id}::${row.claim_id || "_"}::${row.path || "_"}::${row.line_start || 0}`;
  }

  function evidenceFlatten(audits) {
    const rows = [];
    state.retrievalMethods = new Set();
    for (const audit of audits || []) {
      const auditId = audit.audit_id || audit.id;
      const repoUrl = audit.repo_url || audit.repository || "";
      const claims = Array.isArray(audit.claims) ? audit.claims : [];
      for (const claim of claims) {
        const claimId = claim.claim_id || claim.id || "";
        const verdict = (claim.verdict || "needs_review").toLowerCase();
        const severity = (claim.severity || "").toLowerCase();
        const claimText = claim.claim_text || claim.text || claim.statement || "";
        const reason = claim.reason || claim.rationale || claim.explanation || "";
        const evidence = Array.isArray(claim.evidence) ? claim.evidence : [];
        for (const ev of evidence) {
          const method = ev.retrieval_method || "unknown";
          state.retrievalMethods.add(method);
          rows.push({
            audit_id: auditId,
            repo_url: repoUrl,
            claim_id: claimId,
            verdict,
            severity,
            claim_text: claimText,
            reason,
            path: ev.path || "",
            snippet: ev.snippet || "",
            line_start: ev.line_start || null,
            line_end: ev.line_end || null,
            retrieval_method: method,
            alignment_confidence: typeof ev.alignment_confidence === "number" ? ev.alignment_confidence : null,
            source_type: ev.source_type || "code",
          });
        }
      }
    }
    return rows;
  }

  function evidenceUpdateRetrievalFilter() {
    if (!els.inputRetrieval) return;
    const previous = els.inputRetrieval.value;
    const methods = Array.from(state.retrievalMethods).sort();
    const opts = ['<option value="">All retrieval</option>'];
    for (const m of methods) {
      opts.push(`<option value="${evidenceEscape(m)}">${evidenceEscape(m)}</option>`);
    }
    els.inputRetrieval.innerHTML = opts.join("");
    if (previous && state.retrievalMethods.has(previous)) {
      els.inputRetrieval.value = previous;
    }
  }

  function evidenceApplyFilters() {
    const { search, verdict, retrieval } = state.filters;
    const needle = search.trim().toLowerCase();
    state.filtered = state.rows.filter((row) => {
      if (verdict && row.verdict !== verdict) return false;
      if (retrieval && row.retrieval_method !== retrieval) return false;
      if (needle) {
        const hay = `${row.path} ${row.repo_url}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }

  function evidenceUpdateStats() {
    if (!els.statRows) return;
    const rows = state.rows;
    const files = new Set(rows.map((r) => r.path).filter(Boolean));
    const repos = new Set(rows.map((r) => r.repo_url).filter(Boolean));
    const flaggedRows = rows.filter((r) => r.verdict === "flagged" || r.verdict === "unsupported");
    const pct = rows.length ? Math.round((flaggedRows.length / rows.length) * 100) : 0;
    els.statRows.textContent = String(rows.length);
    els.statFiles.textContent = String(files.size);
    els.statRepos.textContent = String(repos.size);
    els.statFlaggedPct.textContent = rows.length ? `${pct}%` : "--";
  }

  function evidenceSetPill(stateName, label) {
    if (!els.pill) return;
    els.pill.dataset.state = stateName;
    if (els.pillText) els.pillText.textContent = label;
  }

  function evidenceShowList() {
    if (els.loading) els.loading.hidden = true;
    if (els.empty) els.empty.hidden = state.filtered.length > 0;
    if (els.error) els.error.hidden = true;
  }

  function evidenceRender() {
    if (!els.listPanel) return;
    if (state.loading) {
      if (els.loading) els.loading.hidden = false;
      if (els.empty) els.empty.hidden = true;
      if (els.error) els.error.hidden = true;
      els.listSummary.textContent = "Loading evidence…";
      return;
    }
    if (state.error) {
      if (els.loading) els.loading.hidden = true;
      if (els.empty) els.empty.hidden = true;
      if (els.error) {
        els.error.hidden = false;
        if (els.errorText) els.errorText.textContent = state.error;
      }
      els.listSummary.textContent = "Could not load evidence.";
      return;
    }
    evidenceApplyFilters();
    evidenceShowList();

    const total = state.filtered.length;
    els.listSummary.textContent = total
      ? `${total} snippet${total === 1 ? "" : "s"} across ${new Set(state.filtered.map((r) => r.audit_id)).size} audit${total === 1 ? "" : "s"}`
      : "No snippets match the current filters.";

    if (!total) {
      const groupsHtml = `<div class="evidence-shimmer-group" data-evidence-loading hidden></div>`;
      els.listPanel.innerHTML = groupsHtml;
      return;
    }

    const grouped = new Map();
    for (const row of state.filtered) {
      const key = `${row.audit_id}::${row.path}`;
      if (!grouped.has(key)) grouped.set(key, { audit_id: row.audit_id, path: row.path, items: [] });
      grouped.get(key).items.push(row);
    }

    const html = [];
    for (const group of grouped.values()) {
      const lang = evidenceLanguageFor(group.path);
      html.push(`<div class="evidence-group">`);
      html.push(
        `<div class="evidence-group-head">` +
          `<span class="evidence-group-path" title="${evidenceEscape(group.path)}">${evidenceEscape(evidenceTruncateMiddle(group.path, 64))}</span>` +
          `<span class="evidence-chip evidence-chip-audit">${evidenceEscape(String(group.audit_id).slice(0, 8))}</span>` +
          `<span class="evidence-group-count">${group.items.length}</span>` +
        `</div>`
      );
      for (const row of group.items) {
        const id = evidenceRowId(row);
        const isActive = id === state.selectedId;
        const preview = evidenceFirstLines(row.snippet, 6);
        const verdictClass = ["verified", "flagged", "needs_review", "unsupported"].includes(row.verdict)
          ? row.verdict
          : "needs_review";
        html.push(
          `<button type="button" class="evidence-card${isActive ? " is-active" : ""}" data-evidence-id="${evidenceEscape(id)}">` +
            `<div class="evidence-card-top">` +
              `<span class="evidence-card-path" title="${evidenceEscape(row.path)}">${evidenceEscape(evidenceTruncateMiddle(row.path, 56))}</span>` +
              `<span class="evidence-card-lang">${evidenceEscape(lang)}</span>` +
            `</div>` +
            `<pre class="evidence-card-snippet">${evidenceEscape(preview) || "<em>(no preview)</em>"}</pre>` +
            `<p class="evidence-card-claim" title="${evidenceEscape(row.claim_text)}">${evidenceEscape(evidenceClaimPreview(row.claim_text)) || "<em>No claim text</em>"}</p>` +
            `<div class="evidence-card-foot">` +
              `<span class="badge ${verdictClass}">${evidenceEscape(verdictClass.replace("_", " "))}</span>` +
              `<span class="evidence-chip evidence-chip-method">${evidenceEscape(row.retrieval_method)}</span>` +
              `<span class="evidence-chip">${evidenceEscape(`audit ${String(row.audit_id).slice(0, 8)}`)}</span>` +
            `</div>` +
          `</button>`
        );
      }
      html.push(`</div>`);
    }
    els.listPanel.innerHTML = html.join("");

    els.listPanel.querySelectorAll(".evidence-card").forEach((node) => {
      node.addEventListener("click", () => {
        const id = node.getAttribute("data-evidence-id");
        evidenceSelect(id);
      });
    });
  }

  function evidenceSelect(id) {
    state.selectedId = id;
    const row = state.filtered.find((r) => evidenceRowId(r) === id) || state.rows.find((r) => evidenceRowId(r) === id);
    els.listPanel.querySelectorAll(".evidence-card").forEach((node) => {
      node.classList.toggle("is-active", node.getAttribute("data-evidence-id") === id);
    });
    evidenceRenderDetail(row);
  }

  function evidenceRenderDetail(row) {
    if (!els.detail) return;
    if (!row) {
      if (els.detailEmpty) els.detailEmpty.hidden = false;
      if (els.detailBody) els.detailBody.hidden = true;
      return;
    }
    if (els.detailEmpty) els.detailEmpty.hidden = true;
    if (els.detailBody) els.detailBody.hidden = false;

    const verdictClass = ["verified", "flagged", "needs_review", "unsupported"].includes(row.verdict)
      ? row.verdict
      : "needs_review";

    if (els.detailAudit) els.detailAudit.textContent = `Audit · ${String(row.audit_id || "").slice(0, 12)}`;
    if (els.detailPath) els.detailPath.textContent = row.path || "(no path)";
    if (els.detailRange) {
      if (row.line_start && row.line_end) {
        els.detailRange.textContent = `Lines ${row.line_start}–${row.line_end}`;
      } else if (row.line_start) {
        els.detailRange.textContent = `Line ${row.line_start}`;
      } else {
        els.detailRange.textContent = "Line range unknown";
      }
    }
    if (els.detailVerdict) {
      els.detailVerdict.className = `badge ${verdictClass}`;
      els.detailVerdict.textContent = verdictClass.replace("_", " ");
    }
    if (els.detailSeverity) {
      const sev = (row.severity || "").toLowerCase();
      els.detailSeverity.className = "evidence-severity";
      if (sev === "high" || sev === "critical") els.detailSeverity.classList.add("is-high");
      else if (sev === "medium" || sev === "moderate") els.detailSeverity.classList.add("is-medium");
      else if (sev === "low" || sev === "minor") els.detailSeverity.classList.add("is-low");
      els.detailSeverity.textContent = sev ? `severity ${sev}` : "severity --";
    }
    if (els.detailClaim) els.detailClaim.textContent = row.claim_text || "(no claim text)";
    if (els.detailSnippet) els.detailSnippet.textContent = row.snippet || "(no snippet captured)";
    if (els.detailReason) els.detailReason.textContent = row.reason || "(no reasoning recorded)";
    if (els.detailRetrieval) els.detailRetrieval.textContent = row.retrieval_method || "--";
    if (els.detailConfidence) {
      els.detailConfidence.textContent = row.alignment_confidence != null
        ? `${Math.round(row.alignment_confidence * 100)}%`
        : "--";
    }
    if (els.detailSource) els.detailSource.textContent = row.source_type || "code";
    if (els.detailLink) {
      const href = `/dashboard?audit=${encodeURIComponent(row.audit_id || "")}`;
      els.detailLink.setAttribute("href", href);
    }
  }

  async function evidenceLoad() {
    state.loading = true;
    state.error = null;
    evidenceSetPill("searching", "Loading");
    if (els.refreshBtn) els.refreshBtn.classList.add("is-loading");
    evidenceRender();

    try {
      const res = await fetch("/audits", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const payload = await res.json();
      const audits = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.audits) ? payload.audits : []);
      state.audits = audits;
      state.rows = evidenceFlatten(audits);
      evidenceUpdateRetrievalFilter();
      evidenceUpdateStats();
      state.loading = false;
      evidenceSetPill("idle", `Synced · ${state.rows.length} rows`);
      evidenceRender();
      if (state.selectedId) {
        const stillThere = state.rows.some((r) => evidenceRowId(r) === state.selectedId);
        if (!stillThere) {
          state.selectedId = null;
          evidenceRenderDetail(null);
        } else {
          evidenceSelect(state.selectedId);
        }
      }
    } catch (err) {
      state.loading = false;
      state.error = (err && err.message) ? err.message : "Unknown error";
      evidenceSetPill("failed", "Failed");
      evidenceRender();
    } finally {
      if (els.refreshBtn) els.refreshBtn.classList.remove("is-loading");
    }
  }

  function evidenceWireInputs() {
    if (els.inputSearch) {
      els.inputSearch.addEventListener("input", (e) => {
        state.filters.search = e.target.value || "";
        evidenceRender();
      });
    }
    if (els.inputVerdict) {
      els.inputVerdict.addEventListener("change", (e) => {
        state.filters.verdict = e.target.value || "";
        evidenceRender();
      });
    }
    if (els.inputRetrieval) {
      els.inputRetrieval.addEventListener("change", (e) => {
        state.filters.retrieval = e.target.value || "";
        evidenceRender();
      });
    }
    if (els.refreshBtn) {
      els.refreshBtn.addEventListener("click", () => {
        evidenceLoad();
      });
    }
  }

  evidenceWireInputs();
  evidenceRenderDetail(null);
  evidenceLoad();

  return {
    refresh: evidenceLoad,
    select: evidenceSelect,
  };
};
