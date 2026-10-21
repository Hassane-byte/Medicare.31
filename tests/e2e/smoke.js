const { chromium } = require('playwright');
const BASE = 'http://localhost';

const ROLES = {
  medecin: ['dr.martin@medicare31.fr', 'Medecin123!'],
  secretariat: ['secretaire.dupont@medicare31.fr', 'Secretaire123!'],
  patient: ['patient.durand@gmail.com', 'Patient123!'],
  admin: ['admin@medicare31.fr', 'Admin123!'],
};

const PAGES = ['index.html', 'index2.html', 'index3.html', 'patients.html', 'calendrier.html', 'messagerie.html', 'documents.html', 'statistiques.html'];

(async () => {
  const browser = await chromium.launch();
  let fails = 0;

  for (const [role, creds] of Object.entries(ROLES)) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('JS: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push('CONSOLE: ' + m.text().slice(0, 200)); });

    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
    await page.fill('#email', creds[0]);
    await page.fill('#password', creds[1]);
    await page.click('button[type="submit"]');
    await page.waitForURL(/index\d?\.html/, { timeout: 15000 });

    for (const p of PAGES) {
      errors.length = 0;
      await page.goto(BASE + '/' + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1400);
      const ok = errors.length === 0;
      if (!ok) fails++;
      const ident = await page.evaluate(() => document.getElementById('user-nav-name')?.textContent || '-');
      console.log(`${ok ? 'OK   ' : 'ECHEC'} [${role.padEnd(12)}] ${p.padEnd(19)} ident=${ident.padEnd(18)} ${ok ? '' : errors.join(' | ')}`);
    }
    await ctx.close();
  }

  console.log(fails === 0 ? '\n=> AUCUNE ERREUR' : `\n=> ${fails} PAGE(S) EN ERREUR`);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
