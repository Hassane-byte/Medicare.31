/**
 * Espace patient : toutes les données proviennent de /api/dashboard.
 */

let data = null;
let docFilter = null;
let historyExpanded = false;

const DOC_LABELS = {
  analyse: "Analyse",
  ordonnance: "Ordonnance",
  certificat: "Certificat",
  compte_rendu: "Compte-rendu",
};

/* ── Rendu ───────────────────────────────────────────────────────────────── */

function renderProchainRdv(rdv) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  if (!rdv) {
    set("rdvDate", "Aucun rendez-vous à venir");
    set("rdvTime", "—");
    set("rdvType", "—");
    set("rdvDoctor", "—");
    set("rdvAddress", "—");
    const link = document.getElementById("rdvLink");
    if (link) link.classList.add("hidden");
    return;
  }

  const link = document.getElementById("rdvLink");
  if (link) link.classList.remove("hidden");

  set("rdvDate", App.fmtDateFr(rdv.start_at));
  set("rdvTime", `${rdv.start} – ${rdv.end}`);
  set("rdvType", rdv.type_libelle || "Consultation");
  set("rdvDoctor", rdv.staff_nom || "—");
  set("rdvAddress", rdv.room_nom ? `Salle : ${rdv.room_nom}` : "—");
}

function renderHistorique(list) {
  const el = document.getElementById("consultList");
  const lastEl = document.getElementById("lastConsult");
  if (!el) return;

  if (!list.length) {
    el.innerHTML =
      '<div class="state-empty">Aucune consultation enregistrée pour le moment.</div>';
    if (lastEl) lastEl.textContent = "Aucun antécédent enregistré";
    return;
  }

  if (lastEl) {
    lastEl.innerHTML = `Dernière consultation : <strong>${App.escapeHtml(list[0].titre)}</strong>`;
  }

  const shown = historyExpanded ? list : list.slice(0, 2);
  el.innerHTML = shown
    .map((e) => {
      const parts = String(e.staff_nom || "—").split(" ");
      const initials = App.initials(parts[0], parts[parts.length - 1]);
      return `
      <div class="consult-row">
        <div class="consult-avatar">${App.escapeHtml(initials)}</div>
        <div class="consult-info">
          <div class="consult-title">${App.escapeHtml(e.titre)}</div>
          <div class="consult-doctor">${App.escapeHtml(e.staff_nom || "—")} · ${App.escapeHtml(App.fmtDateShort(e.event_date))}</div>
        </div>
      </div>`;
    })
    .join("");

  const toggle = document.getElementById("toggleHistory");
  if (toggle) {
    toggle.innerHTML = historyExpanded
      ? 'Réduire l\'historique <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>'
      : 'Voir tout l\'historique médical <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>';
  }
}

function renderMessages(list) {
  const el = document.getElementById("msgList");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="state-empty">Aucun message.</div>';
    return;
  }
  el.innerHTML = list
    .map((m) => {
      const parts = String(m.expediteur || "").split(" ");
      const initials = App.initials(parts[0], parts[parts.length - 1]);
      return `
      <div class="msg-row">
        <div class="msg-avatar">${App.escapeHtml(initials)}</div>
        <div class="msg-body">
          <div class="msg-top">
            <span class="msg-sender">${App.escapeHtml(m.expediteur || "Équipe soignante")}</span>
            ${m.non_lu ? '<span class="badge-unread">Non lu</span>' : ""}
            <span class="msg-date">${App.escapeHtml(App.fmtRelative(m.date))}</span>
          </div>
          <div class="msg-text">${App.escapeHtml(m.apercu || m.sujet || "")}</div>
        </div>
      </div>`;
    })
    .join("");
}

function renderConstantes(c) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set("healthTaille", c.taille_cm ? `${(c.taille_cm / 100).toFixed(2).replace(".", ",")} m` : "—");
  set("healthPoids", c.poids_kg ? `${Number(c.poids_kg).toFixed(1).replace(".", ",")} kg` : "—");
  set("healthTension", c.tension_arterielle ? `${c.tension_arterielle} mmHg` : "—");

  const details = document.getElementById("healthDetails");
  if (details) {
    details.classList.add("hidden");
    details.innerHTML = c.date_mesure
      ? `<div class="state-empty">Dernières mesures relevées le ${App.escapeHtml(App.fmtDateFr(c.date_mesure))}.</div>`
      : "";
  }
}

function renderNotifications(list) {
  const el = document.getElementById("notifList");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="state-empty">Aucune notification.</div>';
    return;
  }
  const shown = list.slice(0, 3);
  el.innerHTML = shown
    .map(
      (n) => `
      <div class="notif-row">
        <div class="notif-icon">
          <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <div class="notif-body">
          <div class="notif-top">
            <span class="notif-sender">${App.escapeHtml(n.titre)}</span>
            <span class="notif-time">${App.escapeHtml(App.fmtRelative(n.created_at))}</span>
          </div>
          <div class="notif-text">${App.escapeHtml(n.contenu || "")}</div>
          ${n.is_read ? "" : '<span class="badge-new">Non lu</span>'}
        </div>
      </div>`,
    )
    .join("");
}

function docRow(d, large) {
  const date = d.document_date ? App.fmtDateShort(d.document_date) : App.fmtRelative(d.created_at);
  if (large) {
    return `
    <div class="doc-row-lg">
      <div class="doc-icon">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="9" x2="9" y2="21" />
        </svg>
      </div>
      <span class="doc-name">${App.escapeHtml(d.titre)}</span>
      <span class="doc-date-inline">${App.escapeHtml(date)}</span>
      <span class="badge badge-blue">${App.escapeHtml(DOC_LABELS[d.document_type] || d.document_type)}</span>
    </div>`;
  }
  return `
  <div class="doc-row">
    <div class="doc-icon">
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="9" x2="9" y2="21" />
      </svg>
    </div>
    <span class="doc-name">${App.escapeHtml(d.titre)}</span>
    <span class="doc-date">${App.escapeHtml(date)}</span>
  </div>`;
}

function renderDocuments(list) {
  const filtered = docFilter ? list.filter((d) => d.document_type === docFilter) : list;
  const small = document.getElementById("docsList");
  const large = document.getElementById("docsListLarge");

  const empty = `<div class="state-empty">Aucun document${docFilter ? " de ce type" : ""}.</div>`;

  if (small) {
    small.innerHTML = filtered.length
      ? filtered.slice(0, 3).map((d) => docRow(d, false)).join("")
      : empty;
  }
  if (large) {
    large.innerHTML = filtered.length
      ? filtered.map((d) => docRow(d, true)).join("")
      : empty;
  }
}

/* ── Chargement ─────────────────────────────────────────────────────────── */

async function loadDashboard() {
  data = await api.get("/api/dashboard");
  renderProchainRdv(data.prochain_rdv);
  renderHistorique(data.historique || []);
  renderMessages(data.derniers_messages || []);
  renderConstantes(data.constantes || {});
  renderNotifications(data.notifications || []);
  renderDocuments(data.documents || []);
}

/* ── Initialisation ─────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  const ready = await App.init({ roles: ["patient"] });
  if (!ready) return;

  try {
    await loadDashboard();
  } catch (err) {
    api.notify(err.message, "error");
  }

  document.getElementById("toggleHistory")?.addEventListener("click", (e) => {
    e.preventDefault();
    historyExpanded = !historyExpanded;
    renderHistorique(data?.historique || []);
  });

  document.getElementById("toggleHealth")?.addEventListener("click", (e) => {
    e.preventDefault();
    const details = document.getElementById("healthDetails");
    if (details) details.classList.toggle("hidden");
  });

  document.getElementById("toggleNotif")?.addEventListener("click", (e) => {
    e.preventDefault();
    const panel = document.getElementById("notifPanel");
    if (panel) panel.classList.toggle("open");
  });

  document.getElementById("quickGrid")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".quick-btn");
    if (!btn) return;
    const type = btn.dataset.docType;
    docFilter = docFilter === type ? null : type;
    document.querySelectorAll(".quick-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.docType === docFilter);
    });
    renderDocuments(data?.documents || []);
    document.getElementById("docsListLarge")?.scrollIntoView({ behavior: "smooth" });
  });
});
