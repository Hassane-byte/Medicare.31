/**
 * Tableau de bord du personnel médical.
 * Toutes les données proviennent de /api/dashboard et /api/statistiques.
 */

let dashboardData = null;

/* ── Rendu ───────────────────────────────────────────────────────────────── */

function sparklinePath(values) {
  const data = (values || []).filter((v) => typeof v === "number");
  if (data.length < 2) return "";
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const step = 72 / (data.length - 1);
  return data
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (28 - ((v - min) / span) * 24).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

function renderSparkline(el, values) {
  if (!el) return;
  const d = sparklinePath(values);
  el.innerHTML = d
    ? `<svg viewBox="0 0 72 30" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    : "";
}

function renderStats(stats) {
  document.getElementById("statRdvJour").textContent = stats.rdv_jour ?? 0;
  document.getElementById("statSalleAttente").textContent = stats.salle_attente ?? 0;
  document.getElementById("statMessages").textContent = stats.messages_non_lus ?? 0;
  document.getElementById("statTaches").textContent = stats.taches_a_faire ?? 0;
}

function renderProchainsRdv(list) {
  const el = document.getElementById("prochainsRdv");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="state-empty"><strong>Aucun rendez-vous à venir</strong>Les prochains rendez-vous apparaîtront ici.</div>';
    return;
  }
  el.innerHTML = list
    .slice(0, 4)
    .map(
      (a) => `
      <div class="appt-row">
        <span class="appt-time">${App.escapeHtml(a.start)}</span>
        <div style="flex: 1">
          <span class="appt-name">${App.escapeHtml(a.patient_nom)}</span>
          ${a.type_libelle ? `<span class="appt-type">${App.escapeHtml(a.type_libelle)}</span>` : ""}
        </div>
        <span class="badge ${App.badgeClass(a.statut)}">${App.escapeHtml(a.statut_label || a.statut)}</span>
      </div>`,
    )
    .join("");
}

function renderSalleAttente(list) {
  const el = document.getElementById("salleAttente");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="state-empty"><strong>Personne en salle d\'attente</strong>Les arrivées enregistrées apparaîtront ici.</div>';
    return;
  }
  const colors = ["", "green", "orange", "purple"];
  el.innerHTML = list
    .map((a, i) => {
      const initials = App.initials(...String(a.patient_nom || " ").split(" "));
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

function renderMessages(list) {
  const el = document.getElementById("derniersMessages");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="state-empty"><strong>Aucun message</strong>La messagerie est vide.</div>';
    return;
  }
  el.innerHTML = list
    .map(
      (m) => `
      <div class="msg-row" onclick="window.location.href='messagerie.html'">
        <div class="msg-icon ${m.non_lu ? "unread" : "read"}">
          <svg viewBox="0 0 24 24">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <div class="msg-body">
          <span class="msg-name">${App.escapeHtml(m.expediteur || m.sujet)}</span
          ><span class="msg-subject">${App.escapeHtml(m.sujet)}</span>
        </div>
        <div class="msg-time${m.non_lu ? " bold" : ""}">${App.escapeHtml(App.fmtRelative(m.date))}</div>
      </div>`,
    )
    .join("");
}

function renderTasks(tasks) {
  const el = document.getElementById("taskList");
  if (!el) return;
  if (!tasks.length) {
    el.innerHTML = '<div class="state-empty"><strong>Aucune tâche</strong>Ajoutez une tâche pour ne rien oublier.</div>';
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

async function reloadDashboard() {
  dashboardData = await api.get("/api/dashboard");
  renderStats(dashboardData.stats || {});
  renderProchainsRdv(dashboardData.prochains_rdv || []);
  renderSalleAttente(dashboardData.salle_attente || []);
  renderMessages(dashboardData.derniers_messages || []);

  const tasks = await api.get("/api/tasks");
  renderTasks(tasks);
}

async function addTask(titre) {
  if (!titre || !titre.trim()) return;
  try {
    await api.post("/api/tasks", { titre: titre.trim() });
    await reloadDashboard();
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
    await reloadDashboard();
  } catch (err) {
    api.notify(err.message, "error");
  }
}

async function deleteTask(id) {
  try {
    await api.del(`/api/tasks/${id}`);
    await reloadDashboard();
    api.notify("Tâche supprimée", "success");
  } catch (err) {
    api.notify(err.message, "error");
  }
}

/* ── Initialisation ─────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  const ready = await App.init({ roles: ["medecin", "secretariat", "admin"] });
  if (!ready) return;

  try {
    await reloadDashboard();
  } catch (err) {
    api.notify(err.message, "error");
  }

  // Sparklines : évolution réelle des 12 dernières semaines.
  try {
    const stats = await api.get("/api/statistiques");
    const evolution = (stats.evolution || []).map((e) => e.valeur);
    renderSparkline(document.getElementById("sparkRdv"), evolution);
    renderSparkline(document.getElementById("sparkTaches"), evolution);
    renderSparkline(document.getElementById("sparkSalle"), evolution);
    renderSparkline(
      document.getElementById("sparkMessages"),
      (stats.patients || []).map((p) => p.valeur),
    );
  } catch {
    /* les sparklines restent vides si les statistiques sont indisponibles */
  }

  document.getElementById("btnAddTask")?.addEventListener("click", openTaskForm);
  document.getElementById("btnCancelTask")?.addEventListener("click", closeTaskForm);
  document.getElementById("taskForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("taskInput");
    addTask(input ? input.value : "");
    closeTaskForm();
  });

  document.getElementById("taskList")?.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    const item = e.target.closest(".task-item");
    if (!target || !item) return;
    const id = item.dataset.id;
    if (target.dataset.action === "delete") {
      deleteTask(id);
    } else if (target.dataset.action === "toggle") {
      const cb = item.querySelector(".task-cb");
      toggleTask(id, !cb.classList.contains("checked"));
    }
  });
});
