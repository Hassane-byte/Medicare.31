const { chromium } = require('playwright');

const BASE = 'http://localhost';
const MEDECIN = { email: 'dr.martin@medicare31.fr', password: 'Medecin123!' };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const step = (t, ok, extra = '') =>
    console.log(`${ok ? 'OK  ' : 'ECHEC'} ${t}${extra ? ' -> ' + extra : ''}`);

  // ── 1. Connexion médecin ────────────────────────────────────────────────
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"], #email', MEDECIN.email);
  await page.fill('input[type="password"], input[name="password"], #password', MEDECIN.password);
  await page.click('button[type="submit"], .btn-primary, #loginBtn');

  await page.waitForURL(/index\.html|index2\.html|index3\.html/, { timeout: 15000 });
  step('connexion médecin', page.url().includes('index.html'), page.url());

  // ── 2. Page Patients ────────────────────────────────────────────────────
  await page.goto(BASE + '/patients.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const rows = await page.locator('#tableBody tr').count();
  step('table patients rendue', rows > 0, rows + ' ligne(s)');

  const bodyText = await page.locator('#tableBody').innerText().catch(() => '');
  step('dossier patient affiche', /Durand/i.test(bodyText), bodyText.split('\n')[0]);

  const medecinCell = await page.locator('#tableBody tr').first().innerText().catch(() => '');
  step('medecin traitant resolu (nom, pas ID)', /Dr\.|—/.test(medecinCell));

  // ── 3. Liste des médecins-chargée dynamiquement ─────────────────────────
  const docOpts = await page.locator('#filterDoc option').count();
  const medOpts = await page.locator('#fMedecin option').count();
  step('filtre medecins peuple depuis l API', docOpts >= 2, docOpts + ' options');
  step('select medecin traitant peuple', medOpts >= 2, medOpts + ' options');

  // ── 4. Filtre statut ────────────────────────────────────────────────────
  await page.selectOption('#filterStatus', 'nouveau');
  await page.waitForTimeout(900);
  const filtered = await page.locator('#tableBody tr').count();
  step('filtre statut=nouveau', filtered >= 1, filtered + ' ligne(s)');
  await page.selectOption('#filterStatus', '');
  await page.waitForTimeout(600);

  // ── 5. Création d'un patient avec coordonnées ──────────────────────────
  const marker = 'E2E' + Date.now().toString().slice(-6);
  await page.click('#btnAddPatient, #addPatient, [onclick*="openModal()"]');
  await page.waitForTimeout(500);
  await page.fill('#fNom', 'Testeur');
  await page.fill('#fPrenom', marker);
  await page.fill('#fDdn', '1975-03-03');
  await page.fill('#fEmail', 'e2e@example.fr');
  await page.fill('#fTel', '0611223344');
  await page.fill('#fAdresse', '12 rue de la Paix');
  await page.fill('#fCp', '31200');
  await page.fill('#fVille', 'Toulouse');
  await page.selectOption('#fStatut', 'suivi');
  const medVal = await page.locator('#fMedecin option').nth(1).getAttribute('value');
  await page.selectOption('#fMedecin', medVal);
  await page.click('#saveBtn');
  await page.waitForTimeout(1500);

  const after = await page.locator('#tableBody').innerText().catch(() => '');
  step('patient cree et visible', after.includes(marker));

  // ── 6. Relecture : les coordonnees sont-elles conservees ? ──────────────
  const row = page.locator('#tableBody tr', { hasText: marker }).first();
  await row.click();
  await page.waitForTimeout(900);
  const email = await page.inputValue('#fEmail');
  const tel = await page.inputValue('#fTel');
  const addr = await page.inputValue('#fAdresse');
  const cp = await page.inputValue('#fCp');
  const ville = await page.inputValue('#fVille');
  const statut = await page.inputValue('#fStatut');
  step('email persiste', email === 'e2e@example.fr', email);
  step('telephone persiste', tel === '0611223344', tel);
  step('adresse persiste', addr === '12 rue de la Paix' && cp === '31200' && ville === 'Toulouse', `${addr} / ${cp} / ${ville}`);
  step('statut persiste', statut === 'suivi', statut);

  // ── 7. Suppression ──────────────────────────────────────────────────────
  page.once('dialog', (d) => d.accept());
  await page.click('#btnDelete');
  await page.waitForTimeout(1500);
  const final = await page.locator('#tableBody').innerText().catch(() => '');
  step('patient supprime', !final.includes(marker));

  // ── 8. Erreurs console ──────────────────────────────────────────────────
  step('aucune erreur JS', errors.length === 0, errors.join(' | ') || 'aucune');

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
