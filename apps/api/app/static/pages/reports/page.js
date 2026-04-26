window.setupReportsView = function (root) {
  if (!root || root.dataset.reportsBound === "1") return;
  root.dataset.reportsBound = "1";

  const state = {
    reports: [],
    filtered: [],
    selectedId: null,
    search: "",
    band: "all",
    date: "all",
    loading: true,
    error: null,
    lastSyncAt: null,
  };

  const el = {
    syncLabel: root.querySelector("[data-reports-sync-label]"),
    syncPill: root.querySelector(".reports-sync-pill"),
    refresh: root.querySelector("[data-reports-refresh]"),
    search: root.querySelector("[data-reports-search]"),
    bandChips: root.querySelector("[data-reports-band-chips]"),
    dateChips: root.querySelector("[data-reports-date-chips]"),
    statTotal: root.querySelector('[data-reports-stat="total"]'),
    statAvg: root.querySelector('[data-reports-stat="avg"]'),
    statStrong: root.querySelector('[data-reports-stat="strong"]'),
    statFlagged: root.querySelector('[data-reports-stat="flagged"]'),
    list: root.querySelector("[data-reports-list]"),
    listState: root.querySelector("[data-reports-list-state]"),
    count: root.querySelector("[data-reports-count]"),
    readerEmpty: root.querySelector("[data-reports-reader-empty]"),
    readerBody: root.querySelector("[data-reports-reader-body]"),
    readerSubject: root.querySelector("[data-reports-reader-subject]"),
    readerMeta: root.querySelector("[data-reports-reader-meta]"),
    readerScore: root.querySelector("[data-reports-reader-score]"),
    readerProgress: root.querySelector("[data-reports-reader-progress]"),
    readerBand: root.querySelector("[data-reports-reader-band]"),
    readerBandDot: root.querySelector("[data-reports-reader-band-dot]"),
    readerCounts: {
      verified: root.querySelector("[data-reports-count-verified]"),
      flagged: root.querySelector("[data-reports-count-flagged]"),
      review: root.querySelector("[data-reports-count-review]"),
      unsupported: root.querySelector("[data-reports-count-unsupported]"),
    },
    readerDoc: root.querySelector("[data-reports-reader-doc]"),
    copyButton: root.querySelector("[data-reports-copy]"),
    openLink: root.querySelector("[data-reports-open]"),
  };

  function reportsEscape(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function reportsBandFor(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return { key: "concerns", label: "Unscored" };
    if (value >= 85) return { key: "strong", label: "Strongly reproducible" };
    if (value >= 70) return { key: "concerns", label: "Mostly reproducible" };
    if (value >= 50) return { key: "significant", label: "Significant concerns" };
    return { key: "not", label: "Not reproducible" };
  }

  function reportsRelativeTime(iso) {
    if (!iso) return "moments ago";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "moments ago";
    const diff = Date.now() - then;
    const sec = Math.max(1, Math.round(diff / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const day = Math.round(hr / 24);
    if (day < 7) return `${day} d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function reportsFormatDate(iso) {
    if (!iso) return "Unknown";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function reportsTitleFor(audit) {
    return (
      audit.paper_title ||
      audit.title ||
      audit.paper_url ||
      audit.subject ||
      `Audit ${audit.id || ""}`.trim()
    );
  }

  function reportsRepoFor(audit) {
    if (!audit.repo_url) return "no repo";
    return String(audit.repo_url).replace(/^https?:\/\/(www\.)?github\.com\//, "");
  }

  function reportsCountClaims(audit) {
    const claims = Array.isArray(audit.claims) ? audit.claims : [];
    const counts = { verified: 0, flagged: 0, needs_review: 0, unsupported: 0, total: claims.length };
    for (const claim of claims) {
      const verdict = claim && (claim.verdict || (claim.audit_verdict && claim.audit_verdict.verdict));
      if (verdict && counts[verdict] !== undefined) counts[verdict] += 1;
    }
    return counts;
  }

  function reportsTopTag(counts) {
    if (counts.flagged > 0) return { kind: "flagged", label: `${counts.flagged} flagged` };
    if (counts.needs_review > 0) return { kind: "review", label: `${counts.needs_review} needs review` };
    if (counts.unsupported > 0) return { kind: "unsupported", label: `${counts.unsupported} unsupported` };
    if (counts.verified > 0) return { kind: "clean", label: `${counts.verified} verified` };
    return { kind: "unsupported", label: "no claims" };
  }

  function reportsWithinDate(iso, mode) {
    if (mode === "all") return true;
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    const now = Date.now();
    if (mode === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return t >= start.getTime();
    }
    const days = Number(mode);
    if (!Number.isFinite(days)) return true;
    return now - t <= days * 24 * 60 * 60 * 1000;
  }

  async function reportsFetch() {
    state.loading = true;
    state.error = null;
    reportsRenderList();
    reportsSetSync("Syncing...");
    try {
      const response = await fetch("/audits", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data : Array.isArray(data && data.audits) ? data.audits : [];
      state.reports = items
        .filter((a) => a && a.status === "done" && typeof a.report_text === "string" && a.report_text.trim().length > 0)
        .sort((a, b) => {
          const ta = new Date(a.completed_at || a.updated_at || a.created_at || 0).getTime();
          const tb = new Date(b.completed_at || b.updated_at || b.created_at || 0).getTime();
          return tb - ta;
        });
      state.lastSyncAt = new Date().toISOString();
      state.loading = false;
      reportsApplyFilters();
      if (state.selectedId && !state.reports.find((r) => String(r.id) === String(state.selectedId))) {
        state.selectedId = null;
        reportsRenderReader();
      }
      reportsSetSync(`Synced ${reportsRelativeTime(state.lastSyncAt)}`);
    } catch (err) {
      state.loading = false;
      state.error = err && err.message ? err.message : "Failed to load reports";
      state.reports = [];
      state.filtered = [];
      reportsRenderList();
      reportsRenderSummary();
      reportsSetSync("Sync failed");
    }
  }

  function reportsApplyFilters() {
    const q = state.search.trim().toLowerCase();
    state.filtered = state.reports.filter((report) => {
      const band = reportsBandFor(report.score).key;
      if (state.band !== "all" && state.band !== band) return false;
      if (!reportsWithinDate(report.completed_at || report.updated_at || report.created_at, state.date)) return false;
      if (!q) return true;
      const haystack = [
        reportsTitleFor(report),
        reportsRepoFor(report),
        report.report_text,
        reportsBandFor(report.score).label,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    reportsRenderList();
    reportsRenderSummary();
  }

  function reportsSetSync(text) {
    if (el.syncLabel) el.syncLabel.textContent = text;
    if (el.syncPill) {
      const stateName = state.error ? "failed" : state.loading ? "searching" : "idle";
      el.syncPill.dataset.state = stateName;
    }
  }

  function reportsRenderSummary() {
    const visible = state.filtered;
    const total = visible.length;
    el.statTotal.textContent = String(total);
    if (total === 0) {
      el.statAvg.textContent = "--";
      el.statStrong.textContent = "--";
      el.statFlagged.textContent = "--";
      return;
    }
    const sum = visible.reduce((acc, r) => acc + (Number(r.score) || 0), 0);
    const strong = visible.filter((r) => reportsBandFor(r.score).key === "strong").length;
    const flagged = visible.filter((r) => {
      const k = reportsBandFor(r.score).key;
      return k === "significant" || k === "not";
    }).length;
    el.statAvg.textContent = String(Math.round(sum / total));
    el.statStrong.textContent = `${Math.round((strong / total) * 100)}%`;
    el.statFlagged.textContent = `${Math.round((flagged / total) * 100)}%`;
  }

  function reportsRenderList() {
    if (state.loading) {
      el.list.innerHTML = '<div class="reports-list-state"><p>Loading reports...</p></div>';
      el.count.textContent = "Loading...";
      return;
    }
    if (state.error) {
      el.list.innerHTML = `<div class="reports-list-state error"><p>${reportsEscape(state.error)}</p></div>`;
      el.count.textContent = "Sync failed";
      return;
    }
    if (state.reports.length === 0) {
      el.list.innerHTML = '<div class="reports-list-state"><p>No completed audits with reports yet. They appear here once ReproClaw mails them back.</p></div>';
      el.count.textContent = "0 reports";
      return;
    }
    if (state.filtered.length === 0) {
      el.list.innerHTML = '<div class="reports-list-state"><p>No reports match the current filters.</p></div>';
      el.count.textContent = `0 of ${state.reports.length} reports`;
      return;
    }

    el.count.textContent = `${state.filtered.length} of ${state.reports.length} reports`;
    const html = state.filtered
      .map((report) => {
        const id = report.id;
        const band = reportsBandFor(report.score);
        const counts = reportsCountClaims(report);
        const tag = reportsTopTag(counts);
        const date = reportsFormatDate(report.completed_at || report.updated_at || report.created_at);
        const active = String(state.selectedId) === String(id) ? " active" : "";
        const score = Number(report.score);
        const scoreText = Number.isFinite(score) ? String(Math.round(score)) : "--";
        return `
          <button type="button" class="reports-row${active}" role="listitem" data-reports-row="${reportsEscape(id)}">
            <span class="reports-row-title" title="${reportsEscape(reportsTitleFor(report))}">${reportsEscape(reportsTitleFor(report))}</span>
            <span class="reports-row-score band-${band.key}">${reportsEscape(scoreText)}</span>
            <span class="reports-row-repo" title="${reportsEscape(reportsRepoFor(report))}">${reportsEscape(reportsRepoFor(report))}</span>
            <span class="reports-row-foot">
              <span class="reports-row-date">${reportsEscape(date)}</span>
              <span class="reports-row-tag ${reportsEscape(tag.kind)}">${reportsEscape(tag.label)}</span>
            </span>
          </button>`;
      })
      .join("");
    el.list.innerHTML = html;
  }

  function reportsParseSections(text) {
    const lines = String(text || "").split(/\r?\n/);
    const sections = [];
    let current = { heading: "Message", lines: [] };

    function flush() {
      while (current.lines.length && !current.lines[0].trim()) current.lines.shift();
      while (current.lines.length && !current.lines[current.lines.length - 1].trim()) current.lines.pop();
      sections.push(current);
    }

    const headingMatch = /^([A-Z][A-Za-z ]{2,40}):\s*$/;
    for (const line of lines) {
      const m = line.match(headingMatch);
      if (m) {
        flush();
        current = { heading: m[1], lines: [] };
        continue;
      }
      current.lines.push(line);
    }
    flush();
    return sections;
  }

  function reportsParseFindings(body) {
    const items = [];
    const lines = body.split(/\r?\n/);
    let current = null;
    const startRe = /^\s*(\d+)\.\s+(\w[\w_]*)\s+Claim:\s+(.*)$/;
    const evRe = /^\s+Evidence:\s+(.*)$/;
    const reasonRe = /^\s+Reason:\s+(.*)$/;
    let any = false;
    for (const line of lines) {
      const sm = line.match(startRe);
      if (sm) {
        if (current) items.push(current);
        current = { num: sm[1], verdict: sm[2], claim: sm[3], evidence: "", reason: "" };
        any = true;
        continue;
      }
      if (!current) continue;
      const em = line.match(evRe);
      if (em) {
        current.evidence = em[1];
        continue;
      }
      const rm = line.match(reasonRe);
      if (rm) {
        current.reason = rm[1];
        continue;
      }
      if (line.trim()) {
        current.claim += " " + line.trim();
      }
    }
    if (current) items.push(current);
    return any ? items : null;
  }

  function reportsRenderSection(section) {
    const heading = section.heading;
    const body = section.lines.join("\n");
    if (!body.trim()) return "";

    if (/^Top Findings$/i.test(heading)) {
      const findings = reportsParseFindings(body);
      if (findings && findings.length > 0) {
        const items = findings
          .map((f) => `
            <article class="reports-doc-finding">
              <div class="reports-doc-finding-head">
                <span class="reports-doc-finding-num">FINDING ${reportsEscape(f.num)}</span>
                <span class="badge ${reportsEscape(f.verdict)}">${reportsEscape(f.verdict.replace(/_/g, " "))}</span>
              </div>
              <p class="reports-doc-finding-claim">${reportsEscape(f.claim)}</p>
              <dl class="reports-doc-finding-row"><dt>Evidence</dt><dd>${reportsEscape(f.evidence || "no evidence path")}</dd></dl>
              ${f.reason ? `<dl class="reports-doc-finding-row"><dt>Reason</dt><dd class="prose">${reportsEscape(f.reason)}</dd></dl>` : ""}
            </article>`)
          .join("");
        return `<section class="reports-doc-section"><h3 class="reports-doc-heading">${reportsEscape(heading)}</h3>${items}</section>`;
      }
    }

    if (/^(Summary|Limitations)$/i.test(heading)) {
      return `<section class="reports-doc-section"><h3 class="reports-doc-heading">${reportsEscape(heading)}</h3><p class="reports-doc-meta">${reportsEscape(body.trim())}</p></section>`;
    }

    if (/^Message$/i.test(heading)) {
      const trimmed = body.trim();
      if (!trimmed) return "";
      const paperLine = trimmed.match(/Paper:\s*(.*)/);
      const repoLine = trimmed.match(/Repo:\s*(.*)/);
      const scoreLine = trimmed.match(/Reproducibility Score:\s*(.*)/);
      const intro = trimmed.split(/\n\s*\n/)[0];
      const parts = [];
      parts.push(`<p class="reports-doc-meta">${reportsEscape(intro)}</p>`);
      if (paperLine) parts.push(`<p class="reports-doc-meta"><span class="mono">Paper:</span> ${reportsEscape(paperLine[1])}</p>`);
      if (repoLine) parts.push(`<p class="reports-doc-meta"><span class="mono">Repo:</span> ${reportsEscape(repoLine[1])}</p>`);
      if (scoreLine) parts.push(`<p class="reports-doc-meta"><span class="mono">Reproducibility Score:</span> ${reportsEscape(scoreLine[1])}</p>`);
      return `<section class="reports-doc-section">${parts.join("")}</section>`;
    }

    return `<section class="reports-doc-section"><h3 class="reports-doc-heading">${reportsEscape(heading)}</h3><pre class="reports-doc-pre">${reportsEscape(body)}</pre></section>`;
  }

  function reportsRenderReport(report) {
    const sections = reportsParseSections(report.report_text);
    return sections.map(reportsRenderSection).filter(Boolean).join('<hr class="reports-doc-divider" />');
  }

  function reportsRenderReader() {
    const id = state.selectedId;
    const report = id ? state.reports.find((r) => String(r.id) === String(id)) : null;
    if (!report) {
      el.readerEmpty.hidden = false;
      el.readerBody.hidden = true;
      return;
    }
    el.readerEmpty.hidden = true;
    el.readerBody.hidden = false;

    const band = reportsBandFor(report.score);
    const score = Number(report.score);
    const scoreText = Number.isFinite(score) ? String(Math.round(score)) : "--";
    const counts = reportsCountClaims(report);
    const date = reportsFormatDate(report.completed_at || report.updated_at || report.created_at);
    const subject = `Reproducibility audit: ${reportsTitleFor(report)}`;

    el.readerSubject.textContent = subject;
    el.readerMeta.textContent = `Audit ${report.id || "--"} · ${date}`;
    el.readerScore.textContent = scoreText;
    if (el.readerProgress) {
      const pct = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
      el.readerProgress.style.width = `${pct}%`;
    }
    el.readerBand.textContent = band.label;
    el.readerBandDot.className = `reports-band-dot band-${band.key}`;
    el.readerCounts.verified.textContent = String(counts.verified);
    el.readerCounts.flagged.textContent = String(counts.flagged);
    el.readerCounts.review.textContent = String(counts.needs_review);
    el.readerCounts.unsupported.textContent = String(counts.unsupported);

    el.openLink.href = `/dashboard?audit=${encodeURIComponent(report.id || "")}`;
    el.readerDoc.innerHTML = reportsRenderReport(report);
  }

  function reportsBindEvents() {
    el.refresh.addEventListener("click", () => {
      reportsFetch();
    });

    let searchTimer = null;
    el.search.addEventListener("input", (event) => {
      const value = event.target.value || "";
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.search = value;
        reportsApplyFilters();
      }, 120);
    });

    el.bandChips.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-reports-band]");
      if (!btn) return;
      state.band = btn.dataset.reportsBand;
      el.bandChips.querySelectorAll(".reports-chip").forEach((b) => b.classList.toggle("active", b === btn));
      reportsApplyFilters();
    });

    el.dateChips.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-reports-date]");
      if (!btn) return;
      state.date = btn.dataset.reportsDate;
      el.dateChips.querySelectorAll(".reports-chip").forEach((b) => b.classList.toggle("active", b === btn));
      reportsApplyFilters();
    });

    el.list.addEventListener("click", (event) => {
      const row = event.target.closest("[data-reports-row]");
      if (!row) return;
      const id = row.dataset.reportsRow;
      if (!id) return;
      state.selectedId = id;
      el.list.querySelectorAll(".reports-row").forEach((r) => r.classList.toggle("active", r === row));
      reportsRenderReader();
    });

    el.copyButton.addEventListener("click", async () => {
      const id = state.selectedId;
      const report = id ? state.reports.find((r) => String(r.id) === String(id)) : null;
      if (!report) return;
      const text = report.report_text || "";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        const original = el.copyButton.textContent;
        el.copyButton.textContent = "Copied";
        el.copyButton.classList.add("reports-copy-flash");
        window.setTimeout(() => {
          el.copyButton.textContent = original;
          el.copyButton.classList.remove("reports-copy-flash");
        }, 1400);
      } catch (err) {
        const original = el.copyButton.textContent;
        el.copyButton.textContent = "Copy failed";
        window.setTimeout(() => {
          el.copyButton.textContent = original;
        }, 1400);
      }
    });
  }

  reportsBindEvents();
  reportsFetch();

  return {
    refresh: reportsFetch,
  };
};
