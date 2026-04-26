const params = new URLSearchParams(window.location.search);
let selectedAuditId = params.get("audit");
let selectedClaimId = null;
let currentAudit = null;
let lastSearchResults = [];

const els = {
  startedAgo: document.querySelector("#started-ago"),
  sidebarStatusText: document.querySelector("#sidebar-status-text"),
  dashboardSubtitle: document.querySelector("#dashboard-subtitle"),
  liveStatusText: document.querySelector("#live-status-text"),
  statusDots: document.querySelectorAll(".status-dot, .live-pill span:first-child"),
  scoreOverview: document.querySelector("#score-overview"),
  score: document.querySelector("#score"),
  scoreProgress: document.querySelector("#score-progress"),
  scoreBand: document.querySelector("#score-band"),
  statVerified: document.querySelector("#stat-verified"),
  statFlagged: document.querySelector("#stat-flagged"),
  statNeedsReview: document.querySelector("#stat-needs-review"),
  statTotal: document.querySelector("#stat-total"),
  progressList: document.querySelector("#progress-list"),
  progressRunState: document.querySelector("#progress-run-state"),
  progressCurrentTitle: document.querySelector("#progress-current-title"),
  progressCurrentDescription: document.querySelector("#progress-current-description"),
  auditWorkspace: document.querySelector("#audit-workspace"),
  paperTitle: document.querySelector("#paper-title"),
  paperSubtitle: document.querySelector("#paper-subtitle"),
  paperLink: document.querySelector("#paper-link"),
  repoTitle: document.querySelector("#repo-title"),
  repoSubtitle: document.querySelector("#repo-subtitle"),
  repoLink: document.querySelector("#repo-link"),
  claims: document.querySelector("#claims"),
  refreshButton: document.querySelector("#refresh-button"),
  shareButton: document.querySelector("#share-button"),
  evidencePanel: document.querySelector("#evidence-panel"),
  evidenceClose: document.querySelector("#evidence-close"),
  accountInitials: document.querySelector("#account-initials"),
  evidenceClaimId: document.querySelector("#evidence-claim-id"),
  evidenceClaimText: document.querySelector("#evidence-claim-text"),
  evidencePath: document.querySelector("#evidence-path"),
  evidenceSnippet: document.querySelector("#evidence-snippet"),
  evidenceExplanation: document.querySelector("#evidence-explanation"),
  globalSearchForm: document.querySelector("#global-search-form"),
  globalSearchInput: document.querySelector("#global-search-input"),
  globalSearchSummary: document.querySelector("#global-search-summary"),
  globalSearchResults: document.querySelector("#global-search-results"),
  reportEmailPanel: document.querySelector("#report-email-panel"),
  reportEmailState: document.querySelector("#report-email-state"),
  reportEmailCopy: document.querySelector("#report-email-copy"),
  reportEmailRecipient: document.querySelector("#report-email-recipient"),
  reportEmailDraft: document.querySelector("#report-email-draft"),
  reportEmailSend: document.querySelector("#report-email-send"),
  reportEmailStatus: document.querySelector("#report-email-status"),
};

const progressSteps = [
  {
    title: "Audit request received",
    description: "Audit request queued and ready to run.",
    icon: "email",
    stages: ["queued"],
  },
  {
    title: "Finding the paper",
    description: "Resolving the paper title, URL, or arXiv identifier.",
    icon: "search",
    stages: ["finding_paper"],
  },
  {
    title: "Paper found",
    description: "Paper metadata is ready for the audit.",
    icon: "file",
    stages: ["paper_found"],
  },
  {
    title: "Finding the GitHub repo",
    description: "Searching for a matching implementation repository.",
    icon: "search",
    stages: ["finding_github_repo"],
  },
  {
    title: "GitHub repo found",
    description: "Repository candidate selected for audit.",
    icon: "github",
    stages: ["github_found"],
  },
  {
    title: "Parsing the paper",
    description: "Extracting text and sections from the paper.",
    icon: "file",
    stages: ["parsing_paper", "loading_paper"],
  },
  {
    title: "Paper parsed",
    description: "Paper text is ready for claim analysis.",
    icon: "file",
    stages: ["paper_parsed"],
  },
  {
    title: "Finding the claims",
    description: "Locating concrete, auditable claims.",
    icon: "claims",
    stages: ["finding_claims"],
  },
  {
    title: "Claims extracted",
    description: "Claims are structured for evidence checks.",
    icon: "claims",
    stages: ["claims_extracted", "extracting_claims"],
  },
  {
    title: "Cloning the repo",
    description: "Preparing the repository workspace.",
    icon: "github",
    stages: ["cloning_repo"],
  },
  {
    title: "Repo cloned",
    description: "Repository files are ready for retrieval.",
    icon: "github",
    stages: ["repo_cloned"],
  },
  {
    title: "Searching evidence with Nozomio",
    description: "Using Nia and local search to locate code evidence.",
    icon: "database",
    stages: ["searching_evidence"],
  },
  {
    title: "Evidence searched",
    description: "Evidence retrieval completed for extracted claims.",
    icon: "database",
    stages: ["evidence_searched"],
  },
  {
    title: "Checking claims against code",
    description: "Comparing paper claims with implementation evidence.",
    icon: "claims",
    stages: ["checking_claims"],
  },
  {
    title: "Claims checked",
    description: "Claim verdicts are ready.",
    icon: "link",
    stages: ["claims_checked", "scoring"],
  },
  {
    title: "Generating the report",
    description: "Compiling findings into a reviewer-ready report.",
    icon: "report",
    stages: ["generating_report", "rendering_report"],
  },
  {
    title: "Report generated",
    description: "Report is ready for review and delivery.",
    icon: "report",
    stages: ["report_generated"],
  },
  {
    title: "Email decision",
    description: "Choose whether to email the report to the author.",
    icon: "email",
    stages: ["sending_reply", "email_sent", "email_failed", "done"],
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bandFor(value) {
  if (value === null || value === undefined || value === "") return "Awaiting score";
  const n = Number(value);
  if (Number.isNaN(n)) return "Awaiting score";
  if (n >= 85) return "Strongly reproducible";
  if (n >= 70) return "Mostly reproducible with concerns";
  if (n >= 50) return "Significant reproducibility concerns";
  return "Not reproducible from available evidence";
}

function evidenceFor(claim) {
  return (claim.evidence && claim.evidence[0]) || null;
}

function formatTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function formatAgo(value) {
  if (!value) return "not started";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not started";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

function claimCounts(audit) {
  const counts = { verified: 0, flagged: 0, needs_review: 0, unsupported: 0 };
  for (const claim of audit.claims || []) {
    if (counts[claim.verdict] !== undefined) counts[claim.verdict] += 1;
  }
  return counts;
}

function labelForVerdict(verdict) {
  return String(verdict || "needs_review").replace(/_/g, " ");
}

function emptyAudit() {
  return {
    status: "empty",
    stage: "empty",
    paper_url: "",
    repo_url: "",
    score: null,
    claims: [],
    events: [],
    report_text: "",
    sender: "",
    created_at: "",
    updated_at: "",
  };
}

function isDemoValue(value) {
  return String(value || "").startsWith("demo:");
}

function initialsFrom(value) {
  const text = String(value || "").trim();
  if (!text) return "--";
  const name = text.includes("@") ? text.split("@")[0] : text;
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

function sourceDisplay(url, type) {
  const value = String(url || "").trim();
  if (!value || isDemoValue(value)) {
    return type === "paper"
      ? { title: "No paper URL provided", subtitle: "Missing from audit request", href: null }
      : { title: "No repository URL provided", subtitle: "Missing from audit request", href: null };
  }

  try {
    const parsed = new URL(value);
    const path = decodeURIComponent(parsed.pathname.replace(/^\/+|\/+$/g, ""));
    const title = type === "paper"
      ? (path.split("/").filter(Boolean).pop() || parsed.hostname)
      : [parsed.hostname, path].filter(Boolean).join("/");
    return {
      title,
      subtitle: parsed.href,
      href: value,
    };
  } catch {
    return { title: value, subtitle: "Recorded audit input", href: null };
  }
}

function applySourceLink(link, source, activeLabel, disabledLabel) {
  if (!source.href) {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.classList.add("disabled");
    link.textContent = disabledLabel;
    return;
  }

  link.href = source.href;
  link.removeAttribute("aria-disabled");
  link.classList.remove("disabled");
  link.textContent = activeLabel;
}

function latestEventFor(audit, stages) {
  const events = audit.events || [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (stages.includes(events[i].stage)) return events[i];
  }
  return null;
}

function eventTime(audit, stages) {
  const event = latestEventFor(audit, stages);
  if (event) return formatTime(event.created_at);
  return formatTime(audit.updated_at || audit.created_at);
}

function rankForAudit(audit) {
  const order = {
    queued: 0,
    parsing_request: 0,
    finding_paper: 1,
    paper_found: 2,
    finding_github_repo: 3,
    github_found: 4,
    parsing_paper: 5,
    loading_paper: 5,
    paper_parsed: 6,
    finding_claims: 7,
    extracting_claims: 8,
    claims_extracted: 8,
    cloning_repo: 9,
    repo_cloned: 10,
    searching_evidence: 11,
    evidence_searched: 12,
    checking_claims: 13,
    claims_checked: 14,
    scoring: 14,
    generating_report: 15,
    rendering_report: 15,
    report_generated: 16,
    sending_reply: 17,
    email_sent: 17,
    email_failed: 17,
    done: 18,
    followup: 18,
  };
  if (audit.status === "done") return progressSteps.length;
  return order[audit.stage] ?? -1;
}

function statusForStep(audit, index) {
  const rank = rankForAudit(audit);
  if (rank > index) return "completed";
  if (rank === index) return "in_progress";
  return "pending";
}

function usesDemoInput(audit) {
  return [audit.paper_url, audit.repo_url].some(isDemoValue);
}

function removeDemoData(audit) {
  if (!usesDemoInput(audit)) return audit;
  return emptyAudit();
}

function renderStatus(audit) {
  const status = audit.status || "empty";
  const labels = {
    running: "Audit running",
    queued: "Audit queued",
    done: "Audit complete",
    failed: "Audit failed",
    empty: "Waiting for audit",
  };
  const subtitles = {
    running: "Real-time reproducibility audit in progress.",
    queued: "Audit request has been queued.",
    done: "Reproducibility audit completed.",
    failed: "Audit failed. Review the event timeline for details.",
    empty: "No real audit data loaded yet.",
  };

  const label = labels[status] || "Waiting for audit";
  const tone = status === "failed" ? "failed" : status === "empty" ? "empty" : status === "done" ? "done" : "running";
  els.sidebarStatusText.textContent = label;
  els.liveStatusText.textContent = label;
  els.dashboardSubtitle.textContent = subtitles[status] || subtitles.empty;
  els.statusDots.forEach((dot) => {
    dot.classList.remove("running", "done", "failed", "empty");
    dot.classList.add(tone);
  });
  els.shareButton.disabled = status === "empty";
  els.shareButton.classList.toggle("disabled", status === "empty");
}

function renderScore(audit) {
  const auditComplete = audit.status === "done" && audit.score !== null && audit.score !== undefined;
  if (els.scoreOverview) {
    els.scoreOverview.hidden = !auditComplete;
    els.scoreOverview.dataset.state = auditComplete ? "complete" : "pending";
  }

  const scoreValue = audit.score ?? 0;
  const safeScore = Math.max(0, Math.min(100, Number(scoreValue) || 0));
  els.score.textContent = audit.score ?? "--";
  els.scoreProgress.style.width = `${safeScore}%`;
  els.scoreBand.textContent = bandFor(audit.score);
  els.startedAgo.textContent = formatAgo(audit.created_at);

  const counts = claimCounts(audit);
  els.statVerified.textContent = counts.verified;
  els.statFlagged.textContent = counts.flagged;
  els.statNeedsReview.textContent = counts.needs_review;
  els.statTotal.textContent = (audit.claims || []).length;
  els.accountInitials.textContent = initialsFrom(audit.sender);
}

function renderInputs(audit) {
  const paper = sourceDisplay(audit.paper_url, "paper");
  const repo = sourceDisplay(audit.repo_url, "repo");

  els.paperTitle.textContent = paper.title;
  els.paperSubtitle.textContent = paper.subtitle;
  applySourceLink(els.paperLink, paper, "Preview", "Not available");

  els.repoTitle.textContent = repo.title;
  els.repoSubtitle.textContent = repo.subtitle;
  applySourceLink(els.repoLink, repo, "View Repo", "Not available");
}

function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());
}

function reportEmailDraft(audit) {
  const score = audit.score !== null && audit.score !== undefined ? `${audit.score} / 100` : "pending";
  const report = String(audit.report_text || "")
    .replace(/^hi\b(?:\s+[^,\n!]+)?[,!]\s*/i, "")
    .trim();
  const lines = [
    "Hi,",
    "",
    "I ran a ReproClaw reproducibility audit against the paper and linked code.",
    "",
    `Paper: ${audit.paper_url || "not provided"}`,
    `Repository: ${audit.repo_url || "not provided"}`,
    `Score: ${score}`,
  ];
  if (report) {
    lines.push("", report);
  }
  return lines.join("\n").trim();
}

function renderReportEmail(audit) {
  if (!els.reportEmailPanel) return;
  const ready = !!audit.report_text;
  const recipient = String(audit.sender || "").trim();
  const hasRecipient = looksLikeEmail(recipient);
  const state = ready ? (hasRecipient ? "ready" : "needs-recipient") : "locked";

  els.reportEmailPanel.dataset.state = state;
  els.reportEmailState.textContent = ready ? (hasRecipient ? "Ready" : "Needs email") : "Waiting";
  els.reportEmailCopy.textContent = ready
    ? "Review the auto-written report email, then send it through AgentMail when the author address is available."
    : "The report draft appears here after generation. Add an author email to send it through AgentMail.";

  if (hasRecipient && !els.reportEmailRecipient.value.trim()) {
    els.reportEmailRecipient.value = recipient;
  }
  els.reportEmailRecipient.disabled = !ready;
  els.reportEmailDraft.disabled = !ready;
  if (!ready) {
    els.reportEmailDraft.value = "";
    els.reportEmailDraft.removeAttribute("data-audit-id");
  } else if (els.reportEmailDraft.dataset.auditId !== audit.audit_id) {
    els.reportEmailDraft.value = reportEmailDraft(audit);
    els.reportEmailDraft.dataset.auditId = audit.audit_id;
  }
  els.reportEmailSend.disabled = !ready || !looksLikeEmail(els.reportEmailRecipient.value);
  els.reportEmailStatus.textContent = ready
    ? (looksLikeEmail(els.reportEmailRecipient.value) ? "Report draft ready." : "Add an author email to send.")
    : "Waiting for report generation.";
  els.reportEmailStatus.classList.remove("ok", "error");
  if (ready) els.reportEmailStatus.classList.add(looksLikeEmail(els.reportEmailRecipient.value) ? "ok" : "error");
}

function renderProgress(audit) {
  els.progressList.innerHTML = "";
  const states = progressSteps.map((_, index) => statusForStep(audit, index));
  const inProgressIndex = states.indexOf("in_progress");
  const completedCount = states.filter((state) => state === "completed").length;
  const filledIndex = inProgressIndex >= 0 ? inProgressIndex : completedCount - 1;
  const fill = filledIndex <= 0 ? 0 : Math.min(100, (filledIndex / (progressSteps.length - 1)) * 100);
  els.progressList.style.setProperty("--progress-fill", `${fill}%`);
  els.auditWorkspace?.setAttribute("data-state", audit.status || "empty");

  const currentIndex = inProgressIndex >= 0 ? inProgressIndex : Math.max(0, Math.min(progressSteps.length - 1, completedCount - 1));
  const currentStep = progressSteps[currentIndex] || progressSteps[0];
  const currentEvent = latestEventFor(audit, currentStep.stages);
  if (els.progressCurrentTitle) {
    els.progressCurrentTitle.textContent = currentStep?.title || "Waiting for audit request";
  }
  if (els.progressCurrentDescription) {
    els.progressCurrentDescription.textContent = currentEvent?.message || currentStep?.description || "Waiting for audit event.";
  }
  if (els.progressRunState) {
    const label = audit.status === "done" ? "Complete" : audit.status === "failed" ? "Failed" : audit.status === "empty" ? "Waiting" : "Running";
    els.progressRunState.textContent = label;
    els.progressRunState.dataset.state = audit.status || "empty";
  }

  progressSteps.forEach((step, index) => {
    const state = states[index];
    const event = latestEventFor(audit, step.stages);
    const item = document.createElement("li");
    item.className = `progress-step ${state}`;
    item.style.setProperty("--step-index", index);

    const description = event?.message || step.description;

    item.innerHTML = `
      <span class="step-state ${state}"></span>
      <span class="step-icon ${step.icon}" aria-hidden="true"></span>
      <span class="progress-copy">
        <strong>${escapeHtml(step.title)}</strong>
        <p>${escapeHtml(description)}</p>
      </span>
      <span class="progress-time">${state === "pending" ? "--" : eventTime(audit, step.stages)}</span>
      <span class="progress-badge ${state}">${state === "in_progress" ? "In Progress" : state === "pending" ? "Pending" : "Completed"}</span>
    `;
    els.progressList.appendChild(item);
  });
}

function renderClaims(audit) {
  els.claims.innerHTML = "";
  for (const claim of audit.claims || []) {
    const evidence = evidenceFor(claim);
    const row = document.createElement("tr");
    row.dataset.claim = claim.claim_id;
    row.innerHTML = `
      <td><span class="badge ${escapeHtml(claim.verdict)}">${escapeHtml(labelForVerdict(claim.verdict))}</span></td>
      <td>${escapeHtml(claim.claim_text)}</td>
      <td class="mono">${evidence ? escapeHtml(evidence.path) : "No evidence path"}</td>
      <td>${escapeHtml(claim.reason || "")}</td>
    `;
    row.addEventListener("click", () => showEvidence(audit.audit_id, claim));
    els.claims.appendChild(row);
  }
}

function resultKindLabel(result) {
  const labels = {
    audit: "Audit",
    claim: "Claim",
    event: "Event",
    evidence: "Evidence",
    source: "Nia source",
  };
  return labels[result.kind] || "Result";
}

function resultMeta(result) {
  const parts = [];
  if (result.audit_id) parts.push(result.audit_id);
  if (result.claim_id) parts.push(result.claim_id);
  if (result.path) parts.push(result.line_start ? `${result.path}:${result.line_start}` : result.path);
  if (result.subtitle) parts.push(result.subtitle);
  return parts.filter(Boolean).join(" | ");
}

function renderGlobalSearchState(state, message) {
  if (!els.globalSearchResults || !els.globalSearchSummary) return;
  els.globalSearchSummary.textContent = message;
  if (state === "idle") {
    els.globalSearchResults.innerHTML = "";
    return;
  }
  if (state === "loading") {
    els.globalSearchResults.innerHTML = '<div class="search-empty">Searching audits and Nia context...</div>';
    return;
  }
  if (state === "empty") {
    els.globalSearchResults.innerHTML = '<div class="search-empty">No matching audits, claims, evidence, or indexed files were found.</div>';
  }
}

function renderGlobalSearchResults(data) {
  if (!els.globalSearchResults || !els.globalSearchSummary) return;
  const results = data.results || [];
  lastSearchResults = results;

  const counts = data.sources || {};
  els.globalSearchSummary.textContent = `${results.length} results | ${counts.application || 0} app data | ${counts.nia || 0} Nia context`;

  if (!results.length) {
    renderGlobalSearchState("empty", els.globalSearchSummary.textContent);
    return;
  }

  els.globalSearchResults.innerHTML = results
    .map((result, index) => {
      const actionable = result.audit_id ? "Open" : "Indexed";
      return `
        <button class="search-result" type="button" data-search-index="${index}">
          <span class="search-result-top">
            <span class="search-result-kind ${escapeHtml(result.scope || "")}">${escapeHtml(resultKindLabel(result))}</span>
            <span class="search-result-action">${actionable}</span>
          </span>
          <strong>${escapeHtml(result.title || "Untitled result")}</strong>
          <span class="search-result-meta">${escapeHtml(resultMeta(result))}</span>
          <span class="search-result-snippet">${escapeHtml(result.snippet || "")}</span>
        </button>
      `;
    })
    .join("");

  els.globalSearchResults.querySelectorAll("[data-search-index]").forEach((button) => {
    button.addEventListener("click", () => openSearchResult(lastSearchResults[Number(button.dataset.searchIndex)]));
  });
}

async function performGlobalSearch(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) {
    lastSearchResults = [];
    renderGlobalSearchState("idle", "Type a query to search audit data and indexed project context.");
    return;
  }
  renderGlobalSearchState("loading", `Searching for "${trimmed}"...`);
  try {
    const response = await fetch(`/search?q=${encodeURIComponent(trimmed)}&limit=12`);
    if (!response.ok) {
      const detail = await response.text();
      renderGlobalSearchState("empty", `Search failed: ${response.status} ${detail.slice(0, 160)}`);
      if (lastDiscoveryData?.candidates?.length) renderSuggestions(lastDiscoveryData.candidates);
      return lastDiscoveryData;
    }
    renderGlobalSearchResults(await response.json());
  } catch (error) {
    renderGlobalSearchState("empty", `Search failed: ${error}`);
  }
}

async function openSearchResult(result) {
  if (!result || !result.audit_id) return;
  selectedAuditId = result.audit_id;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("audit", selectedAuditId);
  window.history.replaceState({}, "", nextUrl);
  await loadAudit(selectedAuditId);

  if (result.claim_id) {
    const claim = (currentAudit?.claims || []).find((item) => item.claim_id === result.claim_id);
    if (claim) {
      await showEvidence(selectedAuditId, claim);
      return;
    }
  }

  document.querySelector("#claims-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadLatestAuditId() {
  const response = await fetch("/audits");
  if (!response.ok) return null;
  const data = await response.json();
  const realAudit = (data.audits || []).find((audit) => !usesDemoInput(audit));
  return realAudit ? realAudit.audit_id : null;
}

async function loadAudit(auditId) {
  const id = auditId || selectedAuditId || await loadLatestAuditId();
  if (!id) {
    const viewAudit = emptyAudit();
    currentAudit = viewAudit;
    renderStatus(viewAudit);
    renderScore(viewAudit);
    renderInputs(viewAudit);
    renderProgress(viewAudit);
    renderReportEmail(viewAudit);
    renderClaims(viewAudit);
    return;
  }
  selectedAuditId = id;

  const response = await fetch(`/audits/${id}`);
  if (!response.ok) {
    const viewAudit = emptyAudit();
    currentAudit = viewAudit;
    renderStatus(viewAudit);
    renderScore(viewAudit);
    renderInputs(viewAudit);
    renderProgress(viewAudit);
    renderReportEmail(viewAudit);
    renderClaims(viewAudit);
    return;
  }
  const audit = await response.json();

  const viewAudit = removeDemoData(audit);
  currentAudit = viewAudit;

  renderStatus(viewAudit);
  renderScore(viewAudit);
  renderInputs(viewAudit);
  renderProgress(viewAudit);
  renderReportEmail(viewAudit);
  renderClaims(viewAudit);
}

async function showEvidence(auditId, claim) {
  selectedClaimId = claim.claim_id;
  const evidence = evidenceFor(claim);

  for (const row of els.claims.querySelectorAll("tr")) {
    row.classList.toggle("selected", row.dataset.claim === selectedClaimId);
  }

  els.evidencePanel.hidden = false;
  els.evidenceClaimId.textContent = claim.claim_id;
  els.evidenceClaimText.textContent = claim.claim_text || "";
  els.evidencePath.textContent = evidence ? evidence.path : "No evidence path was stored.";
  els.evidenceSnippet.textContent = evidence ? (evidence.snippet || "(no snippet stored)") : "(no snippet stored)";
  els.evidenceExplanation.textContent = "Loading explanation...";

  try {
    const response = await fetch(`/audits/${auditId}/claims/${claim.claim_id}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json();
    els.evidenceExplanation.textContent = data.text || "(no explanation returned)";
  } catch (error) {
    els.evidenceExplanation.textContent = `Failed to load explanation: ${error}`;
  }

  els.evidencePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function shareReport() {
  if (!currentAudit || currentAudit.status === "empty") return;
  const text = currentAudit.report_text || `ReproClaw audit ${currentAudit.audit_id}: ${currentAudit.score ?? "--"} / 100`;
  try {
    await navigator.clipboard.writeText(text);
    els.shareButton.textContent = "Copied Report";
  } catch {
    els.shareButton.textContent = "Report Ready";
  }
  window.setTimeout(() => {
    els.shareButton.innerHTML = '<span class="button-icon share" aria-hidden="true"></span>Share Report';
  }, 1500);
}

async function sendReportEmail() {
  if (!currentAudit || !currentAudit.audit_id || !currentAudit.report_text) return;
  const recipient = els.reportEmailRecipient?.value.trim() || "";
  const text = els.reportEmailDraft?.value.trim() || "";
  if (!looksLikeEmail(recipient)) {
    els.reportEmailStatus.textContent = "Enter a valid author email.";
    els.reportEmailStatus.classList.remove("ok");
    els.reportEmailStatus.classList.add("error");
    return;
  }
  if (!text) {
    els.reportEmailStatus.textContent = "Email body is empty.";
    els.reportEmailStatus.classList.remove("ok");
    els.reportEmailStatus.classList.add("error");
    return;
  }

  els.reportEmailSend.disabled = true;
  els.reportEmailStatus.textContent = "Sending report through AgentMail...";
  els.reportEmailStatus.classList.remove("error");
  els.reportEmailStatus.classList.add("ok");

  try {
    const response = await fetch(`/audits/${currentAudit.audit_id}/email-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipient,
        subject: `ReproClaw reproducibility audit for ${currentAudit.paper_url || "your paper"}`,
        text,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.sent === false) {
      const reason = payload.detail || payload.reason || `HTTP ${response.status}`;
      els.reportEmailStatus.textContent = `Email not sent: ${reason}`;
      els.reportEmailStatus.classList.remove("ok");
      els.reportEmailStatus.classList.add("error");
      els.reportEmailSend.disabled = false;
      return;
    }
    els.reportEmailStatus.textContent = "Report email sent.";
    els.reportEmailStatus.classList.remove("error");
    els.reportEmailStatus.classList.add("ok");
    await loadAudit(currentAudit.audit_id);
  } catch (err) {
    els.reportEmailStatus.textContent = `Email send failed: ${err}`;
    els.reportEmailStatus.classList.remove("ok");
    els.reportEmailStatus.classList.add("error");
    els.reportEmailSend.disabled = false;
  }
}

els.refreshButton.addEventListener("click", () => loadAudit(selectedAuditId));
els.shareButton.addEventListener("click", shareReport);
els.reportEmailSend?.addEventListener("click", sendReportEmail);
els.reportEmailRecipient?.addEventListener("input", () => {
  if (!currentAudit) return;
  const ready = !!currentAudit.report_text;
  const valid = looksLikeEmail(els.reportEmailRecipient.value);
  els.reportEmailSend.disabled = !ready || !valid;
  els.reportEmailStatus.textContent = ready ? (valid ? "Report draft ready." : "Add an author email to send.") : "Waiting for report generation.";
  els.reportEmailStatus.classList.toggle("ok", ready && valid);
  els.reportEmailStatus.classList.toggle("error", ready && !valid);
});
els.globalSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  performGlobalSearch(els.globalSearchInput?.value || "");
});
els.evidenceClose.addEventListener("click", () => {
  els.evidencePanel.hidden = true;
  selectedClaimId = null;
  for (const row of els.claims.querySelectorAll("tr.selected")) {
    row.classList.remove("selected");
  }
});

loadAudit(selectedAuditId);
setInterval(() => {
  if (selectedAuditId) loadAudit(selectedAuditId);
}, 5000);

// ─── Research chat ────────────────────────────────────────────────

const dashboardApp = document.querySelector(".dashboard-app");
const chatThread = document.querySelector("#chat-thread");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatSend = chatForm ? chatForm.querySelector("button[type=submit]") : null;
const chatOpenButton = document.querySelector("#chat-open");
const chatNewButton = document.querySelector("#chat-new");
const liveAuditNav = document.querySelector('.sidebar-nav a[href="/dashboard"]');
const chatHistoryList = document.querySelector("#chat-history");
const chatActivity = document.querySelector("#chat-activity");
const chatActivityStatus = document.querySelector("#chat-activity-status");
const chatActivityFeed = document.querySelector("#chat-activity-feed");
const chatActivityCount = document.querySelector("#chat-activity-count");
const chatStatusPill = document.querySelector(".chat-status-pill");
const chatStatusLabel = document.querySelector("#chat-status-label");
const chatThreadTitle = document.querySelector("#chat-thread-title");
const chatThreadContext = document.querySelector("#chat-thread-context");

const STARTER_PROMPTS = [
  "Find reproducibility papers with available code.",
  "Find recent diffusion papers that include GitHub repos.",
  "Search for CIFAR-10 accuracy papers with reproducible configs.",
  "Find a repo where training evidence is easy to audit.",
];

const SEARCH_PHRASES = [
  "Querying arXiv index…",
  "Reading abstracts…",
  "Scanning GitHub repositories…",
  "Cross-referencing citations…",
  "Filtering for relevance…",
  "Ranking by signal strength…",
  "Synthesizing findings…",
];

let chatConversationId = null;
let chatBusy = false;
let chatHistory = [];
let chatPapersCount = 0;
let chatReposCount = 0;
let chatStatusTimer = null;
let chatToolTimer = null;

function escapeChatHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineChat(text) {
  let html = escapeChatHtml(text);
  html = html.replace(
    /\barXiv:(\d{4}\.\d{4,5}(?:v\d+)?)/gi,
    (_, id) => `<a href="https://arxiv.org/abs/${id}" target="_blank" rel="noreferrer">arXiv:${id}</a>`,
  );
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`,
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

function renderMarkdownChat(text) {
  if (!text) return "";
  const segments = text.split(/```([\s\S]*?)```/g);
  let out = "";
  segments.forEach((segment, index) => {
    if (index % 2 === 1) {
      out += `<pre>${escapeChatHtml(segment.replace(/^[\w-]*\n/, ""))}</pre>`;
      return;
    }
    const paragraphs = segment.split(/\n{2,}/);
    paragraphs.forEach((para) => {
      const trimmed = para.trim();
      if (!trimmed) return;
      out += `<p>${renderInlineChat(trimmed).replace(/\n/g, "<br />")}</p>`;
    });
  });
  return out;
}

function summarizeToolInput(name, input) {
  if (!input) return "";
  if (input.query) return `query: "${compactChatText(input.query, 92)}"`;
  return compactChatText(JSON.stringify(input), 110);
}

function compactChatText(value, limit = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function setChatThreadContext(title = "") {
  if (chatThreadTitle) chatThreadTitle.textContent = "Research workspace";
  if (!chatThreadContext) return;
  const cleanTitle = compactChatText(title, 78);
  chatThreadContext.textContent = cleanTitle
    ? `Current thread: ${cleanTitle}`
    : "Search papers, repositories, and reproducibility evidence from one place.";
}

function findToolUseMeta(toolUseId) {
  for (const msg of chatHistory) {
    if (msg.role !== "assistant") continue;
    for (const block of msg.content || []) {
      if (block.type === "tool_use" && block.id === toolUseId) {
        return { name: block.name, input: block.input };
      }
    }
  }
  return { name: "tool", input: {} };
}

function formatToolResult(content) {
  if (typeof content !== "string") return JSON.stringify(content, null, 2);
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch (_) {
    return content;
  }
}

function appendChatMessages(messages) {
  const fragment = document.createDocumentFragment();
  messages.forEach((msg) => {
    if (msg.role === "user") {
      const text = (msg.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n\n");
      if (text.trim()) {
        const wrap = document.createElement("div");
        wrap.className = "chat-msg user";
        wrap.innerHTML = `<span class="chat-meta">You</span><div class="chat-bubble">${renderMarkdownChat(text)}</div>`;
        fragment.appendChild(wrap);
      }
      (msg.content || []).filter((b) => b.type === "tool_result").forEach((tr) => {
        const meta = findToolUseMeta(tr.tool_use_id);
        const isError = !!tr.is_error;
        const wrap = document.createElement("div");
        wrap.className = "chat-msg tool";
        wrap.innerHTML = `
          <details class="chat-tool-card">
            <summary>
              <span class="chat-tool-name">${escapeChatHtml(toolDisplayName(meta.name))}</span>
              <span class="chat-tool-arg">${escapeChatHtml(summarizeToolInput(meta.name, meta.input))}</span>
              <span class="chat-tool-status ${isError ? "error" : ""}">${isError ? "error" : "result"}</span>
            </summary>
            <pre class="chat-tool-body">${escapeChatHtml(formatToolResult(tr.content))}</pre>
          </details>
        `;
        fragment.appendChild(wrap);
      });
    } else if (msg.role === "assistant") {
      const text = (msg.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n\n");
      if (text.trim()) {
        const wrap = document.createElement("div");
        wrap.className = "chat-msg assistant";
        wrap.innerHTML = `<span class="chat-meta">ReproClaw research</span><div class="chat-bubble">${renderMarkdownChat(text)}</div>`;
        fragment.appendChild(wrap);
      }
    }
  });
  chatThread.appendChild(fragment);
  chatThread.scrollTop = chatThread.scrollHeight;
}

function renderChatEmpty() {
  const buttons = STARTER_PROMPTS.map(
    (prompt) => `<button type="button" data-prompt="${escapeChatHtml(prompt)}">${escapeChatHtml(prompt)}</button>`,
  ).join("");
  chatThread.innerHTML = `
    <div class="chat-empty">
      <span class="chat-empty-mark" aria-hidden="true">
        <svg viewBox="0 0 16 16" focusable="false">
          <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M10.2 10.2 13.5 13.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </span>
      <h3>Start a grounded research search.</h3>
      <p>Ask for papers, repositories, or evidence trails. Tool activity stays compact so the final answer remains readable.</p>
      <div class="chat-prompts">${buttons}</div>
    </div>
  `;
  chatThread.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      chatInput.value = button.dataset.prompt;
      chatInput.focus();
      autosizeChatInput();
    });
  });
}

function setChatBusy(busy) {
  chatBusy = busy;
  if (chatSend) chatSend.disabled = busy;
  if (chatInput) chatInput.disabled = busy;
}

function showChatTyping() {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg assistant chat-typing-row";
  wrap.innerHTML = `
    <span class="chat-meta">ReproClaw research</span>
    <div class="chat-bubble">
      <span class="chat-typing">
        Researching
        <span class="chat-typing-dots"><span></span><span></span><span></span></span>
      </span>
    </div>
  `;
  chatThread.appendChild(wrap);
  chatThread.scrollTop = chatThread.scrollHeight;
  return wrap;
}

async function ensureChatConversation() {
  if (chatConversationId) return chatConversationId;
  const response = await fetch("/chat/conversations", { method: "POST" });
  const data = await response.json();
  chatConversationId = data.conversation_id;
  return chatConversationId;
}

async function sendChatMessage(text) {
  if (chatBusy) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  setChatBusy(true);

  if (chatThread.querySelector(".chat-empty")) {
    chatThread.innerHTML = "";
  }

  const userMsg = { role: "user", content: [{ type: "text", text: trimmed }] };
  appendChatMessages([userMsg]);
  chatHistory.push(userMsg);
  setChatThreadContext(trimmed);
  chatInput.value = "";
  autosizeChatInput();

  // Streaming assistant bubble we'll grow as text_delta events arrive.
  let streamingBubble = null;
  let streamingText = "";
  const ensureStreamingBubble = () => {
    if (streamingBubble) return streamingBubble;
    const wrap = document.createElement("div");
    wrap.className = "chat-msg assistant";
    wrap.innerHTML = `<span class="chat-meta">ReproClaw research</span><div class="chat-bubble streaming"></div>`;
    chatThread.appendChild(wrap);
    streamingBubble = wrap.querySelector(".chat-bubble");
    chatThread.scrollTop = chatThread.scrollHeight;
    return streamingBubble;
  };

  // Pending tool entries keyed by tool_use_id so we can flip pending → done in place.
  const pendingTools = new Map();
  let typing = showChatTyping();

  try {
    const id = await ensureChatConversation();
    const response = await fetch(`/chat/conversations/${id}/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: trimmed }),
    });

    if (!response.ok || !response.body) {
      typing?.remove();
      const detail = response.body ? await response.text() : "";
      appendChatMessages([
        { role: "assistant", content: [{ type: "text", text: `Error ${response.status}: ${detail.slice(0, 400)}` }] },
      ]);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const onEvent = (eventName, payload) => {
      switch (eventName) {
        case "turn_start":
          // typing indicator stays visible until first tool_use or text_delta.
          break;
        case "tool_use": {
          typing?.remove();
          typing = null;
          const toolKind = payload.name === "search_arxiv" ? "arxiv"
            : payload.name === "search_github" ? "github" : "none";
          chatActivitySetTool(toolKind);
          const query = (payload.input && payload.input.query) || "";
          chatActivitySetStatus(
            toolKind === "arxiv" ? `Searching arXiv for "${query}"…`
            : toolKind === "github" ? `Searching GitHub for "${query}"…`
            : `Calling ${payload.name}…`,
          );
          pendingTools.set(payload.id, pushPendingActivity({
            tool: payload.name,
            query,
          }));
          break;
        }
        case "tool_result": {
          const cardEntry = pendingTools.get(payload.tool_use_id);
          finalizePendingActivity(cardEntry, {
            toolName: payload.name,
            isError: !!payload.is_error,
            label: (payload.preview && payload.preview.label) || (payload.is_error ? "error" : "done"),
            count: (payload.preview && payload.preview.count) || 0,
          });
          pendingTools.delete(payload.tool_use_id);
          // Bump live counter.
          const count = (payload.preview && payload.preview.count) || 0;
          if (payload.name === "search_arxiv") chatPapersCount += count;
          if (payload.name === "search_github") chatReposCount += count;
          updateActivityCount({ bump: true });
          // Trigger satellite ripple.
          chatActivityBurst(payload.name === "search_arxiv" ? "arxiv"
            : payload.name === "search_github" ? "github" : "none");
          // Update charge level (0..1) based on results so far.
          chatActivitySetCharge(Math.min(1, (chatPapersCount + chatReposCount) / 12));
          break;
        }
        case "text_delta": {
          typing?.remove();
          typing = null;
          chatActivitySetStatus("Synthesizing answer…");
          chatActivitySetTool("none");
          const bubble = ensureStreamingBubble();
          streamingText += payload.text || "";
          bubble.innerHTML = renderMarkdownChat(streamingText);
          chatThread.scrollTop = chatThread.scrollHeight;
          break;
        }
        case "synthesizing":
          chatActivitySetStatus("Tool budget reached. Synthesizing…");
          break;
        case "final_text": {
          // Replace streaming bubble with final normalized content.
          const finalText = (payload.content || [])
            .filter((b) => b.type === "text")
            .map((b) => b.text || "")
            .join("\n\n");
          if (streamingBubble && finalText.trim()) {
            streamingBubble.classList.remove("streaming");
            streamingBubble.innerHTML = renderMarkdownChat(finalText);
            streamingText = finalText;
          } else if (!streamingBubble && finalText.trim()) {
            streamingText = finalText;
            ensureStreamingBubble().classList.remove("streaming");
            streamingBubble.innerHTML = renderMarkdownChat(finalText);
          }
          break;
        }
        case "assistant_complete":
          // No-op: final_text or text_delta already painted the bubble.
          break;
        case "done": {
          // Persist the full new turn into chatHistory so revealActivity / replays work.
          const messages = (payload.messages || []).filter((_, idx) => idx > 0); // skip user echo
          chatHistory = chatHistory.concat(messages);
          break;
        }
        case "error": {
          typing?.remove();
          typing = null;
          appendChatMessages([
            { role: "assistant", content: [{ type: "text", text: `Error: ${payload.message || "unknown"}` }] },
          ]);
          break;
        }
        default:
          break;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (!chunk.trim()) continue;
        let eventName = "message";
        let dataLines = [];
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        let payload = {};
        try {
          payload = JSON.parse(dataLines.join("\n") || "{}");
        } catch (_) {
          payload = { raw: dataLines.join("\n") };
        }
        onEvent(eventName, payload);
      }
    }

    if (streamingBubble) streamingBubble.classList.remove("streaming");

    if (!streamingText.trim()) {
      const placeholder = {
        role: "assistant",
        content: [{ type: "text", text: "No usable results came back. Try rephrasing or checking your connection." }],
      };
      chatHistory.push(placeholder);
      appendChatMessages([placeholder]);
    }
  } catch (err) {
    typing?.remove();
    appendChatMessages([
      { role: "assistant", content: [{ type: "text", text: `Network error: ${err}` }] },
    ]);
  } finally {
    setChatBusy(false);
    chatInput.focus();
  }
}

// ── Activity-rail event helpers used by the streaming path ───────

function chatActivitySetTool(tool) {
  if (chatActivity) chatActivity.dataset.tool = tool || "none";
}

function chatActivitySetStatus(text) {
  if (chatActivityStatus) chatActivityStatus.textContent = text;
}

function chatActivitySetCharge(level) {
  if (chatActivity) chatActivity.style.setProperty("--chat-charge", String(Math.max(0, Math.min(1, level || 0))));
}

function chatActivityBurst(tool) {
  if (!chatActivity || !tool || tool === "none") return;
  chatActivity.dataset.burst = tool;
  setTimeout(() => {
    if (chatActivity.dataset.burst === tool) chatActivity.removeAttribute("data-burst");
  }, 1200);
}

function pushPendingActivity({ tool, query }) {
  if (!chatActivityFeed) return null;
  const empty = chatActivityFeed.querySelector(".chat-activity-feed-empty");
  if (empty) empty.remove();
  const li = document.createElement("li");
  li.className = "chat-activity-entry pending";
  li.innerHTML = `
    <div class="chat-activity-entry-head">
      <span class="chat-activity-entry-tool">${chatToolDisplay(tool)}</span>
      <span class="chat-activity-entry-status pending">searching</span>
    </div>
    <div class="chat-activity-entry-query">${escapeChatHtml(query || "")}</div>
    <div class="chat-activity-entry-result">…</div>
  `;
  chatActivityFeed.prepend(li);
  return li;
}

function finalizePendingActivity(li, { toolName, isError, label, count }) {
  if (!li) return;
  li.classList.remove("pending");
  const status = li.querySelector(".chat-activity-entry-status");
  if (status) {
    status.classList.remove("pending");
    status.classList.add(isError ? "error" : "ok");
    status.textContent = isError ? "error" : "ok";
  }
  const result = li.querySelector(".chat-activity-entry-result");
  if (result) result.textContent = label || `${count} results`;
}

function chatToolDisplay(name) {
  if (name === "search_arxiv") return "arXiv";
  if (name === "search_github") return "GitHub";
  return name || "tool";
}

function autosizeChatInput() {
  if (!chatInput) return;
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 180)}px`;
}

function setSidebarActive(target) {
  document.querySelectorAll(".sidebar-nav .nav-item.active").forEach((el) => el.classList.remove("active"));
  target?.classList.add("active");
}

const PAGE_VIEWS = {
  claims:       { setupName: "setupClaimsView" },
  evidence:     { setupName: "setupEvidenceView" },
  agentmail:    { setupName: "setupAgentMailView" },
  reports:      { setupName: "setupReportsView" },
  repositories: { setupName: "setupRepositoriesView" },
  settings:     { setupName: "setupSettingsView" },
};

async function ensurePageLoaded(view) {
  const cfg = PAGE_VIEWS[view];
  if (!cfg) return;
  const root = document.querySelector(`.${view}-view[data-page="${view}"]`);
  if (!root) return;
  if (root.dataset.loaded === "true") return;
  if (root.dataset.loaded === "loading") return;
  root.dataset.loaded = "loading";
  try {
    const response = await fetch(`/static/pages/${view}/page.html?v=20260425-pages-v1`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const inner = tmp.querySelector(`.${view}-view`);
    root.innerHTML = inner ? inner.innerHTML : html;
    root.dataset.loaded = "true";
    root.removeAttribute("hidden");
    const setupFn = window[cfg.setupName];
    if (typeof setupFn === "function") {
      setupFn(root);
    }
  } catch (err) {
    root.dataset.loaded = "error";
    root.innerHTML = `<div class="panel" style="margin:24px;padding:24px;"><h2 style="font-family:var(--serif);font-weight:400;">Couldn't load this page</h2><p style="color:var(--ink-mute);">Error: ${String(err).replace(/</g, "&lt;")}</p></div>`;
  }
}

function setView(view) {
  if (!dashboardApp) return;
  dashboardApp.dataset.view = view;
  if (view === "chat") {
    setSidebarActive(chatOpenButton);
    if (!chatThread.children.length) renderChatEmpty();
    refreshHistory();
    setTimeout(() => chatInput?.focus(), 50);
  } else if (PAGE_VIEWS[view]) {
    setSidebarActive(document.querySelector(`#nav-${view}`));
    ensurePageLoaded(view);
  } else {
    setSidebarActive(liveAuditNav);
  }
}

function openChat() {
  setView("chat");
}

function newChat() {
  chatConversationId = null;
  chatHistory = [];
  chatPapersCount = 0;
  chatReposCount = 0;
  if (chatActivityFeed) chatActivityFeed.innerHTML = '<li class="chat-activity-feed-empty">Search results will appear here.</li>';
  updateActivityCount();
  stopSearchAnimation();
  setChatThreadContext();
  renderChatEmpty();
  refreshHistory();
  chatInput?.focus();
}

async function refreshHistory() {
  if (!chatHistoryList) return;
  try {
    const response = await fetch("/chat/conversations");
    if (!response.ok) return;
    const data = await response.json();
    renderHistory(data.conversations || []);
  } catch (_) {
    /* ignore */
  }
}

function renderHistory(items) {
  if (!chatHistoryList) return;
  if (!items.length) {
    chatHistoryList.innerHTML = '<li class="chat-history-empty">No conversations yet.</li>';
    return;
  }
  chatHistoryList.innerHTML = items
    .map((item) => {
      const isActive = item.id === chatConversationId;
      const title = (item.title || "New chat").trim();
      return `<li>
        <button class="chat-history-item ${isActive ? "active" : ""}" type="button" data-id="${escapeChatHtml(item.id)}">
          <span class="chat-history-item-title">${escapeChatHtml(title)}</span>
          <span class="chat-history-item-meta">${escapeChatHtml(formatAgo(item.updated_at))}</span>
        </button>
      </li>`;
    })
    .join("");
  chatHistoryList.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => loadConversation(button.dataset.id));
  });
}

async function loadConversation(id) {
  if (chatBusy) return;
  try {
    const response = await fetch(`/chat/conversations/${id}`);
    if (!response.ok) return;
    const data = await response.json();
    chatConversationId = data.id;
    chatHistory = (data.messages || []).map((m) => ({ role: m.role, content: m.content }));
    chatThread.innerHTML = "";
    chatPapersCount = 0;
    chatReposCount = 0;
    if (chatActivityFeed) chatActivityFeed.innerHTML = '<li class="chat-activity-feed-empty">Search results will appear here.</li>';
    if (chatHistory.length === 0) {
      renderChatEmpty();
    } else {
      appendChatMessages(chatHistory);
      // Replay activity feed for the loaded conversation, no delay.
      replayActivity(chatHistory, /*animate=*/ false);
    }
    setChatThreadContext(data.title || "");
    refreshHistory();
  } catch (_) {
    /* ignore */
  }
}

// ── Activity rail animation ───────────────────────────────

function startSearchAnimation() {
  if (!chatActivity) return;
  chatActivity.dataset.state = "searching";
  if (chatStatusPill) chatStatusPill.dataset.state = "searching";
  if (chatStatusLabel) chatStatusLabel.textContent = "Searching";
  if (chatActivityStatus) chatActivityStatus.textContent = "Connecting to research tools…";
  // Streaming SSE events drive the per-tool status; no fake rotator.
}

function stopSearchAnimation() {
  if (!chatActivity) return;
  chatActivity.dataset.state = "idle";
  chatActivity.dataset.tool = "none";
  chatActivity.removeAttribute("data-burst");
  chatActivitySetCharge(0);
  if (chatStatusPill) chatStatusPill.dataset.state = "idle";
  if (chatStatusLabel) chatStatusLabel.textContent = "Ready";
  if (chatStatusTimer) {
    clearInterval(chatStatusTimer);
    chatStatusTimer = null;
  }
  if (chatToolTimer) {
    clearInterval(chatToolTimer);
    chatToolTimer = null;
  }
  if (chatActivityStatus && chatPapersCount + chatReposCount === 0) {
    chatActivityStatus.textContent = "Ready when you are.";
  } else if (chatActivityStatus) {
    chatActivityStatus.textContent = `${chatPapersCount} papers · ${chatReposCount} repos found.`;
  }
}

function rotateStatusPhrases() {
  if (!chatActivityStatus) return;
  let i = 0;
  chatActivityStatus.textContent = SEARCH_PHRASES[0];
  if (chatStatusTimer) clearInterval(chatStatusTimer);
  chatStatusTimer = setInterval(() => {
    i = (i + 1) % SEARCH_PHRASES.length;
    chatActivityStatus.textContent = SEARCH_PHRASES[i];
  }, 1400);
}

function cycleToolHalo() {
  if (!chatActivity) return;
  const tools = ["arxiv", "github"];
  let i = 0;
  chatActivity.dataset.tool = tools[i];
  if (chatToolTimer) clearInterval(chatToolTimer);
  chatToolTimer = setInterval(() => {
    i = (i + 1) % tools.length;
    chatActivity.dataset.tool = tools[i];
  }, 1100);
}

function setActiveTool(tool) {
  if (chatActivity) chatActivity.dataset.tool = tool || "none";
}

function toolDisplayName(name) {
  if (name === "search_arxiv") return "arXiv";
  if (name === "search_github") return "GitHub";
  return name || "tool";
}

function summarizeToolResultText(toolName, content) {
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const results = parsed?.results || [];
    if (toolName === "search_arxiv") {
      return `${results.length} ${results.length === 1 ? "paper" : "papers"}`;
    }
    if (toolName === "search_github") {
      return `${results.length} ${results.length === 1 ? "repo" : "repos"}`;
    }
    return `${results.length} results`;
  } catch (_) {
    return "result";
  }
}

function tallyResults(toolName, content) {
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const count = (parsed?.results || []).length;
    if (toolName === "search_arxiv") chatPapersCount += count;
    if (toolName === "search_github") chatReposCount += count;
  } catch (_) {
    /* ignore */
  }
}

function pushActivityEntry({ tool, query, resultText, isError }) {
  if (!chatActivityFeed) return;
  const empty = chatActivityFeed.querySelector(".chat-activity-feed-empty");
  if (empty) empty.remove();
  const li = document.createElement("li");
  li.className = "chat-activity-entry";
  li.innerHTML = `
    <div class="chat-activity-entry-head">
      <span class="chat-activity-entry-tool">${escapeChatHtml(toolDisplayName(tool))}</span>
      <span class="chat-activity-entry-status ${isError ? "error" : "ok"}">${isError ? "error" : "ok"}</span>
    </div>
    <div class="chat-activity-entry-query">${escapeChatHtml(query || "")}</div>
    <div class="chat-activity-entry-result">${escapeChatHtml(resultText || "")}</div>
  `;
  chatActivityFeed.prepend(li);
}

function updateActivityCount(opts) {
  if (!chatActivityCount) return;
  chatActivityCount.textContent = `${chatPapersCount} papers · ${chatReposCount} repos`;
  if (opts && opts.bump) {
    chatActivityCount.classList.remove("bump");
    void chatActivityCount.offsetWidth;
    chatActivityCount.classList.add("bump");
    setTimeout(() => chatActivityCount.classList.remove("bump"), 600);
  }
}

async function revealToolActivity(messages, animate = true) {
  const useById = new Map();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const b of msg.content || []) {
      if (b.type === "tool_use") useById.set(b.id, b);
    }
  }
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    for (const b of msg.content || []) {
      if (b.type !== "tool_result") continue;
      const use = useById.get(b.tool_use_id);
      if (!use) continue;
      const tool = use.name === "search_arxiv" ? "arxiv" : use.name === "search_github" ? "github" : "none";
      if (animate) setActiveTool(tool);
      tallyResults(use.name, b.content);
      pushActivityEntry({
        tool: use.name,
        query: use.input?.query || "",
        resultText: summarizeToolResultText(use.name, b.content),
        isError: !!b.is_error,
      });
      updateActivityCount();
      if (animate) await new Promise((r) => setTimeout(r, 380));
    }
  }
}

function replayActivity(messages, animate = true) {
  // Reset counts (assume fresh load) then replay
  chatPapersCount = 0;
  chatReposCount = 0;
  updateActivityCount();
  return revealToolActivity(messages, animate);
}

// ── Wire up the chat send loop with animation hooks ──────

const originalSendChatMessage = sendChatMessage;
async function sendChatMessageWithActivity(text) {
  if (chatBusy) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  // Reset per-turn counters, then let the live SSE events drive the feed.
  chatPapersCount = 0;
  chatReposCount = 0;
  updateActivityCount();
  if (chatActivityFeed) {
    chatActivityFeed.innerHTML = '<li class="chat-activity-feed-empty">Search activity will appear here as it happens.</li>';
  }
  startSearchAnimation();
  try {
    await originalSendChatMessage(trimmed);
  } finally {
    stopSearchAnimation();
    refreshHistory();
  }
}

if (dashboardApp) {
  // Initial empty state for chat thread + activity feed
  setChatThreadContext();
  if (chatThread) renderChatEmpty();
  if (chatActivityFeed && !chatActivityFeed.children.length) {
    chatActivityFeed.innerHTML = '<li class="chat-activity-feed-empty">Search results will appear here.</li>';
  }
  updateActivityCount();

  chatOpenButton?.addEventListener("click", openChat);
  chatNewButton?.addEventListener("click", newChat);

  liveAuditNav?.addEventListener("click", (event) => {
    event.preventDefault();
    setView("audit");
  });

  Object.keys(PAGE_VIEWS).forEach((view) => {
    const button = document.querySelector(`#nav-${view}`);
    button?.addEventListener("click", (event) => {
      event.preventDefault();
      setView(view);
    });
  });

  chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessageWithActivity(chatInput.value);
  });
  chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatMessageWithActivity(chatInput.value);
    }
  });
  chatInput?.addEventListener("input", autosizeChatInput);

  document.addEventListener("keydown", (event) => {
    const onChat = dashboardApp.dataset.view === "chat";
    if (event.key === "Escape" && onChat) {
      setView("audit");
    }
    if (event.key === "/" && !onChat) {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return null;
      }
      event.preventDefault();
      setView("chat");
    }
  });
}

// ─── Audit start (paper-first flow) ────────────────────────────────

(function setupAuditStart() {
  const root = document.querySelector("#audit-start");
  if (!root) return;

  const form = root.querySelector("#audit-start-form");
  const paperRow = root.querySelector("#audit-start-paper-row");
  const paperInput = root.querySelector("#audit-start-paper");
  const repoInput = root.querySelector("#audit-start-repo");
  const authorEmailInput = root.querySelector("#audit-start-author-email");
  const findButton = root.querySelector("#audit-start-find");
  const submitButton = root.querySelector("#audit-start-submit");
  const suggestionsList = root.querySelector("#audit-start-suggestions");
  const modeChips = root.querySelectorAll(".audit-start-mode-chip");
  const dropZone = root.querySelector("#audit-start-drop");
  const fileInput = root.querySelector("#audit-start-file");
  const filePick = root.querySelector("#audit-start-file-pick");
  const dropEmpty = root.querySelector(".audit-start-drop-empty");
  const dropLoaded = root.querySelector(".audit-start-drop-loaded");
  const dropName = root.querySelector("#audit-start-drop-name");
  const dropMeta = root.querySelector("#audit-start-drop-meta");
  const dropClear = root.querySelector("#audit-start-drop-clear");
  const flowSteps = {
    arxiv: root.querySelector('[data-step="arxiv"]'),
    github: root.querySelector('[data-step="github"]'),
    nia: root.querySelector('[data-step="nia"]'),
    audit: root.querySelector('[data-step="audit"]'),
  };
  const paperMeta = root.querySelector("#audit-start-paper-meta");
  const status = root.querySelector("#audit-start-status");

  const ARXIV_RE = /(\d{4}\.\d{4,5})/;

  let resolvedPaper = null;
  let lastDiscoverPaper = "";
  let lastDiscoveryData = null;
  let busy = false;
  let mode = "link";
  let uploadedPaper = null; // {paper_url, filename, size, pages}

  function setStep(step, state) {
    const el = flowSteps[step];
    if (!el) return;
    el.dataset.state = state;
  }

  function resetSteps() {
    Object.keys(flowSteps).forEach((k) => setStep(k, "idle"));
  }

  function setPaperMeta(text, kind = "") {
    paperMeta.textContent = text;
    paperMeta.classList.remove("ok", "error");
    if (kind) paperMeta.classList.add(kind);
  }

  function setStatus(text, kind = "") {
    status.textContent = text;
    status.classList.remove("ok", "error");
    if (kind) status.classList.add(kind);
  }

  function refreshSubmitState() {
    const hasPaper = mode === "upload" ? !!uploadedPaper : paperInput.value.trim().length > 0;
    submitButton.disabled = busy || !hasPaper;
    findButton.disabled = busy || (mode === "link" && !hasPaper);
  }

  function setMode(next) {
    if (next !== "link" && next !== "upload") return;
    mode = next;
    paperRow.dataset.mode = next;
    modeChips.forEach((chip) => {
      chip.setAttribute("aria-selected", chip.dataset.mode === next ? "true" : "false");
    });
    refreshSubmitState();
  }

  function formatBytes(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function setUploadedPaper(info) {
    uploadedPaper = info;
    if (info) {
      dropZone.dataset.loaded = "true";
      dropEmpty.hidden = true;
      dropLoaded.hidden = false;
      dropName.textContent = info.filename || "uploaded.pdf";
      const bits = [formatBytes(info.size)];
      if (info.pages) bits.push(`${info.pages} ${info.pages === 1 ? "page" : "pages"}`);
      dropMeta.textContent = bits.filter(Boolean).join(" · ");
    } else {
      dropZone.removeAttribute("data-loaded");
      dropEmpty.hidden = false;
      dropLoaded.hidden = true;
      dropName.textContent = "";
      dropMeta.textContent = "";
      fileInput.value = "";
    }
    refreshSubmitState();
  }

  async function uploadFile(file) {
    if (!file) return;
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      setPaperMeta("Only PDF uploads are supported.", "error");
      return;
    }
    busy = true;
    refreshSubmitState();
    resetSteps();
    setStep("arxiv", "active");
    setPaperMeta(`Uploading ${file.name}…`);
    setStatus("");

    const formData = new FormData();
    formData.append("file", file, file.name);

    try {
      const response = await fetch("/audits/upload-paper", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const detail = await response.text();
        setStep("arxiv", "error");
        setPaperMeta(`Upload failed (${response.status}): ${detail.slice(0, 160)}`, "error");
        return;
      }
      const info = await response.json();
      setUploadedPaper(info);
      setStep("arxiv", "done");
      const pageNote = info.pages ? `${info.pages} pages parsed` : "Stored";
      setPaperMeta(`${info.filename} — ${pageNote}.`, "ok");
      setStep("github", "idle");
      setStatus("Paper uploaded. Add a repo or run without one.", "ok");
    } catch (err) {
      setStep("arxiv", "error");
      setPaperMeta(`Upload error: ${err}`, "error");
    } finally {
      busy = false;
      refreshSubmitState();
    }
  }

  function clearSuggestions() {
    suggestionsList.innerHTML = "";
    suggestionsList.hidden = true;
  }

  function renderSuggestions(candidates) {
    if (!candidates || !candidates.length) {
      suggestionsList.innerHTML = "";
      suggestionsList.hidden = true;
      return;
    }
    suggestionsList.innerHTML = candidates
      .map((c) => `
        <li>
          <button type="button" class="audit-start-suggestion" data-url="${escapeHtml(c.html_url || "")}" data-name="${escapeHtml(c.full_name || "")}">
            <div class="audit-start-suggestion-row">
              <span class="audit-start-suggestion-name">${escapeHtml(c.full_name || "")}</span>
              <span class="audit-start-suggestion-meta">${c.stars ? c.stars.toLocaleString() + " ★" : ""}${c.language ? " · " + escapeHtml(c.language) : ""}</span>
            </div>
            <div class="audit-start-suggestion-desc">${escapeHtml(c.description || "No description")}</div>
          </button>
        </li>
      `)
      .join("");
    suggestionsList.hidden = false;
    suggestionsList.querySelectorAll("[data-url]").forEach((button) => {
      button.addEventListener("click", () => {
        repoInput.value = button.dataset.url;
        clearSuggestions();
        repoInput.focus();
      });
    });
  }

  async function discover(paperValue) {
    if (busy) return null;
    if (!paperValue) return null;
    if (paperValue === lastDiscoverPaper && resolvedPaper) {
      // Already discovered — re-show suggestions if hidden.
      return;
    }
    busy = true;
    refreshSubmitState();
    resetSteps();
    setStep("arxiv", "active");
    setPaperMeta("Resolving paper on arXiv…");
    setStatus("");

    try {
      const response = await fetch("/audits/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper: paperValue }),
      });
      if (!response.ok) {
        const detail = await response.text();
        setStep("arxiv", "error");
        setPaperMeta(`Discover failed (${response.status}): ${detail.slice(0, 160)}`, "error");
        return;
      }
      const data = await response.json();
      lastDiscoveryData = data;
      resolvedPaper = data.paper || null;
      lastDiscoverPaper = paperValue;

      if (resolvedPaper && resolvedPaper.title) {
        setStep("arxiv", "done");
        const authors = (resolvedPaper.authors || []).slice(0, 3).join(", ");
        const more = (resolvedPaper.authors || []).length > 3 ? "…" : "";
        setPaperMeta(`${resolvedPaper.title}${authors ? " — " + authors + more : ""}`, "ok");
      } else if (resolvedPaper && resolvedPaper.arxiv_id) {
        setStep("arxiv", "done");
        setPaperMeta(`arXiv:${resolvedPaper.arxiv_id} (metadata not returned)`, "ok");
      } else {
        setStep("arxiv", "error");
        setPaperMeta("Could not resolve paper. Provide a repo manually if you have one.", "error");
      }

      setStep("github", "active");
      const candidates = data.candidates || [];
      renderSuggestions(candidates);
      if (candidates.length) {
        setStep("github", "done");
        setStatus(`Found ${candidates.length} candidate ${candidates.length === 1 ? "repo" : "repos"}.`, "ok");
      } else {
        setStep("github", "error");
        setStatus("No GitHub matches. Paste a repo manually or run without one.", "error");
      }
      return data;
    } catch (err) {
      setStep("arxiv", "error");
      setPaperMeta(`Network error: ${err}`, "error");
      return null;
    } finally {
      busy = false;
      refreshSubmitState();
    }
  }

  async function submitAudit(event) {
    event.preventDefault();
    if (busy) return;
    let paperUrl;
    let repoValue = repoInput.value.trim();
    let paperValue = "";
    let discoveryData = lastDiscoveryData;
    if (mode === "upload") {
      if (!uploadedPaper || !uploadedPaper.paper_url) return;
      paperUrl = uploadedPaper.paper_url;
    } else {
      paperValue = paperInput.value.trim();
      if (!paperValue) return;
      if (!resolvedPaper || paperValue !== lastDiscoverPaper || !repoValue) {
        discoveryData = await discover(paperValue);
        repoValue = repoInput.value.trim();
        const firstRepo = discoveryData?.candidates?.[0]?.html_url || "";
        if (!repoValue && firstRepo) {
          repoInput.value = firstRepo;
          repoValue = firstRepo;
          setStatus("Matched a GitHub repository automatically.", "ok");
        }
      }
      const discoveredPaper = discoveryData?.paper || resolvedPaper;
      paperUrl = arxivLikeToUrl(paperValue);
      if (discoveredPaper?.pdf_url) paperUrl = discoveredPaper.pdf_url;
      else if (discoveredPaper?.abs_url) paperUrl = discoveredPaper.abs_url;
    }
    const authorEmail = authorEmailInput?.value.trim() || "";
    if (authorEmail && !looksLikeEmail(authorEmail)) {
      setStatus("Enter a valid author email or leave it blank.", "error");
      authorEmailInput.focus();
      return;
    }
    busy = true;
    refreshSubmitState();
    setStatus("Creating audit…");
    if (repoValue) setStep("nia", "active");
    setStep("audit", "active");

    try {
      const discoveredPaper = discoveryData?.paper || resolvedPaper;
      const body = {
        paper_url: paperUrl,
        subject: discoveredPaper?.title || paperValue || "ReproClaw audit",
        body: discoveredPaper?.summary || paperValue || "",
      };
      if (repoValue) body.repo_url = repoValue;
      if (authorEmail) body.sender = authorEmail;

      const response = await fetch("/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = await response.text();
        setStep("audit", "error");
        setStatus(`Failed to start (${response.status}): ${detail.slice(0, 160)}`, "error");
        return;
      }
      const data = await response.json();
      const auditId = data.audit_id;
      const niaInfo = data.nia || {};
      if (repoValue) {
        setStep("nia", niaInfo.indexed ? "done" : "error");
      }
      setStep("audit", "done");
      setStatus(`Audit ${auditId} queued${niaInfo.indexed ? ` · Nia ${niaInfo.source_id}` : ""}.`, "ok");

      // Switch the dashboard to follow this audit.
      try {
        selectedAuditId = auditId;
        const url = new URL(window.location.href);
        url.searchParams.set("audit", auditId);
        url.hash = "progress-section";
        history.replaceState(null, "", url.toString());
        if (typeof loadAudit === "function") await loadAudit(auditId);
        document.querySelector("#progress-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {
        /* polling will pick it up */
      }
    } catch (err) {
      setStep("audit", "error");
      setStatus(`Network error: ${err}`, "error");
    } finally {
      busy = false;
      refreshSubmitState();
    }
  }

  function arxivLikeToUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const m = trimmed.match(ARXIV_RE);
    if (m) return `https://arxiv.org/abs/${m[1]}`;
    return trimmed;
  }

  paperInput.addEventListener("input", () => {
    refreshSubmitState();
    if (!paperInput.value.trim()) {
      resetSteps();
      setPaperMeta("arXiv lookup runs as soon as the field looks like an arXiv ID.");
      setStatus("");
      clearSuggestions();
      resolvedPaper = null;
      lastDiscoverPaper = "";
      lastDiscoveryData = null;
    }
  });

  paperInput.addEventListener("blur", () => {
    const value = paperInput.value.trim();
    if (value && ARXIV_RE.test(value) && value !== lastDiscoverPaper) {
      discover(value);
    }
  });

  findButton.addEventListener("click", () => {
    const value = paperInput.value.trim();
    if (!value) {
      paperInput.focus();
      return;
    }
    discover(value);
  });

  form.addEventListener("submit", submitAudit);

  modeChips.forEach((chip) => {
    chip.addEventListener("click", () => setMode(chip.dataset.mode));
  });

  filePick?.addEventListener("click", (event) => {
    event.stopPropagation();
    fileInput.click();
  });

  dropClear?.addEventListener("click", (event) => {
    event.stopPropagation();
    setUploadedPaper(null);
    setPaperMeta("Upload a PDF to continue.");
    resetSteps();
  });

  dropZone?.addEventListener("click", (event) => {
    if (event.target === dropClear || event.target === filePick) return;
    if (uploadedPaper) return;
    fileInput.click();
  });

  dropZone?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!uploadedPaper) fileInput.click();
    }
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone?.addEventListener(evt, (event) => {
      event.preventDefault();
      dropZone.dataset.active = "true";
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropZone?.addEventListener(evt, (event) => {
      event.preventDefault();
      dropZone.removeAttribute("data-active");
    });
  });

  dropZone?.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) uploadFile(file);
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) uploadFile(file);
  });

  refreshSubmitState();
})();
