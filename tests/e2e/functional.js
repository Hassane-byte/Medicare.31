const { chromium } = require('playwright');
const BASE = 'http://localhost';

let fails = 0;
const ok = (t, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK   ' : 'ECHEC'} ${t}${extra ? ' -> ' + extra : ''}`);
};

async function login(page, email, password) {
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#loginForm button[type="submit"]');
  await page.waitForURL(/index\d?\.html/, { timeout: 15000 });
  await page.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('JS: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); });

  // ═══ 1. Médecin : tâches ═══════════════════════════════════════════════
  await login(page, 'dr.martin@medicare31.fr', 'Medecin123!');

  const t0 = await page.locator('#taskList .task-item').count();
  await page.click('#btnAddTask');
  await page.fill('#taskInput', 'Tache de test E2E');
  await page.click('#taskForm button[type="submit"]');
  await page.waitForTimeout(1200);
  const t1 = await page.locator('#taskList .task-item').count();
  ok('ajout de tache', t1 === t0 + 1, `${t0} -> ${t1}`);

  const newTask = page.locator('#taskList .task-item', { hasText: 'Tache de test E2E' }).first();
  await newTask.locator('.task-cb').click();
  await page.waitForTimeout(1000);
  const isDone = await newTask.locator('.task-cb').evaluate((e) => e.classList.contains('checked'));
  ok('validation de tache', isDone);

  await newTask.locator('[data-action="delete"]').click();
  await page.waitForTimeout(1000);
  const t2 = await page.locator('#taskList .task-item').count();
  ok('suppression de tache', t2 === t0, `${t1} -> ${t2}`);

  // ═══ 2. Navigation par la barre laterale ════════════════════════════════
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const links = await page.locator('.side-nav a').all();
  let navOk = true;
  for (const l of links) {
    const href = await l.getAttribute('href');
    await l.click();
    await page.waitForTimeout(700);
    if (!page.url().endsWith(href)) { navOk = false; console.log('   lien cassé:', href, '->', page.url()); }
  }
  ok('navigation sidebar (' + links.length + ' liens)', navOk);

  // ═══ 3. Cloche de notifications ═════════════════════════════════════════
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.click('.notif-btn');
  await page.waitForTimeout(500);
  const panelOpen = await page.locator('#notifPanel.open').count();
  const notifItems = await page.locator('#notifPanel .notif-item').count();
  ok('panneau notifications', panelOpen === 1 && notifItems > 0, notifItems + ' notification(s)');

  // ═══ 4. Médecin : création d'un patient ═══════════════════════════════
  await page.goto(BASE + '/patients.html?new=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const modalOpen = await page.locator('#modalOverlay.open').count();
  ok('ouverture auto du formulaire (?new=1)', modalOpen === 1);

  const marker = 'E2E' + String(Date.now()).slice(-6);
  await page.fill('#fNom', 'Testeur');
  await page.fill('#fPrenom', marker);
  await page.fill('#fDdn', '1980-05-05');
  await page.fill('#fEmail', marker.toLowerCase() + '@exemple.fr');
  await page.fill('#fTel', '0611223344');
  await page.fill('#fAdresse', '12 rue de la Paix');
  await page.fill('#fCp', '31200');
  await page.fill('#fVille', 'Toulouse');
  await page.selectOption('#fStatut', 'suivi');
  await page.click('#saveBtn');
  await page.waitForTimeout(1500);

  const body = await page.locator('#tableBody').innerText();
  ok('patient cree et affiche', body.includes(marker));

  await page.fill('#searchInput', marker);
  await page.waitForTimeout(1200);
  const rows = await page.locator('#tableBody tr').count();
  ok('recherche patient', rows === 1, rows + ' ligne(s)');

  const row = page.locator('#tableBody tr').first();
  await row.click();
  await page.waitForTimeout(1200);
  const email = await page.inputValue('#fEmail');
  const tel = await page.inputValue('#fTel');
  const addr = await page.inputValue('#fAdresse');
  ok('coordonnees conservees', email === marker.toLowerCase() + '@exemple.fr' && tel === '0611223344' && addr === '12 rue de la Paix',
     `${email} / ${tel} / ${addr}`);

  // ═══ 5. Secrétariat : arrivée en salle d'attente ═══════════════════════
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push('JS sec: ' + e.message));
  await login(p2, 'secretaire.dupont@medicare31.fr', 'Secretaire123!');

  const attente0 = await p2.locator('#waitingList .patient-row').count();
  await p2.click('#btnCheckIn');
  await p2.waitForTimeout(1200);
  const checkinItems = await p2.locator('#checkinList .checkin-item').count();
  ok('modale arrivee', checkinItems > 0, checkinItems + ' RDV(s)');

  if (checkinItems > 0) {
    await p2.locator('#checkinList .checkin-item button').first().click();
    await p2.waitForTimeout(1500);
    const attente1 = await p2.locator('#waitingList .patient-row').count();
    ok('enregistrement arrivee', attente1 === attente0 + 1, `${attente0} -> ${attente1}`);
  }

  // ═══ 6. Patient : documents et agenda ═══════════════════════════════════
  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  p3.on('pageerror', (e) => errors.push('JS pat: ' + e.message));
  await login(p3, 'patient.durand@gmail.com', 'Patient123!');

  const rdvDate = await p3.locator('#rdvDate').innerText();
  ok('prochain rdv du patient', rdvDate && !rdvDate.includes('Aucun'), rdvDate);

  const docRows = await p3.locator('#docsListLarge .doc-row-lg').count();
  ok('documents du patient', docRows > 0, docRows + ' document(s)');

  const histo = await p3.locator('#consultList .consult-row').count();
  ok('historique medical', histo > 0, histo + ' evenement(s)');

  // ═══ 7. Messagerie : envoi d'un message ════════════════════════════════
  await p3.goto(BASE + '/messagerie.html', { waitUntil: 'networkidle' });
  await p3.waitForTimeout(1800);
  const convs = await p3.locator('#convList .conv-item, #convList .conv-row, #convList > div').count();
  ok('conversations listees', convs > 0, convs + ' element(s)');

  // ═══ 8. Erreurs console ════════════════════════════════════════════════
  ok('aucune erreur JS', errors.length === 0, errors.slice(0, 3).join(' | ') || 'aucune');

  console.log(fails === 0 ? '\n=> TOUS LES SCENARIOS PASSENT' : `\n=> ${fails} SCENARIO(S) EN ECHEC`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
