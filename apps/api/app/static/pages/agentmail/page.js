window.setupAgentMailView = function (root) {
  if (!root) return;

  const FOLDERS = {
    inbox: { title: "Inbox", subtitle: "All threads addressed to your audit inbox.", filter: () => true },
    in_progress: {
      title: "In progress",
      subtitle: "Audits currently being processed.",
      filter: (a) => agentmailIsRunning(a),
    },
    completed: {
      title: "Completed",
      subtitle: "Audits ReproClaw has replied to.",
      filter: (a) => (a.status || "").toLowerCase() === "completed",
    },
    failed: {
      title: "Failed",
      subtitle: "Audits that did not finish.",
      filter: (a) => (a.status || "").toLowerCase() === "failed",
    },
  };

  const state = {
    audits: [],
    selectedId: null,
    folder: "inbox",
    loading: false,
    error: null,
    initialized: false,
  };

  const els = {
    statusPill: root.querySelector("[data-agentmail-status]"),
    statusLabel: root.querySelector("[data-agentmail-status-label]"),
    copyBtn: root.querySelector("[data-agentmail-copy]"),
    copyLabel: root.querySelector("[data-agentmail-copy-label]"),
    refreshBtn: root.querySelector("[data-agentmail-refresh]"),
    banner: root.querySelector("[data-agentmail-banner]"),
    folders: root.querySelector("[data-agentmail-folders]"),
    folderButtons: root.querySelectorAll("[data-agentmail-folder]"),
    folderCounts: {
      inbox: root.querySelector('[data-agentmail-folder-count="inbox"]'),
      in_progress: root.querySelector('[data-agentmail-folder-count="in_progress"]'),
      completed: root.querySelector('[data-agentmail-folder-count="completed"]'),
      failed: root.querySelector('[data-agentmail-folder-count="failed"]'),
    },
    inboxAddress: root.querySelector("[data-agentmail-inbox-address]"),
    listTitle: root.querySelector("[data-agentmail-list-title]"),
    listSubtitle: root.querySelector("[data-agentmail-list-subtitle]"),
    listCount: root.querySelector("[data-agentmail-list-count]"),
    threads: root.querySelector("[data-agentmail-threads]"),
    loading: root.querySelector("[data-agentmail-loading]"),
    empty: root.querySelector("[data-agentmail-empty]"),
    emptyMsg: root.querySelector("[data-agentmail-empty-msg]"),
    error: root.querySelector("[data-agentmail-error]"),
    errorMsg: root.querySelector("[data-agentmail-error-msg]"),
    retry: root.querySelector("[data-agentmail-retry]"),
    detailEmpty: root.querySelector("[data-agentmail-detail-empty]"),
    detailBody: root.querySelector("[data-agentmail-detail-body]"),
    detailEyebrow: root.querySelector("[data-agentmail-detail-eyebrow]"),
    detailSubject: root.querySelector("[data-agentmail-detail-subject]"),
    detailFrom: root.querySelector("[data-agentmail-detail-from]"),
    detailTo: root.querySelector("[data-agentmail-detail-to]"),
    detailDate: root.querySelector("[data-agentmail-detail-date]"),
    detailThread: root.querySelector("[data-agentmail-detail-thread]"),
    detailStatus: root.querySelector("[data-agentmail-detail-status]"),
    detailVerdict: root.querySelector("[data-agentmail-detail-verdict]"),
    detailIncomingMeta: root.querySelector("[data-agentmail-detail-incoming-meta]"),
    detailBodyText: root.querySelector("[data-agentmail-detail-body]"),
    detailResources: root.querySelector("[data-agentmail-detail-resources]"),
    detailReplyMeta: root.querySelector("[data-agentmail-detail-reply-meta]"),
    detailReport: root.querySelector("[data-agentmail-detail-report]"),
    composer: root.querySelector("[data-agentmail-composer]"),
    composerInput: root.querySelector("[data-agentmail-composer-input]"),
  };

  function agentmailEscape(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function agentmailIsRunning(a) {
    const s = (a.status || "").toLowerCase();
    return s && s !== "completed" && s !== "failed";
  }

  function agentmailRelTime(iso) {
    if (!iso) return "--";
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return "--";
    const diff = Math.max(0, Date.now() - then);
    const sec = Math.floor(diff / 1000);
    if (sec < 45) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return min + " min ago";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    const day = Math.floor(hr / 24);
    if (day < 14) return day + "d ago";
    const date = new Date(then);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function agentmailFormatDate(iso) {
    if (!iso) return "--";
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return iso;
    return new Date(t).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function agentmailSenderLabel(a) {
    if (a.sender && a.sender.trim()) return a.sender.trim();
    return "demo-paper";
  }

  function agentmailSubject(a) {
    if (a.subject && a.subject.trim()) return a.subject.trim();
    if (a.paper_url) return "Audit request: " + a.paper_url;
    return "Untitled audit";
  }

  function agentmailSnippet(a) {
    const body = (a.body || "").trim();
    if (body) return body.split(/\r?\n/)[0].slice(0, 140);
    if (a.question) return a.question.slice(0, 140);
    if (a.paper_url) return "Audit requested for " + a.paper_url;
    return "No body provided.";
  }

  function agentmailStatusLabel(status) {
    const s = (status || "").toLowerCase();
    if (!s) return "queued";
    if (s === "in_progress" || s === "running") return "running";
    return s;
  }

  function agentmailStatusClass(status) {
    const s = agentmailStatusLabel(status);
    if (s === "completed" || s === "done") return "done";
    if (s === "failed") return "failed";
    if (s === "running" || s === "in_progress") return "running";
    return "queued";
  }

  function agentmailVerdictBand(score, status) {
    const s = (status || "").toLowerCase();
    if (s !== "completed") return null;
    if (typeof score !== "number") return { cls: "unscored-band", label: "unscored" };
    if (score >= 75) return { cls: "verified-band", label: "verified · " + score };
    if (score >= 50) return { cls: "review-band", label: "needs review · " + score };
    return { cls: "flagged-band", label: "flagged · " + score };
  }

  function agentmailFiltered() {
    const folder = FOLDERS[state.folder] || FOLDERS.inbox;
    const list = state.audits.filter(folder.filter);
    list.sort((a, b) => {
      const ta = Date.parse(a.updated_at || a.created_at || "") || 0;
      const tb = Date.parse(b.updated_at || b.created_at || "") || 0;
      return tb - ta;
    });
    return list;
  }

  function agentmailRender() {
    agentmailRenderConnectionStatus();
    agentmailRenderFolderCounts();
    agentmailRenderList();
    agentmailRenderDetail();
  }

  function agentmailRenderConnectionStatus() {
    if (!els.statusPill || !els.statusLabel) return;
    if (state.error) {
      els.statusPill.dataset.state = "failed";
      els.statusLabel.textContent = "Disconnected";
      return;
    }
    const hasThread = state.audits.some((a) => a.thread_id && a.thread_id.trim());
    if (hasThread) {
      els.statusPill.dataset.state = "live";
      els.statusLabel.textContent = "Live";
    } else if (state.audits.length > 0) {
      els.statusPill.dataset.state = "pending";
      els.statusLabel.textContent = "Pending — webhook not wired";
    } else if (state.loading && !state.initialized) {
      els.statusPill.dataset.state = "idle";
      els.statusLabel.textContent = "Connecting";
    } else {
      els.statusPill.dataset.state = "pending";
      els.statusLabel.textContent = "Awaiting first email";
    }
    if (els.banner) {
      els.banner.hidden = hasThread || state.audits.length === 0;
    }
  }

  function agentmailRenderFolderCounts() {
    Object.keys(FOLDERS).forEach((key) => {
      const node = els.folderCounts[key];
      if (!node) return;
      const count = state.audits.filter(FOLDERS[key].filter).length;
      node.textContent = String(count);
    });
    els.folderButtons.forEach((btn) => {
      const isActive = btn.dataset.agentmailFolder === state.folder;
      btn.classList.toggle("is-active", isActive);
    });
  }

  function agentmailRenderList() {
    if (!els.threads) return;
    const folder = FOLDERS[state.folder] || FOLDERS.inbox;
    if (els.listTitle) els.listTitle.textContent = folder.title;
    if (els.listSubtitle) els.listSubtitle.textContent = folder.subtitle;

    if (state.loading && !state.initialized) {
      els.threads.innerHTML = "";
      if (els.loading) els.loading.hidden = false;
      if (els.empty) els.empty.hidden = true;
      if (els.error) els.error.hidden = true;
      if (els.listCount) els.listCount.textContent = "...";
      return;
    }
    if (els.loading) els.loading.hidden = true;

    if (state.error) {
      els.threads.innerHTML = "";
      if (els.empty) els.empty.hidden = true;
      if (els.error) els.error.hidden = false;
      if (els.errorMsg) els.errorMsg.textContent = state.error;
      if (els.listCount) els.listCount.textContent = "0";
      return;
    }
    if (els.error) els.error.hidden = true;

    const list = agentmailFiltered();
    if (els.listCount) els.listCount.textContent = String(list.length);

    if (list.length === 0) {
      els.threads.innerHTML = "";
      if (els.empty) {
        els.empty.hidden = false;
        if (els.emptyMsg) {
          if (state.audits.length === 0) {
            els.emptyMsg.textContent =
              "When researchers email your audit inbox, every thread lands here.";
          } else {
            els.emptyMsg.textContent = "Nothing in " + folder.title.toLowerCase() + " right now.";
          }
        }
      }
      return;
    }
    if (els.empty) els.empty.hidden = true;

    const html = list
      .map((a) => {
        const sender = agentmailEscape(agentmailSenderLabel(a));
        const subject = agentmailEscape(agentmailSubject(a));
        const snippet = agentmailEscape(agentmailSnippet(a));
        const time = agentmailEscape(agentmailRelTime(a.updated_at || a.created_at));
        const statusCls = agentmailStatusClass(a.status);
        const statusLabel = agentmailEscape(agentmailStatusLabel(a.status));
        const verdict = agentmailVerdictBand(a.score, a.status);
        const verdictHtml = verdict
          ? '<span class="badge ' +
            verdict.cls +
            '">' +
            agentmailEscape(verdict.label) +
            "</span>"
          : "";
        const isActive = a.audit_id === state.selectedId ? " is-active" : "";
        return (
          '<li><button type="button" class="agentmail-view-thread' +
          isActive +
          '" data-agentmail-thread="' +
          agentmailEscape(a.audit_id) +
          '">' +
          '<div class="agentmail-view-thread-top">' +
          '<span class="agentmail-view-thread-sender">' +
          sender +
          "</span>" +
          '<span class="agentmail-view-thread-time">' +
          time +
          "</span>" +
          "</div>" +
          '<div class="agentmail-view-thread-subject">' +
          subject +
          "</div>" +
          '<div class="agentmail-view-thread-snippet">' +
          snippet +
          "</div>" +
          '<div class="agentmail-view-thread-tail">' +
          '<span class="badge ' +
          statusCls +
          '">' +
          statusLabel +
          "</span>" +
          verdictHtml +
          "</div>" +
          "</button></li>"
        );
      })
      .join("");
    els.threads.innerHTML = html;
  }

  function agentmailLinkify(value) {
    const escaped = agentmailEscape(value);
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, function (match) {
      return '<a href="' + match + '" target="_blank" rel="noreferrer noopener">' + match + "</a>";
    });
  }

  function agentmailRenderReport(text) {
    if (!text || !text.trim()) {
      return '<p class="agentmail-view-report-empty">No report yet — ReproClaw has not finished this audit.</p>';
    }
    const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
    return blocks
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (/^```/.test(trimmed)) {
          const inner = trimmed.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/```$/, "");
          return "<pre>" + agentmailEscape(inner) + "</pre>";
        }
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          return "<h" + level + ">" + agentmailEscape(headingMatch[2]) + "</h" + level + ">";
        }
        const lines = trimmed.split("\n");
        const isList = lines.every((l) => /^[-*]\s+/.test(l));
        if (isList) {
          const items = lines
            .map((l) => "<li>" + agentmailLinkify(l.replace(/^[-*]\s+/, "")) + "</li>")
            .join("");
          return "<ul>" + items + "</ul>";
        }
        const isOrdered = lines.every((l) => /^\d+\.\s+/.test(l));
        if (isOrdered) {
          const items = lines
            .map((l) => "<li>" + agentmailLinkify(l.replace(/^\d+\.\s+/, "")) + "</li>")
            .join("");
          return "<ol>" + items + "</ol>";
        }
        return "<p>" + agentmailLinkify(trimmed).replace(/\n/g, "<br />") + "</p>";
      })
      .join("");
  }

  function agentmailRenderDetail() {
    const audit = state.audits.find((a) => a.audit_id === state.selectedId) || null;
    if (!audit) {
      if (els.detailEmpty) els.detailEmpty.hidden = false;
      if (els.detailBody) els.detailBody.hidden = true;
      return;
    }
    if (els.detailEmpty) els.detailEmpty.hidden = true;
    if (els.detailBody) els.detailBody.hidden = false;

    const subject = agentmailSubject(audit);
    if (els.detailSubject) els.detailSubject.textContent = subject;
    if (els.detailEyebrow) {
      els.detailEyebrow.textContent =
        audit.thread_id && audit.thread_id.trim() ? "AgentMail thread" : "Local thread";
    }
    if (els.detailFrom) els.detailFrom.textContent = agentmailSenderLabel(audit);
    if (els.detailTo) {
      els.detailTo.textContent = (els.inboxAddress && els.inboxAddress.textContent) || "audits@reproclaw";
    }
    if (els.detailDate) els.detailDate.textContent = agentmailFormatDate(audit.created_at);
    if (els.detailThread) {
      els.detailThread.textContent =
        audit.thread_id && audit.thread_id.trim() ? audit.thread_id : audit.audit_id;
    }

    if (els.detailStatus) {
      const cls = agentmailStatusClass(audit.status);
      els.detailStatus.className = "badge agentmail-view-status-badge " + cls;
      els.detailStatus.textContent = agentmailStatusLabel(audit.status);
    }
    if (els.detailVerdict) {
      const v = agentmailVerdictBand(audit.score, audit.status);
      if (v) {
        els.detailVerdict.hidden = false;
        els.detailVerdict.className = "badge agentmail-view-verdict-badge " + v.cls;
        els.detailVerdict.textContent = v.label;
      } else {
        els.detailVerdict.hidden = true;
      }
    }

    if (els.detailIncomingMeta) {
      els.detailIncomingMeta.textContent = agentmailRelTime(audit.created_at);
    }
    if (els.detailBodyText) {
      const body = (audit.body || audit.question || "").trim();
      els.detailBodyText.textContent = body || "(No body submitted with this request.)";
    }

    if (els.detailResources) {
      const items = [];
      if (audit.paper_url) {
        items.push(
          '<li><a class="agentmail-view-resource" href="' +
            agentmailEscape(audit.paper_url) +
            '" target="_blank" rel="noreferrer noopener">' +
            '<span class="agentmail-view-resource-tag">paper</span>' +
            '<span>' +
            agentmailEscape(audit.paper_url) +
            "</span></a></li>"
        );
      }
      if (audit.repo_url) {
        items.push(
          '<li><a class="agentmail-view-resource" href="' +
            agentmailEscape(audit.repo_url) +
            '" target="_blank" rel="noreferrer noopener">' +
            '<span class="agentmail-view-resource-tag">repo</span>' +
            '<span>' +
            agentmailEscape(audit.repo_url) +
            "</span></a></li>"
        );
      }
      els.detailResources.innerHTML = items.join("");
    }

    if (els.detailReplyMeta) {
      const replyTime = audit.updated_at && audit.updated_at !== audit.created_at
        ? agentmailRelTime(audit.updated_at)
        : "pending";
      els.detailReplyMeta.textContent = replyTime;
    }
    if (els.detailReport) {
      els.detailReport.innerHTML = agentmailRenderReport(audit.report_text || "");
    }
  }

  async function agentmailFetch() {
    state.loading = true;
    state.error = null;
    agentmailRender();
    try {
      const res = await fetch("/audits", { headers: { Accept: "application/json" } });
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      const data = await res.json();
      const list = Array.isArray(data && data.audits) ? data.audits : [];
      state.audits = list;
      if (state.selectedId && !list.some((a) => a.audit_id === state.selectedId)) {
        state.selectedId = null;
      }
      if (!state.selectedId) {
        const first = agentmailFiltered()[0];
        if (first) state.selectedId = first.audit_id;
      }
    } catch (err) {
      state.error = err && err.message ? err.message : "Network error";
    } finally {
      state.loading = false;
      state.initialized = true;
      agentmailRender();
    }
  }

  function agentmailBindEvents() {
    els.folderButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.folder = btn.dataset.agentmailFolder;
        const filtered = agentmailFiltered();
        if (state.selectedId && !filtered.some((a) => a.audit_id === state.selectedId)) {
          state.selectedId = filtered[0] ? filtered[0].audit_id : null;
        } else if (!state.selectedId && filtered[0]) {
          state.selectedId = filtered[0].audit_id;
        }
        agentmailRender();
      });
    });

    if (els.threads) {
      els.threads.addEventListener("click", (event) => {
        const target = event.target.closest("[data-agentmail-thread]");
        if (!target) return;
        state.selectedId = target.dataset.agentmailThread;
        agentmailRender();
      });
    }

    if (els.refreshBtn) {
      els.refreshBtn.addEventListener("click", () => {
        agentmailFetch();
      });
    }

    if (els.retry) {
      els.retry.addEventListener("click", () => {
        agentmailFetch();
      });
    }

    if (els.copyBtn && els.inboxAddress) {
      els.copyBtn.addEventListener("click", async () => {
        const value = els.inboxAddress.textContent || "";
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(value);
          } else {
            const ta = document.createElement("textarea");
            ta.value = value;
            ta.setAttribute("readonly", "");
            ta.style.position = "absolute";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          }
          if (els.copyLabel) {
            const prev = els.copyLabel.textContent;
            els.copyLabel.textContent = "Copied";
            setTimeout(() => {
              if (els.copyLabel) els.copyLabel.textContent = prev || "Copy inbox";
            }, 1500);
          }
        } catch (_err) {
          if (els.copyLabel) {
            els.copyLabel.textContent = "Copy failed";
            setTimeout(() => {
              if (els.copyLabel) els.copyLabel.textContent = "Copy inbox";
            }, 1800);
          }
        }
      });
    }

    if (els.composer) {
      els.composer.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!els.composerInput) return;
        const value = els.composerInput.value.trim();
        if (!value) return;
        const sendBtn = els.composer.querySelector("[data-agentmail-composer-send] span");
        const original = sendBtn ? sendBtn.textContent : null;
        if (sendBtn) sendBtn.textContent = "Reply queued (stub)";
        els.composerInput.value = "";
        setTimeout(() => {
          if (sendBtn) sendBtn.textContent = original || "Send reply";
        }, 1800);
      });
    }
  }

  agentmailBindEvents();
  agentmailRender();
  agentmailFetch();
};
