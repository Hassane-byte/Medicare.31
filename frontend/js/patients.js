// La page est reservee au personnel : l'acces est controle par App.init().

// ═══ DATA ═══
const COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#ec4899",
  "#0891b2",
];

let patients = [];
let staffList = [];
let nextId = 1;
let editingId = null;
let currentView = "table";
let currentPage = 1;
const PER_PAGE = 8;
let sortField = "nom",
  sortAsc = true;

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', async () => {
  const ready = await App.init({ roles: ['medecin', 'secretariat', 'admin'] });
  if (!ready) return;

  await loadStaff();
  await loadPatients();

  // ?new=1 ouvre directement le formulaire de creation (lien depuis un dashboard)
  if (new URLSearchParams(window.location.search).get('new') === '1') {
    openModal();
  }
});

// ═══ MEDECINS ═══
async function loadStaff() {
  try {
    const data = await api.get('/api/appointments/staff');
    staffList = data.filter((s) => s.type_staff === 'medecin');
    fillDoctorSelects();
  } catch (err) {
    api.notify(err.message, 'error');
  }
}

function fillDoctorSelects() {
  const options = staffList
    .map((s) => `<option value="${s.id_staff}">${escapeHtml(s.display)}</option>`)
    .join('');

  const fMed = document.getElementById('fMedecin');
  if (fMed) fMed.innerHTML = `<option value="">--</option>${options}`;

  const fDoc = document.getElementById('filterDoc');
  if (fDoc) {
    fDoc.innerHTML = `<option value="">Tous les médecins</option>${options}`;
  }
}

async function loadPatients() {
  try {
    const data = await api.get('/api/patients', {
      skip: (currentPage - 1) * PER_PAGE,
      limit: PER_PAGE
    });
    patients = data;
    renderAll();
  } catch (err) {
    api.notify(err.message, 'error');
  }
}

function renderAll() {
  filterPatients();
}

function getColor(id) {
  return COLORS[(id - 1) % COLORS.length];
}
function initials(p) {
  return escapeHtml(((p.prenom || "")[0] + (p.nom || "")[0]).toUpperCase());
}
function age(ddn) {
  if (!ddn) return "—";
  const d = new Date(ddn);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}
function fmtDdn(ddn) {
  if (!ddn) return "—";
  const [y, m, d] = ddn.split("-");
  return `${d}/${m}/${y}`;
}

function statusBadge(s) {
  const map = {
    actif: "badge-green",
    nouveau: "badge-blue",
    suivi: "badge-gold",
    inactif: "badge-grey",
  };
  const key = (s || "").trim().toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return `<span class="badge ${map[key] || "badge-grey"}">${escapeHtml(label || "—")}</span>`;
}

// ═══ FILTER & RENDER ═══
async function filterPatients() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const sta = document.getElementById("filterStatus").value;
  const doc = document.getElementById("filterDoc").value;

  try {
    // La recherche et le statut sont filtrés par l'API, le médecin traitant
    // n'étant pas exposé par celle-ci : filtrage local sur la liste reçue.
    const data = await api.get('/api/patients', { search: q, statut: sta });
    patients = doc
      ? data.filter((p) => String(p.medecin_traitant_id) === doc)
      : data;

    // We still do some local sorting for UX speed
    patients.sort((a, b) => {
      let va = a[sortField] || "",
          vb = b[sortField] || "";
      if (sortField === "name") {
        va = a.nom;
        vb = b.nom;
      }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    document.getElementById("statTotal").textContent = patients.length;

    if (currentView === "table") renderTable(patients);
    else renderGrid(patients);
  } catch (err) {
    api.notify(err.message, 'error');
  }
}

function sortBy(field) {
  if (sortField === field) sortAsc = !sortAsc;
  else {
    sortField = field;
    sortAsc = true;
  }
  filterPatients();
}

// ═══ TABLE ═══
function renderTable(list) {
  const total = list.length;
  const pages = Math.ceil(total / PER_PAGE);
  if (currentPage > pages) currentPage = 1;
  const slice = list.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE,
  );

  document.getElementById("tableBody").innerHTML = slice
    .map(
      (p) => `
    <tr onclick="openModal(${p.id_patient})">
      <td><div class="patient-cell">
        <div class="pat-av" style="background:${getColor(p.id_patient)}">${initials(p)}</div>
        <div><div class="pat-name">${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</div><div class="pat-id">${escapeHtml(p.email || '')}</div></div>
      </div></td>
      <td class="td-light">${escapeHtml(p.numero_dossier)}</td>
      <td class="td-light">${fmtDdn(p.date_naissance)} <span class="td-lighter">(${age(p.date_naissance)} ans)</span></td>
      <td class="td-light">${escapeHtml(p.medecin_traitant_nom || "—")}</td>
      <td class="td-light">—</td>
      <td>${statusBadge(p.statut_patient)}</td>
      <td onclick="event.stopPropagation()"><div class="action-cell">
        <button class="icon-btn" title="Voir fiche" onclick="openModal(${p.id_patient})"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="icon-btn" title="Message" onclick="showToast('Messagerie ouverte')"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
        <button class="icon-btn" title="Rendez-vous" onclick="showToast('Agenda ouvert')"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button>
        <button class="icon-btn danger" title="Supprimer" onclick="confirmDelete(${p.id_patient})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div></td>
    </tr>`,
    )
    .join("");

  // Pagination
  document.getElementById("pageInfo").textContent =
    `${Math.min((currentPage - 1) * PER_PAGE + 1, total)}–${Math.min(currentPage * PER_PAGE, total)} sur ${total} patients`;
  const pb = document.getElementById("pageBtns");
  pb.innerHTML = `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""} style="opacity:${currentPage === 1 ? 0.4 : 1}"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>`;
  for (let i = 1; i <= pages; i++)
    pb.innerHTML += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="changePage(${i})">${i}</button>`;
  pb.innerHTML += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === pages ? "disabled" : ""} style="opacity:${currentPage === pages ? 0.4 : 1}"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button>`;
}

function changePage(p) {
  const total = patients.length;
  const pages = Math.ceil(total / PER_PAGE);
  if (p < 1 || p > pages) return;
  currentPage = p;
  filterPatients();
}

// ═══ GRID ═══
function renderGrid(list) {
  document.getElementById("patientGrid").innerHTML = list
    .map(
      (p) => `
    <div class="patient-card" onclick="openModal(${p.id_patient})">
      <div class="pc-top">
        <div class="pc-avatar" style="background:${getColor(p.id_patient)}">${initials(p)}</div>
        <div class="pc-info">
          <div class="pc-name">${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</div>
          <div class="pc-meta">${age(p.date_naissance)} ans · ${escapeHtml(p.sexe || "—")}</div>
          <div class="pc-id">${escapeHtml(p.numero_dossier)}</div>
        </div>
        ${statusBadge(p.statut_patient)}
      </div>
      <div class="pc-divider"></div>
      <div class="pc-rows">
        <div class="pc-row"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${escapeHtml(p.medecin_traitant_nom || "—")}</div>
        <div class="pc-row"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg>${escapeHtml(p.email || "—")}</div>
        <div class="pc-row"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Dossier : ${escapeHtml(p.numero_dossier)}</div>
      </div>
      <div class="pc-foot">
        <div class="pc-actions">
          <button class="pc-btn primary" onclick="event.stopPropagation();openModal(${p.id_patient})">Voir fiche</button>
          <button class="pc-btn ghost" onclick="event.stopPropagation();showToast('Messagerie ouverte')">Message</button>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

// ═══ VIEW SWITCH ═══
function setView(v) {
  currentView = v;
  document.getElementById("vTable").classList.toggle("active", v === "table");
  document.getElementById("vGrid").classList.toggle("active", v === "grid");
  document.getElementById("tableView").style.display =
    v === "table" ? "block" : "none";
  document.getElementById("gridView").style.display =
    v === "grid" ? "block" : "none";
  filterPatients();
}

// ═══ MODAL ═══
let activeTab = 0;
async function openModal(id) {
  editingId = id || null;
  activeTab = 0;

  document
    .querySelectorAll(".modal-tab")
    .forEach((t, i) => t.classList.toggle("active", i === 0));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p, i) => p.classList.toggle("active", i === 0));

  if (id) {
    try {
      const p = await api.get(`/api/patients/${id}`);
      document.getElementById("modalTitleText").textContent =
        `${p.prenom} ${p.nom}`;
      document.getElementById("btnDelete").style.display = "flex";
      document.getElementById("fCiv").value = p.civilite || "M.";
      document.getElementById("fNom").value = p.nom || "";
      document.getElementById("fPrenom").value = p.prenom || "";
      document.getElementById("fDdn").value = p.date_naissance || "";
      document.getElementById("fEmail").value = p.email || "";
      document.getElementById("fTel").value = p.telephone_principal || "";
      document.getElementById("fAdresse").value = p.adresse_ligne1 || "";
      document.getElementById("fCp").value = p.code_postal || "";
      document.getElementById("fVille").value = p.ville || "";
      document.getElementById("fMedecin").value = p.medecin_traitant_id || "";
      document.getElementById("fStatut").value = p.statut_patient || "actif";
      document.getElementById("fMutuelle").value = "";
      document.getElementById("fGroupe").value = p.groupe_sanguin || "";
      document.getElementById("fAllergie").value = p.allergie_resume || "";
      document.getElementById("fNotes").value = "";
      document.getElementById("fSexe").value = p.sexe || "";
      document.getElementById("fTaille").value = "";
      document.getElementById("fPoids").value = "";
      document.getElementById("fTA").value = "";
      document.getElementById("hs-taille").textContent = "—";
      document.getElementById("hs-poids").textContent = "—";
      document.getElementById("hs-ta").textContent = "—";
    } catch (err) {
      api.notify(err.message, 'error');
      return;
    }
  } else {
    document.getElementById("modalTitleText").textContent = "Nouveau patient";
    document.getElementById("btnDelete").style.display = "none";
    [
      "fNom",
      "fPrenom",
      "fDdn",
      "fEmail",
      "fTel",
      "fTel2",
      "fAdresse",
      "fCp",
      "fVille",
      "fMutuelle",
      "fAllergie",
      "fNotes",
      "fSecu",
      "fTaille",
      "fPoids",
      "fTA",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    ["fCiv", "fSexe", "fGroupe", "fMedecin", "fStatut"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    document.getElementById("hs-taille").textContent = "—";
    document.getElementById("hs-poids").textContent = "—";
    document.getElementById("hs-ta").textContent = "—";
  }
  document.getElementById("modalOverlay").classList.add("open");
}

function switchTab(i) {
  activeTab = i;
  document
    .querySelectorAll(".modal-tab")
    .forEach((t, j) => t.classList.toggle("active", j === i));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p, j) => p.classList.toggle("active", j === i));
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  editingId = null;
}
function closeModalOut(e) {
  if (e.target === document.getElementById("modalOverlay")) closeModal();
}

async function savePatient() {
  const nom = document.getElementById("fNom").value.trim();
  const prenom = document.getElementById("fPrenom").value.trim();
  if (!nom || !prenom) {
    api.notify("Nom et prénom obligatoires.", 'error');
    return;
  }

  const data = {
    nom,
    prenom,
    civilite: document.getElementById("fCiv").value,
    date_naissance: document.getElementById("fDdn").value,
    sexe: document.getElementById("fSexe").value,
    groupe_sanguin: document.getElementById("fGroupe").value,
    allergie_resume: document.getElementById("fAllergie").value,
    statut_patient: document.getElementById("fStatut").value,
    medecin_traitant_id: parseInt(document.getElementById("fMedecin").value) || null,
    // Les coordonnées sont imbriquées : l'API attend un objet `contact`.
    contact: {
      email: document.getElementById("fEmail").value,
      telephone_principal: document.getElementById("fTel").value,
      telephone_secondaire: document.getElementById("fTel2").value,
      adresse_ligne1: document.getElementById("fAdresse").value,
      code_postal: document.getElementById("fCp").value,
      ville: document.getElementById("fVille").value,
      pays: "France",
    },
  };

  const btn = document.getElementById("saveBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sauvegarde...";
  }

  try {
    if (editingId) {
      await api.put(`/api/patients/${editingId}`, data);
      api.notify("Patient mis à jour", 'success');
    } else {
      await api.post('/api/patients', data);
      api.notify("Patient créé avec succès", 'success');
    }
    closeModal();

    // Le nouveau dossier est le dernier de la liste : on filtre sur son nom
    // pour l'afficher immédiatement, quelle que soit la pagination.
    if (!editingId) {
      const search = document.getElementById('searchInput');
      if (search) search.value = data.nom;
      currentPage = 1;
    }

    await loadPatients();
  } catch (err) {
    api.notify(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Sauvegarder";
    }
  }
}

async function confirmDelete(id) {
  const p = patients.find((x) => x.id_patient === id);
  if (!p) return;
  if (confirm(`Supprimer le patient ${p.prenom} ${p.nom} ?`)) {
    try {
      await api.del(`/api/patients/${id}`);
      api.notify("Patient supprimé", 'success');
      await loadPatients();
    } catch (err) {
      api.notify(err.message, 'error');
    }
  }
}

async function deletePatient() {
  if (!editingId) return;
  const p = patients.find((x) => x.id_patient === editingId);
  if (!p) return;
  if (confirm(`Supprimer ${p.prenom} ${p.nom} ?`)) {
    try {
      await api.del(`/api/patients/${editingId}`);
      closeModal();
      api.notify("Patient supprimé", 'success');
      await loadPatients();
    } catch (err) {
      api.notify(err.message, 'error');
    }
  }
}

function showToast(msg) {
  api.notify(msg, 'info');
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
