/**
 * Tableau de bord du secrétariat.
 * Données : /api/dashboard, /api/appointments, /api/calls, /api/tasks.
 */

let dashboardData = null;

/* ── Rendu ───────────────────────────────────────────────────────────────── */

function renderStats(stats) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? 0;
  };
  set("statRdv", stats.rdv_a_confirmer);
  set("statArrives", stats.patients_arrivees);
  set("statAppels", stats.appels_a_traiter);
  set("statDocs", stats.documents_en_attente);
}

function renderDemandes(list) {
  const el = document.getElementById("apptList");
  if (!el) return;
  const pending = list.filter((a) => a.statut === "en_attente");
  const shown = pending.length ? pending : list;

  if (!shown.length) {
    el.innerHTML =
      '<div class="state-empty"><strong>Aucune demande</strong>Aucun rendez-vous en attente de confirmation.</div>';
    return;
  }

  el.innerHTML = shown
    .slice(0, 5)
    .map(
      (a) => `
      <div class="appt-row">
        <span class="appt-time">${App.escapeHtml(a.start)}</span>
        <div style="flex: 1">
          <span class="appt-name">${App.escapeHtml(a.patient_nom)}</span>
          <span class="appt-type">${App.escapeHtml(a.type_libelle || "Consultation")}${a.staff_nom ? " · " + App.escapeHtml(a.staff_nom) : ""}</span>
        </div>
        <span class="badge ${App.badgeClass(a.statut)}">${App.escapeHtml(a.statut_label || a.statut)}</span>
      </div>`,
    )
    .join("");
}

function renderWaiting(list) {
  const el = document.getElementById("waitingList");
  if (!el) return;
  if (!list.length) {
    el.innerHTML =
      '<div class="state-empty"><strong>Personne en salle d\'attente</strong>Enregistrez une arrivée pour la remplir.</div>';
    return;
  }
  const colors = ["", "green", "orange", "purple"];
  el.innerHTML = list
    .map((a, i) => {
      const parts = String(a.patient_nom || " ").split(" ");
      const initials = App.initials(parts[0], parts[parts.length - 1]);
      return `
      <div class="patient-row" data-id="${a.id_appointment}">
        <div class="pat-avatar ${colors[i % colors.length]}">${App.escapeHtml(initials)}</div>
        <div class="pat-info">
          <span class="pat-name">${App.escapeHtml(a.patient_nom)}</span>
          <span class="pat-type">Arrivé à ${App.escapeHtml(a.heure_arrivee || "—")}${a.type_libelle ? " · " + App.escapeHtml(a.type_libelle) : ""}</span>
        </div>
        <span class="badge ${App.badgeClass(a.statut)}">${App.escapeHtml(a.status_label || a.statut)}</span>
      </div>`;
    })
    .join("");
}

function renderCalls(list) {
  const el = document.getElementById("callsList");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="state-empty">Aucun appel enregistré.</div>';
    return;
  }
  el.innerHTML = list
    .map(
      (c) => `
      <div class="msg-row" data-call="${c.id_call}">
        <div class="msg-icon ${c.statut === "traite" ? "done" : "urgent"}">
          <svg viewBox="0 0 24 24">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12" />
            <path d="M16 7a6 6 0 1 1-12 0 6 6 0 0 1 12 0z" />
          </svg>
        </div>
        <div class="msg-body">
          <span class="msg-name">${App.escapeHtml(c.patient_nom || "Cabinet")}</span
          ><span class="msg-subject">${App.escapeHtml(c.objet)}</span>
        </div>
        <div class="msg-time${c.statut === "a_traiter" ? " bold" : ""}">${App.escapeHtml(App.fmtRelative(c.created_at))}</div>
      </div>`,
    )
    .join("");
}

function renderMessages(list) {
  const el = document.getElementById("messagesList");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="state-empty">Aucun message.</div>';
    return;
  }
  el.innerHTML = list
    .map(
      (m) => `
      <div class="msg-row">
        <div class="msg-icon ${m.non_lu ? "unread" : "read"}">
          <svg viewBox="0 0 24 24">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <div class="msg-body">
          <span class="msg-name">${App.escapeHtml(m.expediteur || m.sujet)}</span
          ><span class="msg-subject">${App.escapeHtml(m.sujet)}</span>
        </div>
        <div class="msg-time">${App.escapeHtml(App.fmtRelative(m.date))}</div>
      </div>`,
    )
    .join("");
}

function renderAdminDocs(list) {
  const el = document.getElementById("adminDocsList");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="state-empty">Aucun document administratif.</div>';
    return;
  }
  el.innerHTML = list
    .map(
      (d) => `
      <div class="doc-row">
        <div class="doc-icon">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="9" x2="9" y2="21" />
          </svg>
        </div>
        <div class="doc-body">
          <span class="doc-name">${App.escapeHtml(d.titre)}</span>
          <span class="doc-type">${App.escapeHtml(d.patient_nom || "")}</span>
        </div>
        <span class="badge ${App.badgeClass(d.statut)}">${App.escapeHtml(d.statut || "a_classer")}</span>
      </div>`,
    )
    .join("");
}

function renderTasks(tasks) {
  const el = document.getElementById("taskList");
  if (!el) return;
  if (!tasks.length) {
    el.innerHTML = '<div class="state-empty">Aucune tâche.</div>';
    return;
  }
  el.innerHTML = tasks
    .map(
      (t) => `
      <div class="task-item" data-id="${t.id_task}">
        <div class="task-cb${t.statut === "done" ? " checked" : ""}" role="checkbox"
             aria-checked="${t.statut === "done"}" tabindex="0"
             data-action="toggle" title="${t.statut === "done" ? "Rouvrir" : "Terminer"}">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span class="task-label${t.statut === "done" ? " done" : ""}" data-action="toggle">${App.escapeHtml(t.titre)}</span>
        <button class="task-del" type="button" data-action="delete" title="Supprimer">×</button>
      </div>`,
    )
    .join("");
}

/* ── Actions ────────────────────────────────────────────────────────────── */

async function reloadAll() {
  dashboardData = await api.get("/api/dashboard");
  renderStats(dashboardData.stats || {});
  renderDemandes(dashboardData.prochains_rdv || []);
  renderWaiting(dashboardData.salle_attente || []);
  renderCalls(dashboardData.appels || []);
  renderMessages(dashboardData.derniers_messages || []);
  renderAdminDocs(dashboardData.documents || []);

  const tasks = await api.get("/api/tasks");
  renderTasks(tasks);
}

async function addTask(titre) {
  if (!titre || !titre.trim()) return;
  try {
    await api.post("/api/tasks", { titre: titre.trim() });
    await reloadAll();
    api.notify("Tâche ajoutée", "success");
  } catch (err) {
    api.notify(err.message, "error");
  }
}

function openTaskForm() {
  const form = document.getElementById("taskForm");
  const input = document.getElementById("taskInput");
  if (form) form.classList.remove("hidden");
  if (input) {
    input.value = "";
    input.focus();
  }
}

function closeTaskForm() {
  document.getElementById("taskForm")?.classList.add("hidden");
}

async function toggleTask(id, done) {
  try {
    await api.patch(`/api/tasks/${id}`, { statut: done ? "done" : "todo" });
    await reloadAll();
  } catch (err) {
    api.notify(err.message, "error");
  }
}

async function deleteTask(id) {
  try {
    await api.del(`/api/tasks/${id}`);
    await reloadAll();
    api.notify("Tâche supprimée", "success");
  } catch (err) {
    api.notify(err.message, "error");
  }
}

async function toggleCall(id, statut) {
  try {
    await api.patch(`/api/calls/${id}`, { statut });
    await reloadAll();
    api.notify(statut === "traite" ? "Appel marqué comme traité" : "Appel remis à traiter", "success");
  } catch (err) {
    api.notify(err.message, "error");
  }
}

async function openCheckin() {
  const modal = document.getElementById("checkinModal");
  const list = document.getElementById("checkinList");
  if (!modal || !list) return;

  modal.classList.add("open");
  list.innerHTML = '<div class="state-empty">Chargement…</div>';

  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await api.get("/api/appointments", { start: today, end: today });
    const candidates = data.filter((a) => !a.checked_in_at);
    if (!candidates.length) {
      list.innerHTML =
        '<div class="state-empty">Tous les rendez-vous du jour ont déjà une arrivée enregistrée.</div>';
      return;
    }
    list.innerHTML = candidates
      .map(
        (a) => `
        <div class="checkin-item" data-id="${a.id_appointment}">
          <span class="checkin-time">${App.escapeHtml(a.start)}</span>
          <span class="checkin-name">${App.escapeHtml(a.patient_nom)}</span>
          <span class="checkin-type">${App.escapeHtml(a.type_libelle || "")}</span>
          <button class="btn-save" type="button">Arrivée</button>
        </div>`,
      )
      .join("");

    list.querySelectorAll(".checkin-item").forEach((item) => {
      item.querySelector("button").addEventListener("click", async () => {
        try {
          await api.post(`/api/appointments/${item.dataset.id}/check-in`);
          modal.classList.remove("open");
          await reloadAll();
          api.notify("Arrivée enregistrée", "success");
        } catch (err) {
          api.notify(err.message, "error");
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="state-error">${App.escapeHtml(err.message)}</div>`;
  }
}

/* ── Initialisation ─────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  const ready = await App.init({ roles: ["secretariat", "admin", "medecin"] });
  if (!ready) return;

  try {
    await reloadAll();
  } catch (err) {
    api.notify(err.message, "error");
  }

  try {
    const stats = await api.get("/api/statistiques");
    const evolution = (stats.evolution || []).map((e) => e.valeur);
    ["sparkRdv", "sparkArrives", "sparkAppels", "sparkDocs"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const d = evolution
        .map((v, i, arr) => {
          const max = Math.max(...arr, 1);
          const min = Math.min(...arr, 0);
          const span = max - min || 1;
          const step = 72 / (arr.length - 1);
          return `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(28 - ((v - min) / span) * 24).toFixed(1)}`;
        })
        .join(" ");
      el.innerHTML = `<svg viewBox="0 0 72 30" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    });
  } catch {
    /* sparklines optionnelles */
  }

  document.getElementById("btnAddTask")?.addEventListener("click", openTaskForm);
  document.getElementById("btnCancelTask")?.addEventListener("click", closeTaskForm);
  document.getElementById("taskForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("taskInput");
    addTask(input ? input.value : "");
    closeTaskForm();
  });
  document.getElementById("btnCheckIn")?.addEventListener("click", openCheckin);
  document.getElementById("btnCloseCheckin")?.addEventListener("click", () => {
    document.getElementById("checkinModal")?.classList.remove("open");
  });
  document.getElementById("checkinModal")?.addEventListener("click", (e) => {
    if (e.target.id === "checkinModal") e.currentTarget.classList.remove("open");
  });

  document.getElementById("taskList")?.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    const item = e.target.closest(".task-item");
    if (!target || !item) return;
    if (target.dataset.action === "delete") {
      deleteTask(item.dataset.id);
    } else if (target.dataset.action === "toggle") {
      const cb = item.querySelector(".task-cb");
      toggleTask(item.dataset.id, !cb.classList.contains("checked"));
    }
  });

  document.getElementById("callsList")?.addEventListener("click", (e) => {
    const row = e.target.closest("[data-call]");
    if (!row) return;
    const id = row.dataset.call;
    const current = dashboardData?.appels?.find((c) => String(c.id_call) === String(id));
    toggleCall(id, current?.statut === "traite" ? "a_traiter" : "traite");
  });
});
