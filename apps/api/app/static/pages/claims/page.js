window.setupClaimsView = function (root) {
  if (!root || root.dataset.claimsBound === "1") return;
  root.dataset.claimsBound = "1";

  const VERDICT_LABELS = {
    verified: "verified",
    flagged: "flagged",
    needs_review: "needs review",
    unsupported: "unsupported",
  };

  const VALID_VERDICTS = new Set(Object.keys(VERDICT_LABELS));

  const state = {
    claims: [],
    filter: "all",
    query: "",
    open: new Set(),
    fetchAbort: null,
  };

  const els = {
    status: root.querySelector("[data-claims-status]"),
    statusLabel: root.querySelector("[data-claims-status-label]"),
    refresh: root.querySelector("[data-claims-refresh]"),
    search: root.querySelector("[data-claims-search]"),
    chips: root.querySelector("[data-claims-chips]"),
    body: root.querySelector("[data-claims-body]"),
    region: root.querySelector("[data-claims-region]"),
    loading: root.querySelector("[data-claims-loading]"),
    empty: root.querySelector("[data-claims-empty]"),
    emptyMsg: root.querySelector("[data-claims-empty-msg]"),
    error: root.querySelector("[data-claims-error]"),
    errorMsg: root.querySelector("[data-claims-error-msg]"),
    retry: root.querySelector("[data-claims-retry]"),
    count: root.querySelector("[data-claims-count]"),
    metrics: {
      total: root.querySelector('[data-claims-metric="total"]'),
      verifiedPct: root.querySelector('[data-claims-metric="verified-pct"]'),
      flagged: root.querySelector('[data-claims-metric="flagged"]'),
      needs_review: root.querySelector('[data-claims-metric="needs_review"]'),
    },
  };

  function claimsEscape(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function claimsSetStatus(stateName, label) {
    if (!els.status) return;
    els.status.dataset.state = stateName;
    if (els.statusLabel) els.statusLabel.textContent = label;
  }

  function claimsSetViewState(name) {
    root.dataset.state = name;
    if (els.loading) els.loading.hidden = name !== "loading";
    if (els.empty) els.empty.hidden = name !== "empty";
    if (els.error) els.error.hidden = name !== "error";
  }

  function claimsNormalizeVerdict(value) {
    if (!value) return "needs_review";
    const v = String(value).toLowerCase().replace(/\s+/g, "_");
    return VALID_VERDICTS.has(v) ? v : "needs_review";
  }

  function claimsNormalizeSeverity(value) {
    if (!value) return "";
    const s = String(value).toLowerCase();
    if (s === "high" || s === "medium" || s === "low") return s;
    return s;
  }

  function claimsFlatten(audits) {
    const rows = [];
    if (!Array.isArray(audits)) return rows;
    audits.forEach((audit) => {
      if (!audit || !Array.isArray(audit.claims)) return;
      audit.claims.forEach((claim, idx) => {
        const evidence = Array.isArray(claim && claim.evidence) ? claim.evidence : [];
        const first = evidence[0] || {};
        rows.push({
          claim_id: claim.claim_id || `${audit.audit_id || "aud"}-${idx}`,
          claim_text: claim.claim_text || "",
          verdict: claimsNormalizeVerdict(claim.verdict),
          severity: claimsNormalizeSeverity(claim.severity),
          reason: claim.reason || "",
          evidencePath: first.path || "",
          evidenceSnippet: first.snippet || "",
          evidenceCount: evidence.length,
          audit_id: audit.audit_id || "",
          paper_url: audit.paper_url || "",
          repo_url: audit.repo_url || "",
        });
      });
    });
    return rows;
  }

  function claimsFilter(rows) {
    const q = state.query.trim().toLowerCase();
    return rows.filter((row) => {
      if (state.filter !== "all" && row.verdict !== state.filter) return false;
      if (!q) return true;
      const haystack = `${row.claim_text} ${row.reason}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  function claimsRenderMetrics() {
    const total = state.claims.length;
    let verified = 0;
    let flagged = 0;
    let needsReview = 0;
    state.claims.forEach((c) => {
      if (c.verdict === "verified") verified += 1;
      else if (c.verdict === "flagged") flagged += 1;
      else if (c.verdict === "needs_review") needsReview += 1;
    });
    const pct = total === 0 ? 0 : Math.round((verified / total) * 100);
    if (els.metrics.total) els.metrics.total.textContent = String(total);
    if (els.metrics.verifiedPct) els.metrics.verifiedPct.textContent = `${pct}%`;
    if (els.metrics.flagged) els.metrics.flagged.textContent = String(flagged);
    if (els.metrics.needs_review) els.metrics.needs_review.textContent = String(needsReview);
  }

  function claimsRenderRow(row) {
    const verdict = row.verdict;
    const verdictLabel = VERDICT_LABELS[verdict] || verdict;
    const severityKey = row.severity || "none";
    const severityLabel = row.severity ? row.severity : "—";
    const auditShort = row.audit_id
      ? row.audit_id.length > 14
        ? row.audit_id.slice(0, 14) + "…"
        : row.audit_id
      : "—";
    return `
      <tr class="claims-view-row" data-claim-row data-claim-id="${claimsEscape(row.claim_id)}" tabindex="0">
        <td>
          <div class="claims-view-claim-text">${claimsEscape(row.claim_text || "(no claim text)")}</div>
          <span class="claims-view-claim-id">${claimsEscape(row.claim_id)}</span>
        </td>
        <td><span class="badge ${claimsEscape(verdict)}">${claimsEscape(verdictLabel)}</span></td>
        <td><span class="claims-view-severity" data-severity="${claimsEscape(severityKey)}">${claimsEscape(severityLabel)}</span></td>
        <td><span class="claims-view-mono" title="${claimsEscape(row.evidencePath || "")}">${claimsEscape(row.evidencePath || "—")}</span></td>
        <td><span class="claims-view-mono" title="${claimsEscape(row.audit_id || "")}">${claimsEscape(auditShort)}</span></td>
        <td><div class="claims-view-reason">${claimsEscape(row.reason || "—")}</div></td>
      </tr>
    `;
  }

  function claimsRenderDetail(row) {
    const snippet = row.evidenceSnippet
      ? `<pre class="claims-view-snippet">${claimsEscape(row.evidenceSnippet)}</pre>`
      : `<div class="claims-view-snippet-empty">No evidence snippet recorded for this claim.</div>`;
    const repoLine = row.repo_url
      ? `<span>repo <strong>${claimsEscape(row.repo_url)}</strong></span>`
      : "";
    const paperLine = row.paper_url
      ? `<span>paper <strong>${claimsEscape(row.paper_url)}</strong></span>`
      : "";
    const evidenceCount = `<span>${claimsEscape(String(row.evidenceCount))} evidence file${row.evidenceCount === 1 ? "" : "s"}</span>`;
    const auditLink = row.audit_id
      ? `<a class="claims-view-detail-link" href="/dashboard?audit=${encodeURIComponent(row.audit_id)}" data-claims-audit-link>
          <span>View audit</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 8h9M8 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>`
      : "";
    return `
      <tr class="claims-view-detail" data-claim-detail>
        <td colspan="6">
          <div class="claims-view-detail-inner">
            <div class="claims-view-detail-meta">
              <span>audit <strong>${claimsEscape(row.audit_id || "—")}</strong></span>
              ${evidenceCount}
              ${row.evidencePath ? `<span>path <strong>${claimsEscape(row.evidencePath)}</strong></span>` : ""}
              ${paperLine}
              ${repoLine}
            </div>
            <div>
              <p class="claims-view-snippet-label">Evidence snippet</p>
              ${snippet}
            </div>
            <div class="claims-view-detail-actions">${auditLink}</div>
          </div>
        </td>
      </tr>
    `;
  }

  function claimsRender() {
    if (!els.body) return;
    const visible = claimsFilter(state.claims);
    if (els.count) {
      els.count.textContent = `${visible.length} shown · ${state.claims.length} total`;
    }

    if (state.claims.length === 0) {
      els.body.innerHTML = "";
      if (els.emptyMsg) {
        els.emptyMsg.textContent =
          "Run your first audit and ReproClaw will populate this table with verifiable claim verdicts.";
      }
      claimsSetViewState("empty");
      return;
    }

    if (visible.length === 0) {
      els.body.innerHTML = "";
      if (els.emptyMsg) {
        els.emptyMsg.textContent = "No claims match the current filter. Try clearing the search or selecting All.";
      }
      claimsSetViewState("empty");
      return;
    }

    claimsSetViewState("ready");
    let html = "";
    visible.forEach((row) => {
      html += claimsRenderRow(row);
      if (state.open.has(row.claim_id)) {
        html += claimsRenderDetail(row);
      }
    });
    els.body.innerHTML = html;

    els.body.querySelectorAll("[data-claim-row]").forEach((tr) => {
      const id = tr.getAttribute("data-claim-id");
      if (state.open.has(id)) tr.classList.add("is-open");
    });
  }

  function claimsToggleRow(claimId) {
    if (state.open.has(claimId)) {
      state.open.delete(claimId);
    } else {
      state.open.add(claimId);
    }
    claimsRender();
  }

  async function claimsLoad() {
    if (state.fetchAbort) state.fetchAbort.abort();
    const controller = new AbortController();
    state.fetchAbort = controller;
    claimsSetStatus("loading", "Loading...");
    claimsSetViewState("loading");
    try {
      const res = await fetch("/audits", {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const audits = (data && Array.isArray(data.audits)) ? data.audits : [];
      state.claims = claimsFlatten(audits);
      state.open.clear();
      claimsRenderMetrics();
      claimsRender();
      claimsSetStatus("idle", `Synced · ${state.claims.length} claims`);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      const message = err && err.message ? err.message : "Unknown error";
      if (els.errorMsg) {
        els.errorMsg.textContent = `The audits endpoint did not respond (${message}).`;
      }
      state.claims = [];
      claimsRenderMetrics();
      claimsSetViewState("error");
      claimsSetStatus("error", "Failed");
    } finally {
      if (state.fetchAbort === controller) state.fetchAbort = null;
    }
  }

  if (els.search) {
    let debounce = null;
    els.search.addEventListener("input", (event) => {
      const value = event.target.value || "";
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.query = value;
        claimsRender();
      }, 120);
    });
  }

  if (els.chips) {
    els.chips.addEventListener("click", (event) => {
      const target = event.target.closest("[data-claims-filter]");
      if (!target) return;
      const value = target.getAttribute("data-claims-filter");
      if (!value || value === state.filter) return;
      state.filter = value;
      els.chips.querySelectorAll("[data-claims-filter]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === target);
      });
      claimsRender();
    });
  }

  if (els.body) {
    els.body.addEventListener("click", (event) => {
      if (event.target.closest("[data-claims-audit-link]")) return;
      const row = event.target.closest("[data-claim-row]");
      if (!row) return;
      const id = row.getAttribute("data-claim-id");
      if (id) claimsToggleRow(id);
    });
    els.body.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("[data-claim-row]");
      if (!row) return;
      event.preventDefault();
      const id = row.getAttribute("data-claim-id");
      if (id) claimsToggleRow(id);
    });
  }

  if (els.refresh) {
    els.refresh.addEventListener("click", () => {
      claimsLoad();
    });
  }

  if (els.retry) {
    els.retry.addEventListener("click", () => {
      claimsLoad();
    });
  }

  claimsLoad();
};
