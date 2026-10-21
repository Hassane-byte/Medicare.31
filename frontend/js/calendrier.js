authGuard();
// ═══════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════
const DAYS_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const DAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const COLOR_HEX = {
  blue: "#3b82f6",
  green: "#10b981",
  purple: "#8b5cf6",
  orange: "#f59e0b",
  teal: "#14b8a6",
  red: "#ef4444",
};
const STAFF_COLORS = ["blue", "green", "purple", "orange", "teal", "red"];

// Reference data (loaded from the API)
let DOCTORS = [];
let staffList = [];
let typeList = [];
let roomList = [];
let patientList = [];

// Indexes used when saving an appointment
let patientByName = new Map();

// Appointments currently displayed (loaded from the API)
let appointments = [];

const currentUser = typeof getUser === "function" ? getUser() : {};
const isPatient = currentUser.role === "patient";

let currentView = "week";
let currentDate = new Date();
let miniDate = new Date();
let editingId = null;
let selectedStatus = "Confirmé";
let selectedColor = "blue";
let visibleDoctors = new Set();

// ═══════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════
function authHeaders(extra = {}) {
  const token = localStorage.getItem("medicare_token");
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiJson(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = "Erreur serveur";
    try {
      const data = await res.json();
      message =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail || data);
    } catch (_) {}
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function displayName(p) {
  return `${p.prenom || ""} ${p.nom || ""}`.trim();
}

async function loadReferenceData() {
  if (isPatient) return;

  const [staff, types, rooms, patients] = await Promise.all([
    fetchJson("/api/appointments/staff").catch(() => []),
    fetchJson("/api/appointments/types").catch(() => []),
    fetchJson("/api/appointments/rooms").catch(() => []),
    fetchJson("/api/patients?limit=100").catch(() => []),
  ]);

  staffList = Array.isArray(staff) ? staff : [];
  typeList = Array.isArray(types) ? types : [];
  roomList = Array.isArray(rooms) ? rooms : [];
  patientList = Array.isArray(patients) ? patients : [];

  patientByName = new Map(patientList.map((p) => [displayName(p), p]));

  DOCTORS = staffList
    .filter((s) => s.type_staff === "medecin")
    .map((s, i) => {
      const cls = STAFF_COLORS[i % STAFF_COLORS.length];
      return {
        id: s.id_staff,
        name: s.display,
        color: s.couleur_agenda || COLOR_HEX[cls],
        cls,
      };
    });

  visibleDoctors = new Set(DOCTORS.map((d) => d.name));
  populateModalOptions();
}

function populateModalOptions() {
  const doctorSel = document.getElementById("mDoctor");
  doctorSel.innerHTML =
    '<option value="">-- Choisir --</option>' +
    staffList
      .filter((s) => s.type_staff === "medecin")
      .map((s) => `<option value="${s.id_staff}">${escapeHtml(s.display)}</option>`)
      .join("");

  const typeSel = document.getElementById("mType");
  typeSel.innerHTML =
    '<option value="">-- Type --</option>' +
    typeList
      .map(
        (t) =>
          `<option value="${t.id_appointment_type}">${escapeHtml(t.libelle)}</option>`,
      )
      .join("");

  document.getElementById("patientList").innerHTML = patientList
    .map((p) => `<option value="${escapeHtml(displayName(p))}"></option>`)
    .join("");

  document.getElementById("roomList").innerHTML = roomList
    .map((r) => `<option value="${escapeHtml(r.nom)}"></option>`)
    .join("");
}

function rangeForView() {
  const d = new Date(currentDate);
  if (currentView === "day") return [fmtDate(d), fmtDate(d)];
  if (currentView === "week") {
    const monday = getMonday(d);
    return [fmtDate(monday), fmtDate(addDays(monday, 6))];
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  return [fmtDate(gridStart), fmtDate(addDays(gridStart, 41))];
}

function mapAppt(a) {
  return {
    id: a.id_appointment,
    id_patient: a.id_patient,
    id_staff: a.id_staff,
    id_room: a.id_room,
    id_appointment_type: a.id_appointment_type,
    patient: a.patient_nom,
    doctor: a.staff_nom,
    type: a.type_libelle || "",
    date: a.date,
    start: a.start,
    end: a.end,
    color: a.couleur || "blue",
    status: a.status_label,
    notes: a.notes || "",
    room: a.room_nom || "",
  };
}

async function loadAppointments() {
  const [start, end] = rangeForView();
  const query = `?start=${start}&end=${end}`;
  const url = isPatient
    ? `/api/appointments/mine${query}`
    : `/api/appointments/${query}`;
  try {
    const data = await fetchJson(url);
    appointments = (data || []).map(mapAppt);
  } catch (err) {
    console.error("Chargement des rendez-vous impossible :", err);
    appointments = [];
  }
}

async function refresh() {
  await loadAppointments();
  renderView();
}

function isVisible(a) {
  if (DOCTORS.length === 0) return true;
  return visibleDoctors.has(a.doctor);
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
async function init() {
  await loadReferenceData();
  await loadAppointments();
  renderDoctorList();
  renderMiniCal();
  renderView();
  updateCurrentTimeLine();
  setInterval(updateCurrentTimeLine, 60000);
}

// ═══════════════════════════════════════════════
// DOCTOR LIST
// ═══════════════════════════════════════════════
function renderDoctorList() {
  const el = document.getElementById("doctorList");
  el.innerHTML = DOCTORS.map(
    (d) => `
          <div class="doctor-item checked" style="--color:${d.color}" onclick="toggleDoctor(this,'${d.name}')">
            <div class="doctor-dot" style="background:${d.color}"></div>
            <span class="doctor-name">${d.name}</span>
            <div class="doctor-cb"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
          </div>`,
  ).join("");
}

function toggleDoctor(el, name) {
  el.classList.toggle("checked");
  if (visibleDoctors.has(name)) visibleDoctors.delete(name);
  else visibleDoctors.add(name);
  renderView();
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function navigate(dir) {
  if (currentView === "week") currentDate = addDays(currentDate, dir * 7);
  else if (currentView === "month")
    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + dir,
      1,
    );
  else currentDate = addDays(currentDate, dir);
  refresh();
}

function goToday() {
  currentDate = new Date();
  miniDate = new Date();
  refresh();
}

function setView(v) {
  currentView = v;
  ["vDay", "vWeek", "vMonth"].forEach((id) =>
    document.getElementById(id).classList.remove("active"),
  );
  document
    .getElementById("v" + v.charAt(0).toUpperCase() + v.slice(1))
    .classList.add("active");
  document.getElementById("weekView").classList.remove("active");
  document.getElementById("monthView").classList.remove("active");
  document.getElementById("dayView").classList.remove("active");
  if (v === "week") document.getElementById("weekView").classList.add("active");
  else if (v === "month")
    document.getElementById("monthView").classList.add("active");
  else document.getElementById("dayView").classList.add("active");
  refresh();
}

// ═══════════════════════════════════════════════
// RENDER DISPATCHER
// ═══════════════════════════════════════════════
function renderView() {
  if (currentView === "week") renderWeek();
  else if (currentView === "month") renderMonth();
  else renderDay();
  renderMiniCal();
}

// ═══════════════════════════════════════════════
// WEEK VIEW
// ═══════════════════════════════════════════════
function renderWeek() {
  const monday = getMonday(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Label
  const endDay = days[6];
  document.getElementById("currentPeriod").textContent =
    `${days[0].getDate()} – ${endDay.getDate()} ${MONTHS_FR[endDay.getMonth()]} ${endDay.getFullYear()}`;

  // Header
  const header = document.getElementById("weekHeader");
  header.innerHTML =
    '<div class="week-header-gutter"></div>' +
    days
      .map((d) => {
        const isToday = d.getTime() === today.getTime();
        return `<div class="week-header-day">
              <div class="week-day-name">${DAYS_SHORT[((d.getDay() + 6) % 7) + 1 > 6 ? 0 : (d.getDay() + 6) % 7]}</div>
              <div class="week-day-num${isToday ? " today" : ""}">${d.getDate()}</div>
            </div>`;
      })
      .join("");

  // Body
  const body = document.getElementById("weekBody");
  body.innerHTML = "";

  // Time gutter
  const gutter = document.createElement("div");
  gutter.className = "time-gutter";
  for (let h = 7; h <= 20; h++) {
    const slot = document.createElement("div");
    slot.className = "time-slot-label";
    slot.textContent = `${String(h).padStart(2, "0")}:00`;
    gutter.appendChild(slot);
  }
  body.appendChild(gutter);

  // Day columns
  days.forEach((d) => {
    const isToday = d.getTime() === today.getTime();
    const col = document.createElement("div");
    col.className = "day-col" + (isToday ? " today-col" : "");
    col.dataset.date = fmtDate(d);

    for (let h = 7; h <= 20; h++) {
      const cell = document.createElement("div");
      cell.className = "hour-cell";
      col.appendChild(cell);
    }

    // Add time line
    if (isToday) {
      const now = new Date();
      const mins = (now.getHours() - 7) * 60 + now.getMinutes();
      if (mins >= 0 && mins <= 14 * 60) {
        const tl = document.createElement("div");
        tl.className = "time-line";
        tl.id = "timeLine";
        tl.style.top = mins + "px";
        col.appendChild(tl);
      }
    }

    // Appointments
    const dayAppts = appointments.filter(
      (a) => a.date === fmtDate(d) && isVisible(a),
    );
    dayAppts.forEach((a) => {
      col.appendChild(buildApptEl(a));
    });

    // Click to add
    col.addEventListener("click", (e) => {
      if (e.target.closest(".appt")) return;
      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top + col.scrollTop;
      const hour = Math.floor(y / 60) + 7;
      const mins = Math.floor((y % 60) / 15) * 15;
      openModal(
        fmtDate(d),
        `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
      );
    });

    body.appendChild(col);
  });
}

// ═══════════════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════════════
function renderDay() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = currentDate.getTime() === today.getTime();
  document.getElementById("currentPeriod").textContent =
    `${DAYS_FR[currentDate.getDay()]} ${currentDate.getDate()} ${MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const header = document.getElementById("dayHeader");
  header.style.gridTemplateColumns = "60px 1fr";
  header.innerHTML = `<div class="week-header-gutter"></div>
          <div class="week-header-day">
            <div class="week-day-name">${DAYS_SHORT[currentDate.getDay()]}</div>
            <div class="week-day-num${isToday ? " today" : ""}">${currentDate.getDate()}</div>
          </div>`;

  const body = document.getElementById("dayBody");
  body.style.gridTemplateColumns = "60px 1fr";
  body.innerHTML = "";
  const gutter = document.createElement("div");
  gutter.className = "time-gutter";
  for (let h = 7; h <= 20; h++) {
    const s = document.createElement("div");
    s.className = "time-slot-label";
    s.textContent = `${String(h).padStart(2, "0")}:00`;
    gutter.appendChild(s);
  }
  body.appendChild(gutter);

  const col = document.createElement("div");
  col.className = "day-col" + (isToday ? " today-col" : "");
  col.dataset.date = fmtDate(currentDate);
  for (let h = 7; h <= 20; h++) {
    const c = document.createElement("div");
    c.className = "hour-cell";
    col.appendChild(c);
  }
  if (isToday) {
    const now = new Date();
    const mins = (now.getHours() - 7) * 60 + now.getMinutes();
    if (mins >= 0 && mins <= 14 * 60) {
      const tl = document.createElement("div");
      tl.className = "time-line";
      tl.style.top = mins + "px";
      col.appendChild(tl);
    }
  }
  appointments
    .filter(
      (a) => a.date === fmtDate(currentDate) && isVisible(a),
    )
    .forEach((a) => col.appendChild(buildApptEl(a)));
  col.addEventListener("click", (e) => {
    if (e.target.closest(".appt")) return;
    const rect = col.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = Math.floor(y / 60) + 7;
    const mins = Math.floor((y % 60) / 15) * 15;
    openModal(
      fmtDate(currentDate),
      `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
    );
  });
  body.appendChild(col);
}

// ═══════════════════════════════════════════════
// MONTH VIEW
// ═══════════════════════════════════════════════
function renderMonth() {
  document.getElementById("currentPeriod").textContent =
    `${MONTHS_FR[currentDate.getMonth()].charAt(0).toUpperCase() + MONTHS_FR[currentDate.getMonth()].slice(1)} ${currentDate.getFullYear()}`;

  const grid = document.getElementById("monthGrid");
  grid.innerHTML = "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const last = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  );

  // start from Monday
  let start = new Date(first);
  const dow = (first.getDay() + 6) % 7; // Mon=0
  start.setDate(start.getDate() - dow);

  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const cell = document.createElement("div");
    const isOther = d.getMonth() !== currentDate.getMonth();
    const isToday = d.getTime() === today.getTime();
    cell.className =
      "month-cell" +
      (isOther ? " other-month" : "") +
      (isToday ? " today" : "");

    const dateEl = document.createElement("div");
    dateEl.className = "month-date";
    dateEl.textContent = d.getDate();
    cell.appendChild(dateEl);

    const dayAppts = appointments.filter(
      (a) => a.date === fmtDate(d) && isVisible(a),
    );
    dayAppts.slice(0, 3).forEach((a) => {
      const el = document.createElement("div");
      el.className = `month-appt appt ${a.color}`;
      el.textContent = `${a.start} ${a.patient}`;
      el.onclick = (e) => {
        e.stopPropagation();
        showDetail(a, e);
      };
      cell.appendChild(el);
    });
    if (dayAppts.length > 3) {
      const more = document.createElement("div");
      more.className = "month-more";
      more.textContent = `+${dayAppts.length - 3} autres`;
      cell.appendChild(more);
    }

    cell.addEventListener("click", () => openModal(fmtDate(d)));
    grid.appendChild(cell);
  }
}

// ═══════════════════════════════════════════════
// BUILD APPOINTMENT ELEMENT
// ═══════════════════════════════════════════════
function buildApptEl(a) {
  const el = document.createElement("div");
  el.className = `appt ${a.color}`;
  const startMins = timeToMins(a.start) - 7 * 60;
  const endMins = timeToMins(a.end) - 7 * 60;
  el.style.top = startMins + "px";
  el.style.height = Math.max(endMins - startMins, 20) + "px";
  el.innerHTML = `<div class="appt-title">${a.patient}</div><div class="appt-sub">${a.start} · ${a.type}</div>`;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    showDetail(a, e);
  });
  return el;
}

// ═══════════════════════════════════════════════
// MINI CALENDAR
// ═══════════════════════════════════════════════
function renderMiniCal() {
  const y = miniDate.getFullYear(),
    m = miniDate.getMonth();
  document.getElementById("miniMonth").textContent = `${MONTHS_FR[m]} ${y}`;
  const grid = document.getElementById("miniGrid");
  grid.innerHTML = ["L", "M", "M", "J", "V", "S", "D"]
    .map((d) => `<div class="mini-day-label">${d}</div>`)
    .join("");

  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - ((first.getDay() + 6) % 7));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sel = new Date(currentDate);
  sel.setHours(0, 0, 0, 0);

  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const hasAppt = appointments.some((a) => a.date === fmtDate(d));
    const isToday = d.getTime() === today.getTime();
    const isSel = d.getTime() === sel.getTime();
    const isOther = d.getMonth() !== m;
    const el = document.createElement("div");
    el.className =
      "mini-day" +
      (isOther ? " other-month" : "") +
      (isToday ? " today" : "") +
      (isSel && !isToday ? " selected" : "") +
      (hasAppt ? " has-appt" : "");
    el.textContent = d.getDate();
    el.onclick = () => {
      currentDate = new Date(d);
      refresh();
    };
    grid.appendChild(el);
  }
}

function miniNav(dir) {
  miniDate = new Date(miniDate.getFullYear(), miniDate.getMonth() + dir, 1);
  renderMiniCal();
}

// ═══════════════════════════════════════════════
// TIME LINE
// ═══════════════════════════════════════════════
function updateCurrentTimeLine() {
  const el = document.getElementById("timeLine");
  if (!el) return;
  const now = new Date();
  const mins = (now.getHours() - 7) * 60 + now.getMinutes();
  el.style.top = mins + "px";
}

// ═══════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════
function openModal(date, startTime) {
  if (isPatient) {
    showToast("La prise de rendez-vous est réservée au personnel.");
    return;
  }
  editingId = null;
  selectedStatus = "Confirmé";
  selectedColor = "blue";
  document.getElementById("modalTitleText").textContent = "Nouveau rendez-vous";
  document.getElementById("btnDelete").style.display = "none";

  // Reset form
  document.getElementById("mPatient").value = "";
  document.getElementById("mDoctor").value = "";
  document.getElementById("mType").value = "";
  document.getElementById("mRoom").value = "";
  document.getElementById("mNotes").value = "";
  document.getElementById("mDate").value = date || fmtDate(currentDate);
  document.getElementById("mStart").value = startTime || "09:00";
  document.getElementById("mEnd").value = startTime
    ? addMins(startTime, 30)
    : "09:30";

  document.querySelectorAll(".status-opt").forEach((o) => {
    o.classList.toggle("sel", o.textContent === "Confirmé");
  });
  document.querySelectorAll(".color-dot").forEach((d) => {
    d.classList.toggle("selected", d.dataset.color === "blue");
  });

  closeDetail();
  document.getElementById("modalOverlay").classList.add("open");
}

function openEditModal(a) {
  editingId = a.id;
  selectedStatus = a.status;
  selectedColor = a.color;
  document.getElementById("modalTitleText").textContent =
    "Modifier le rendez-vous";
  document.getElementById("btnDelete").style.display = "flex";

  document.getElementById("mPatient").value = a.patient;
  document.getElementById("mDoctor").value = String(a.id_staff ?? "");
  document.getElementById("mType").value = String(a.id_appointment_type ?? "");
  document.getElementById("mRoom").value = a.room || "";
  document.getElementById("mNotes").value = a.notes;
  document.getElementById("mDate").value = a.date;
  document.getElementById("mStart").value = a.start;
  document.getElementById("mEnd").value = a.end;

  document.querySelectorAll(".status-opt").forEach((o) => {
    o.classList.toggle("sel", o.textContent === a.status);
  });
  document.querySelectorAll(".color-dot").forEach((d) => {
    d.classList.toggle("selected", d.dataset.color === a.color);
  });

  closeDetail();
  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal(e) {
  if (e.target === document.getElementById("modalOverlay")) closeModalBtn();
}
function closeModalBtn() {
  document.getElementById("modalOverlay").classList.remove("open");
  editingId = null;
}

function selectStatus(el, val) {
  document
    .querySelectorAll(".status-opt")
    .forEach((o) => o.classList.remove("sel"));
  el.classList.add("sel");
  selectedStatus = val;
}

function pickColor(el) {
  document
    .querySelectorAll(".color-dot")
    .forEach((d) => d.classList.remove("selected"));
  el.classList.add("selected");
  selectedColor = el.dataset.color;
}

async function saveAppt() {
  const patientName = document.getElementById("mPatient").value.trim();
  const doctorId = document.getElementById("mDoctor").value;
  const typeId = document.getElementById("mType").value;
  const date = document.getElementById("mDate").value;
  const start = document.getElementById("mStart").value;
  const end = document.getElementById("mEnd").value;
  const roomName = document.getElementById("mRoom").value.trim();

  if (!patientName || !doctorId || !typeId || !date || !start || !end) {
    showToast("Veuillez remplir les champs obligatoires.", false);
    return;
  }

  const patient = patientByName.get(patientName);
  if (!patient) {
    showToast("Patient introuvable : choisissez-le dans la liste.", false);
    return;
  }

  if (end <= start) {
    showToast("L'heure de fin doit suivre l'heure de début.", false);
    return;
  }

  const room = roomName
    ? roomList.find((r) => r.nom.toLowerCase() === roomName.toLowerCase())
    : null;

  const payload = {
    id_patient: patient.id_patient,
    id_staff: Number(doctorId),
    id_room: room ? room.id_room : null,
    id_appointment_type: Number(typeId),
    start_at: `${date}T${start}:00`,
    end_at: `${date}T${end}:00`,
    statut: selectedStatus,
    couleur: selectedColor,
    notes: document.getElementById("mNotes").value.trim(),
  };

  try {
    if (editingId) {
      await apiJson(`/api/appointments/${editingId}`, "PUT", payload);
      showToast("Rendez-vous modifié avec succès");
    } else {
      await apiJson("/api/appointments/", "POST", payload);
      showToast("Rendez-vous ajouté avec succès");
    }
    closeModalBtn();
    await refresh();
  } catch (err) {
    showToast(err.message || "Erreur lors de l'enregistrement.", false);
  }
}

async function deleteAppt() {
  if (!editingId) return;
  try {
    await apiJson(`/api/appointments/${editingId}`, "DELETE");
    closeModalBtn();
    showToast("Rendez-vous supprimé");
    await refresh();
  } catch (err) {
    showToast(err.message || "Erreur lors de la suppression.", false);
  }
}

// ═══════════════════════════════════════════════
// DETAIL POPUP
// ═══════════════════════════════════════════════
function showDetail(a, e) {
  const popup = document.getElementById("detailPopup");
  document.getElementById("dp-title").textContent = a.patient;
  document.getElementById("dp-time").textContent =
    `${a.date ? fmtDateFr(a.date) : ""} · ${a.start} – ${a.end}`;
  document.getElementById("dp-doctor").textContent = a.doctor;
  document.getElementById("dp-type").textContent = a.type;
  const badge = document.getElementById("dp-badge");
  badge.textContent = a.status;
  badge.className = "detail-badge";
  if (a.status === "Confirmé") {
    badge.style.background = "var(--green-pale)";
    badge.style.color = "#065f46";
  } else if (a.status === "En attente") {
    badge.style.background = "var(--gold-pale)";
    badge.style.color = "#92400e";
  } else {
    badge.style.background = "var(--red-pale)";
    badge.style.color = "var(--red)";
  }

  if (a.notes) {
    document.getElementById("dp-notes").textContent = a.notes;
    document.getElementById("dp-notes-row").style.display = "flex";
  } else document.getElementById("dp-notes-row").style.display = "none";

  const editBtn = document.getElementById("dp-edit");
  const delBtn = document.getElementById("dp-del");
  editBtn.style.display = isPatient ? "none" : "flex";
  delBtn.style.display = isPatient ? "none" : "flex";

  editBtn.onclick = () => openEditModal(a);
  delBtn.onclick = async () => {
    try {
      await apiJson(`/api/appointments/${a.id}`, "DELETE");
      closeDetail();
      showToast("Rendez-vous supprimé");
      await refresh();
    } catch (err) {
      showToast(err.message || "Erreur lors de la suppression.", false);
    }
  };

  const x = Math.min(e.clientX + 10, window.innerWidth - 320);
  const y = Math.min(e.clientY + 10, window.innerHeight - 250);
  popup.style.left = x + "px";
  popup.style.top = y + "px";
  popup.classList.add("open");
}

function closeDetail() {
  document.getElementById("detailPopup").classList.remove("open");
}
document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".detail-popup") &&
    !e.target.closest(".appt") &&
    !e.target.closest(".month-appt")
  )
    closeDetail();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModalBtn();
    closeDetail();
  }
});

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById("toast");
  document.getElementById("toastMsg").textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDateFr(s) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function getMonday(d) {
  const dd = new Date(d);
  const day = dd.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dd.setDate(dd.getDate() + diff);
  return dd;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function timeToMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function addMins(t, n) {
  const m = timeToMins(t) + n;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// auto-adjust end time when start changes
document.getElementById("mStart").addEventListener("change", function () {
  document.getElementById("mEnd").value = addMins(this.value, 30);
});

init();
