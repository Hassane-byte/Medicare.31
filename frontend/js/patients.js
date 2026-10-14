authGuard();

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
let nextId = 1;
let editingId = null;
let currentView = "table";
let currentPage = 1;
const PER_PAGE = 8;
let sortField = "nom",
  sortAsc = true;

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', async () => {
  await loadPatients();
});

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
  return (p.prenom[0] + p.nom[0]).toUpperCase();
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
    Actif: "badge-green",
    Nouveau: "badge-blue",
    Suivi: "badge-gold",
    Inactif: "badge-grey",
  };
  return `<span class="badge ${map[s] || "badge-grey"}">${s}</span>`;
}

// ═══ FILTER & RENDER ═══
async function filterPatients() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const sta = document.getElementById("filterStatus").value;
  const doc = document.getElementById("filterDoc").value;

  try {
    // In production, we'd send these filters to the API
    // For now, we fetch the list and filter locally or update the API call
    const data = await api.get('/api/patients', { search: q, statut: sta });
    patients = data;

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
        <div><div class="pat-name">${p.prenom} ${p.nom}</div><div class="pat-id">${p.email || ''}</div></div>
      </div></td>
      <td class="td-light">${p.numero_dossier}</td>
      <td class="td-light">${fmtDdn(p.date_naissance)} <span class="td-lighter">(${age(p.date_naissance)} ans)</span></td>
      <td class="td-light">${p.medecin_traitant_id || "—"}</td>
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
          <div class="pc-name">${p.prenom} ${p.nom}</div>
          <div class="pc-meta">${age(p.date_naissance)} ans · ${p.sexe || "—"}</div>
          <div class="pc-id">${p.numero_dossier}</div>
        </div>
        ${statusBadge(p.statut_patient)}
      </div>
      <div class="pc-divider"></div>
      <div class="pc-rows">
        <div class="pc-row"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${p.medecin_traitant_id || "—"}</div>
        <div class="pc-row"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg>${p.email || "—"}</div>
        <div class="pc-row"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Dossier : ${p.numero_dossier}</div>
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
      document.getElementById("fStatut").value = p.statut_patient || "Actif";
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
    email: document.getElementById("fEmail").value,
    telephone_principal: document.getElementById("fTel").value,
    adresse_ligne1: document.getElementById("fAdresse").value,
    code_postal: document.getElementById("fCp").value,
    ville: document.getElementById("fVille").value,
    medecin_traitant_id: parseInt(document.getElementById("fMedecin").value) || null,
    statut_patient: document.getElementById("fStatut").value,
    groupe_sanguin: document.getElementById("fGroupe").value,
    allergie_resume: document.getElementById("fAllergie").value,
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


let patients = [
  {
    id: 1,
    nom: "Durand",
    prenom: "Sophie",
    ddn: "1985-03-12",
    sexe: "Féminin",
    dossier: "P-2024-0721",
    medecin: "Dr. Jean Martin",
    statut: "Actif",
    lastVisit: "02/06/2025",
    tel: "06 55 44 33 22",
    email: "sophie.durand@email.fr",
    ville: "Toulouse",
    groupe: "A+",
    allergie: "Aucune connue",
  },
  {
    id: 2,
    nom: "Robert",
    prenom: "Alain",
    ddn: "1962-07-28",
    sexe: "Masculin",
    dossier: "P-2024-0834",
    medecin: "Dr. Jean Martin",
    statut: "Suivi",
    lastVisit: "02/06/2025",
    tel: "06 12 45 78 90",
    email: "alain.robert@email.fr",
    ville: "Toulouse",
    groupe: "O+",
    allergie: "Pénicilline",
  },
  {
    id: 3,
    nom: "Lefèvre",
    prenom: "Julie",
    ddn: "1990-11-05",
    sexe: "Féminin",
    dossier: "P-2024-0902",
    medecin: "Dr. Sophie Blanc",
    statut: "Actif",
    lastVisit: "28/05/2025",
    tel: "07 88 21 36 54",
    email: "julie.lefevre@email.fr",
    ville: "Toulouse",
    groupe: "B+",
    allergie: "Aspirine",
  },
  {
    id: 4,
    nom: "Dupont",
    prenom: "Marc",
    ddn: "1978-09-15",
    sexe: "Masculin",
    dossier: "P-2024-1182",
    medecin: "Dr. Ahmed Karim",
    statut: "Nouveau",
    lastVisit: "01/06/2025",
    tel: "06 98 76 54 32",
    email: "marc.dupont@email.fr",
    ville: "Blagnac",
    groupe: "AB-",
    allergie: "Aucune connue",
  },
  {
    id: 5,
    nom: "Martin",
    prenom: "Claire",
    ddn: "1995-04-22",
    sexe: "Féminin",
    dossier: "P-2024-1203",
    medecin: "Dr. Marie Leclerc",
    statut: "Actif",
    lastVisit: "03/06/2025",
    tel: "06 33 22 11 44",
    email: "claire.martin@email.fr",
    ville: "Colomiers",
    groupe: "O-",
    allergie: "Latex",
  },
  {
    id: 6,
    nom: "Lefebvre",
    prenom: "Paul",
    ddn: "1955-12-01",
    sexe: "Masculin",
    dossier: "P-2024-1098",
    medecin: "Dr. Jean Martin",
    statut: "Suivi",
    lastVisit: "04/06/2025",
    tel: "05 61 22 33 44",
    email: "paul.lefebvre@email.fr",
    ville: "Toulouse",
    groupe: "A-",
    allergie: "Aucune connue",
  },
  {
    id: 7,
    nom: "Lambert",
    prenom: "Thomas",
    ddn: "1988-06-17",
    sexe: "Masculin",
    dossier: "P-2024-1312",
    medecin: "Dr. Sophie Blanc",
    statut: "Actif",
    lastVisit: "10/05/2025",
    tel: "06 77 88 99 00",
    email: "thomas.lambert@email.fr",
    ville: "Muret",
    groupe: "B-",
    allergie: "Aucune connue",
  },
  {
    id: 8,
    nom: "Moreau",
    prenom: "Laura",
    ddn: "2001-02-14",
    sexe: "Féminin",
    dossier: "P-2024-0934",
    medecin: "Dr. Jean Martin",
    statut: "Actif",
    lastVisit: "28/04/2025",
    tel: "06 44 55 66 77",
    email: "laura.moreau@email.fr",
    ville: "Toulouse",
    groupe: "O+",
    allergie: "Iode",
  },
  {
    id: 9,
    nom: "Bernard",
    prenom: "Henri",
    ddn: "1948-08-30",
    sexe: "Masculin",
    dossier: "P-2023-0415",
    medecin: "Dr. Ahmed Karim",
    statut: "Inactif",
    lastVisit: "15/12/2024",
    tel: "05 61 44 55 66",
    email: "henri.bernard@email.fr",
    ville: "Toulouse",
    groupe: "A+",
    allergie: "Aucune connue",
  },
  {
    id: 10,
    nom: "Garcia",
    prenom: "Isabelle",
    ddn: "1972-05-09",
    sexe: "Féminin",
    dossier: "P-2024-0656",
    medecin: "Dr. Marie Leclerc",
    statut: "Actif",
    lastVisit: "20/05/2025",
    tel: "06 22 33 44 55",
    email: "isabelle.garcia@email.fr",
    ville: "Balma",
    groupe: "AB+",
    allergie: "Sulfamides",
  },
  {
    id: 11,
    nom: "Petit",
    prenom: "Antoine",
    ddn: "1982-10-23",
    sexe: "Masculin",
    dossier: "P-2024-1024",
    medecin: "Dr. Jean Martin",
    statut: "Actif",
    lastVisit: "18/05/2025",
    tel: "06 11 22 33 44",
    email: "antoine.petit@email.fr",
    ville: "Toulouse",
    groupe: "O+",
    allergie: "Aucune connue",
  },
  {
    id: 12,
    nom: "Giraud",
    prenom: "Nathalie",
    ddn: "1968-01-19",
    sexe: "Féminin",
    dossier: "P-2023-0789",
    medecin: "Dr. Sophie Blanc",
    statut: "Suivi",
    lastVisit: "12/05/2025",
    tel: "06 99 00 11 22",
    email: "nathalie.giraud@email.fr",
    ville: "Toulouse",
    groupe: "B+",
    allergie: "Aucune connue",
  },
];
let nextId = 13;
let editingId = null;
let currentView = "table";
let currentPage = 1;
const PER_PAGE = 8;
let sortField = "nom",
  sortAsc = true;

// ═══ INIT ═══
renderAll();

function renderAll() {
  filterPatients();
}

function getColor(id) {
  return COLORS[(id - 1) % COLORS.length];
}
function initials(p) {
  return (p.prenom[0] + p.nom[0]).toUpperCase();
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
    Actif: "badge-green",
    Nouveau: "badge-blue",
    Suivi: "badge-gold",
    Inactif: "badge-grey",
  };
  return `<span class="badge ${map[s] || "badge-grey"}">${s}</span>`;
}

// ═══ FILTER & RENDER ═══
function filterPatients() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const sta = document.getElementById("filterStatus").value;
  const doc = document.getElementById("filterDoc").value;

  let list = patients.filter((p) => {
    const full = `${p.prenom} ${p.nom} ${p.dossier}`.toLowerCase();
    return (
      (!q || full.includes(q)) &&
      (!sta || p.statut === sta) &&
      (!doc || p.medecin === doc)
    );
  });

  list.sort((a, b) => {
    let va = a[sortField] || "",
      vb = b[sortField] || "";
    if (sortField === "name") {
      va = a.nom;
      vb = b.nom;
    }
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  document.getElementById("statTotal").textContent = patients.length;

  if (currentView === "table") renderTable(list);
  else renderGrid(list);
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
    <tr onclick="openModal(${p.id})">
      <td><div class="patient-cell">
        <div class="pat-av" style="background:${getColor(p.id)}">${initials(p)}</div>
        <div><div class="pat-name">${p.prenom} ${p.nom}</div><div class="pat-id">${p.email}</div></div>
      </div></td>
      <td class="td-light">${p.dossier}</td>
      <td class="td-light">${fmtDdn(p.ddn)} <span class="td-lighter">(${age(p.ddn)} ans)</span></td>
      <td class="td-light">${p.medecin || "—"}</td>
      <td class="td-light">${p.lastVisit || "—"}</td>
      <td>${statusBadge(p.statut)}</td>
      <td onclick="event.stopPropagation()"><div class="action-cell">
        <button class="icon-btn" title="Voir fiche" onclick="openModal(${p.id})"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="icon-btn" title="Message" onclick="showToast('Messagerie ouverte')"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
        <button class="icon-btn" title="Rendez-vous" onclick="showToast('Agenda ouvert')"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button>
        <button class="icon-btn danger" title="Supprimer" onclick="confirmDelete(${p.id})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
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
    <div class="patient-card" onclick="openModal(${p.id})">
      <div class="pc-top">
        <div class="pc-avatar" style="background:${getColor(p.id)}">${initials(p)}</div>
        <div class="pc-info">
          <div class="pc-name">${p.prenom} ${p.nom}</div>
          <div class="pc-meta">${age(p.ddn)} ans · ${p.sexe || "—"}</div>
          <div class="pc-id">${p.dossier}</div>
        </div>
        ${statusBadge(p.statut)}
      </div>
      <div class="pc-divider"></div>
      <div class="pc-rows">
        <div class="pc-row"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${p.medecin || "—"}</div>
        <div class="pc-row"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg>${p.tel || "—"}</div>
        <div class="pc-row"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Dernier RDV : ${p.lastVisit || "—"}</div>
      </div>
      <div class="pc-foot">
        <div class="pc-actions">
          <button class="pc-btn primary" onclick="event.stopPropagation();openModal(${p.id})">Voir fiche</button>
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
function openModal(id) {
  editingId = id || null;
  activeTab = 0;

  // Reset tabs
  document
    .querySelectorAll(".modal-tab")
    .forEach((t, i) => t.classList.toggle("active", i === 0));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p, i) => p.classList.toggle("active", i === 0));

  if (id) {
    const p = patients.find((x) => x.id === id);
    if (!p) return;
    document.getElementById("modalTitleText").textContent =
      `${p.prenom} ${p.nom}`;
    document.getElementById("btnDelete").style.display = "flex";
    document.getElementById("fCiv").value = p.civ || "M.";
    document.getElementById("fNom").value = p.nom || "";
    document.getElementById("fPrenom").value = p.prenom || "";
    document.getElementById("fDdn").value = p.ddn || "";
    document.getElementById("fEmail").value = p.email || "";
    document.getElementById("fTel").value = p.tel || "";
    document.getElementById("fAdresse").value = p.adresse || "";
    document.getElementById("fCp").value = p.cp || "";
    document.getElementById("fVille").value = p.ville || "";
    document.getElementById("fMedecin").value = p.medecin || "";
    document.getElementById("fStatut").value = p.statut || "Actif";
    document.getElementById("fMutuelle").value = p.mutuelle || "";
    document.getElementById("fGroupe").value = p.groupe || "";
    document.getElementById("fAllergie").value = p.allergie || "";
    document.getElementById("fNotes").value = p.notes || "";
    document.getElementById("fSexe").value = p.sexe || "";
    document.getElementById("fTaille").value = p.taille || "";
    document.getElementById("fPoids").value = p.poids || "";
    document.getElementById("fTA").value = p.ta || "";
    document.getElementById("hs-taille").textContent = p.taille || "—";
    document.getElementById("hs-poids").textContent = p.poids || "—";
    document.getElementById("hs-ta").textContent = p.ta || "—";
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

function savePatient() {
  const nom = document.getElementById("fNom").value.trim();
  const prenom = document.getElementById("fPrenom").value.trim();
  if (!nom || !prenom) {
    showToast("Nom et prénom obligatoires.");
    return;
  }

  const data = {
    nom,
    prenom,
    civ: document.getElementById("fCiv").value,
    ddn: document.getElementById("fDdn").value,
    sexe: document.getElementById("fSexe").value,
    email: document.getElementById("fEmail").value,
    tel: document.getElementById("fTel").value,
    adresse: document.getElementById("fAdresse").value,
    cp: document.getElementById("fCp").value,
    ville: document.getElementById("fVille").value,
    medecin: document.getElementById("fMedecin").value,
    statut: document.getElementById("fStatut").value,
    mutuelle: document.getElementById("fMutuelle").value,
    groupe: document.getElementById("fGroupe").value,
    allergie: document.getElementById("fAllergie").value,
    notes: document.getElementById("fNotes").value,
    taille: document.getElementById("fTaille").value,
    poids: document.getElementById("fPoids").value,
    ta: document.getElementById("fTA").value,
    lastVisit: new Date().toLocaleDateString("fr-FR"),
  };

  if (editingId) {
    const idx = patients.findIndex((p) => p.id === editingId);
    if (idx !== -1) patients[idx] = { ...patients[idx], ...data };
    showToast("Patient mis à jour");
  } else {
    data.id = nextId++;
    data.dossier = `P-${new Date().getFullYear()}-${String(data.id).padStart(4, "0")}`;
    patients.push(data);
    showToast("Patient créé avec succès");
  }
  closeModal();
  filterPatients();
}

function confirmDelete(id) {
  const p = patients.find((x) => x.id === id);
  if (!p) return;
  if (confirm(`Supprimer le patient ${p.prenom} ${p.nom} ?`)) {
    patients = patients.filter((x) => x.id !== id);
    showToast("Patient supprimé");
    filterPatients();
  }
}

function deletePatient() {
  if (!editingId) return;
  const p = patients.find((x) => x.id === editingId);
  if (!p) return;
  if (confirm(`Supprimer ${p.prenom} ${p.nom} ?`)) {
    patients = patients.filter((x) => x.id !== editingId);
    closeModal();
    showToast("Patient supprimé");
    filterPatients();
  }
}

function showToast(msg) {
  const t = document.getElementById("toast");
  document.getElementById("toastMsg").textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
