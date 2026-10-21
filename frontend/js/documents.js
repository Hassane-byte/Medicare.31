/**
 * Module documentaire : liste, filtres, dépôt et suivi du traitement.
 */

let documents = [];
let patients = [];
let isStaff = false;

const TYPE_LABELS = {
  analyse: "Analyse",
  ordonnance: "Ordonnance",
  certificat: "Certificat",
  compte_rendu: "Compte-rendu",
};

const STATUT_LABELS = {
  a_classer: "À classer",
  imprime: "Imprimé",
  envoye: "Envoyé",
};

/* ── Rendu ───────────────────────────────────────────────────────────────── */

function visibleDocuments() {
  const needle = document.getElementById("searchDoc").value.trim().toLowerCase();
  const type = document.getElementById("filterType").value;
  const patient = document.getElementById("filterPatient").value;

  return documents.filter((d) => {
    const haystack = `${d.titre} ${d.patient_nom || ""} ${d.source_label || ""}`.toLowerCase();
    if (needle && !haystack.includes(needle)) return false;
    if (type && d.document_type !== type) return false;
    if (patient && String(d.id_patient) !== patient) return false;
    return true;
  });
}

function renderStats() {
  const el = document.getElementById("docStats");
  if (!el) return;

  const total = documents.length;
  const aClasser = documents.filter((d) => d.statut === "a_classer").length;
  const envoyes = documents.filter((d) => d.statut === "envoye").length;

  el.innerHTML = `
    <div class="doc-stat"><span class="doc-stat-num">${total}</span><span class="doc-stat-label">Documents</span></div>
    <div class="doc-stat"><span class="doc-stat-num">${aClasser}</span><span class="doc-stat-label">À classer</span></div>
    <div class="doc-stat"><span class="doc-stat-num">${envoyes}</span><span class="doc-stat-label">Envoyés</span></div>`;
}

function renderDocuments() {
  const el = document.getElementById("docList");
  if (!el) return;

  const list = visibleDocuments();

  if (!list.length) {
    el.innerHTML =
      '<div class="state-empty"><strong>Aucun document</strong>Aucun document ne correspond aux filtres.</div>';
    return;
  }

  el.innerHTML = list
    .map(
      (d) => `
      <div class="doc-item" data-id="${d.id_document}">
        <div class="doc-item-icon">
          <svg viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div class="doc-item-body">
          <div class="doc-item-title">${App.escapeHtml(d.titre)}</div>
          <div class="doc-item-meta">
            <span class="badge badge-blue">${App.escapeHtml(TYPE_LABELS[d.document_type] || d.document_type)}</span>
            ${isStaff && d.patient_nom ? `<span>${App.escapeHtml(d.patient_nom)}</span>` : ""}
            ${d.source_label ? `<span>${App.escapeHtml(d.source_label)}</span>` : ""}
            <span>${App.escapeHtml(d.document_date ? App.fmtDateShort(d.document_date) : App.fmtRelative(d.created_at))}</span>
            ${d.taille_ko ? `<span>${d.taille_ko} Ko</span>` : ""}
          </div>
        </div>
        <div class="doc-item-actions">
          <span class="badge ${App.badgeClass(d.statut)}">${App.escapeHtml(STATUT_LABELS[d.statut] || d.statut)}</span>
          <a class="btn-small" href="${App.escapeHtml(d.fichier_url || "#")}" target="_blank" rel="noopener">Ouvrir</a>
          ${
            isStaff
              ? `<select class="doc-status" data-id="${d.id_document}">
                   ${Object.entries(STATUT_LABELS)
                     .map(
                       ([value, label]) =>
                         `<option value="${value}"${d.statut === value ? " selected" : ""}>${label}</option>`,
                     )
                     .join("")}
                 </select>
                 <button class="btn-small danger" type="button" data-delete="${d.id_document}">Supprimer</button>`
              : ""
          }
        </div>
      </div>`,
    )
    .join("");
}

/* ── Actions ────────────────────────────────────────────────────────────── */

async function changeStatus(id, statut) {
  try {
    await api.patch(`/api/documents/${id}?statut=${encodeURIComponent(statut)}`);
    await loadDocuments();
    api.notify("Statut mis à jour", "success");
  } catch (err) {
    api.notify(err.message, "error");
  }
}

async function deleteDoc(id) {
  if (!confirm("Supprimer définitivement ce document ?")) return;
  try {
    await api.del(`/api/documents/${id}`);
    await loadDocuments();
    api.notify("Document supprimé", "success");
  } catch (err) {
    api.notify(err.message, "error");
  }
}

async function submitUpload() {
  const file = document.getElementById("upFile").files[0];
  const patient = document.getElementById("upPatient").value;
  const titre = document.getElementById("upTitre").value.trim();

  if (!file || !patient || !titre) {
    api.notify("Patient, titre et fichier sont obligatoires.", "error");
    return;
  }

  const form = new FormData();
  form.append("file", file);
  form.append("id_patient", patient);
  form.append("document_type", document.getElementById("upType").value);
  form.append("titre", titre);
  form.append("document_date", document.getElementById("upDate").value || "");

  const btn = document.getElementById("btnSaveUpload");
  btn.disabled = true;
  btn.textContent = "Dépôt…";

  try {
    await api.post("/api/documents/upload", form);
    document.getElementById("uploadModal").classList.remove("open");
    document.getElementById("upFile").value = "";
    document.getElementById("upTitre").value = "";
    await loadDocuments();
    api.notify("Document déposé", "success");
  } catch (err) {
    api.notify(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Déposer";
  }
}

/* ── Chargement ─────────────────────────────────────────────────────────── */

async function loadDocuments() {
  documents = await api.get("/api/documents", { limit: 300 });
  renderStats();
  renderDocuments();
}

async function loadPatients() {
  if (!isStaff) return;
  try {
    patients = await api.get("/api/patients", { limit: 100 });
  } catch {
    patients = [];
  }
  const options = patients
    .map(
      (p) =>
        `<option value="${p.id_patient}">${App.escapeHtml(p.prenom)} ${App.escapeHtml(p.nom)}</option>`,
    )
    .join("");

  const filter = document.getElementById("filterPatient");
  if (filter) {
    filter.innerHTML = `<option value="">Tous les patients</option>${options}`;
    filter.classList.remove("hidden");
  }
  const upPatient = document.getElementById("upPatient");
  if (upPatient) upPatient.innerHTML = `<option value="">-- Choisir --</option>${options}`;
}

/* ── Initialisation ─────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  const ready = await App.init();
  if (!ready) return;

  isStaff = ["medecin", "secretariat", "admin"].includes(App.me?.role);

  if (isStaff) {
    document.getElementById("btnUpload")?.classList.remove("hidden");
  }

  try {
    await loadDocuments();
    await loadPatients();
  } catch (err) {
    api.notify(err.message, "error");
  }

  document.getElementById("btnUpload")?.addEventListener("click", () => {
    document.getElementById("uploadModal").classList.add("open");
  });
  document.getElementById("btnCloseUpload")?.addEventListener("click", () => {
    document.getElementById("uploadModal").classList.remove("open");
  });
  document.getElementById("btnCancelUpload")?.addEventListener("click", () => {
    document.getElementById("uploadModal").classList.remove("open");
  });
  document.getElementById("btnSaveUpload")?.addEventListener("click", submitUpload);
  document.getElementById("uploadModal")?.addEventListener("click", (e) => {
    if (e.target.id === "uploadModal") e.currentTarget.classList.remove("open");
  });

  document.getElementById("docList")?.addEventListener("change", (e) => {
    const select = e.target.closest(".doc-status");
    if (select) changeStatus(select.dataset.id, select.value);
  });
  document.getElementById("docList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete]");
    if (btn) deleteDoc(btn.dataset.delete);
  });
});
