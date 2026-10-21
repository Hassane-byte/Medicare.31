/**
 * Page Statistiques : agrégats calculés par l'API (/api/statistiques).
 */

function renderKpis(items) {
  const el = document.getElementById("kpiRow");
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<div class="state-empty">Aucune statistique disponible.</div>';
    return;
  }
  el.innerHTML = items
    .map(
      (i) => `
      <div class="stat-card">
        <div class="stat-label">${App.escapeHtml(i.libelle)}</div>
        <div class="stat-row">
          <span class="stat-num">${Number(i.valeur || 0)}</span>
        </div>
      </div>`,
    )
    .join("");
}

function renderBars(el, items, emptyLabel) {
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = `<div class="state-empty">${App.escapeHtml(emptyLabel)}</div>`;
    return;
  }
  const max = Math.max(...items.map((i) => Number(i.valeur || 0)), 1);
  el.innerHTML = items
    .map(
      (i) => `
      <div class="bar-row">
        <span class="bar-label">${App.escapeHtml(i.libelle)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(Number(i.valeur || 0) / max) * 100}%"></span></span>
        <span class="bar-value">${Number(i.valeur || 0)}</span>
      </div>`,
    )
    .join("");
}

function renderEvolution(el, items) {
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<div class="state-empty">Pas encore d\'historique.</div>';
    return;
  }
  const max = Math.max(...items.map((i) => Number(i.valeur || 0)), 1);
  el.innerHTML =
    `<div class="evolution">` +
    items
      .map(
        (i) => `
      <div class="evo-col" title="${App.escapeHtml(i.semaine)} : ${Number(i.valeur || 0)} RDV">
        <span class="evo-value">${Number(i.valeur || 0)}</span>
        <span class="evo-bar" style="height:${(Number(i.valeur || 0) / max) * 100}%"></span>
        <span class="evo-label">${App.escapeHtml(i.semaine)}</span>
      </div>`,
      )
      .join("") +
    `</div>`;
}

async function loadStats() {
  const data = await api.get("/api/statistiques");
  renderKpis(data.patients || []);
  renderEvolution(document.getElementById("evolutionChart"), data.evolution || []);
  renderBars(
    document.getElementById("repartitionPatients"),
    data.repartition || [],
    "Aucun patient enregistré.",
  );
  renderBars(
    document.getElementById("repartitionTypes"),
    data.repartition_types || [],
    "Aucune consultation sur la période.",
  );
  renderBars(
    document.getElementById("parPraticien"),
    data.par_praticien || [],
    "Aucun praticien actif.",
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const ready = await App.init({ roles: ["medecin", "secretariat", "admin"] });
  if (!ready) return;
  try {
    await loadStats();
  } catch (err) {
    api.notify(err.message, "error");
  }
  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    try {
      await loadStats();
      api.notify("Statistiques actualisées", "success");
    } catch (err) {
      api.notify(err.message, "error");
    }
  });
});
