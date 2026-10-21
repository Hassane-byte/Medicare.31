const { chromium } = require('playwright');
const BASE = 'http://localhost';

let fails = 0;
const ok = (t, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK   ' : 'ECHEC'} ${t}${extra ? ' -> ' + extra : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('JS: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); });

  const marker = 'Test' + String(Date.now()).slice(-6);
  const email = marker.toLowerCase() + '@exemple.fr';

  await page.goto(BASE + '/register.html', { waitUntil: 'networkidle' });

  // Etape 1 : identite
  await page.locator('label.radio-opt', { hasText: 'Mme' }).first().click();
  await page.fill('#nom', 'Durand');
  await page.fill('#prenom', marker);
  await page.fill('#ddn', '1990-04-12');
  await page.selectOption('#sexe', 'Féminin');
  await page.fill('#email', email);
  await page.click('button:has-text("Suivant")');
  await page.waitForTimeout(700);
  ok('etape 1 -> etape 2', await page.locator('#panel2.active').count() === 1);

  // Etape 2 : coordonnees
  await page.fill('#tel', '0612345678');
  await page.fill('#tel2', '0561000000');
  await page.fill('#adresse', '25 rue des Lilas');
  await page.fill('#cp', '31200');
  await page.fill('#ville', 'Toulouse');
  await page.click('#panel2 button:has-text("Suivant")');
  await page.waitForTimeout(700);
  ok('etape 2 -> etape 3', await page.locator('#panel3.active').count() === 1);

  // Etape 3 : securite
  await page.fill('#pwd', 'MotDePasse123!');
  await page.fill('#pwd2', 'MotDePasse123!');
  await page.locator('#cgu + .custom-cb').click();
  await page.locator('#hds + .custom-cb').click();
  const cguChecked = await page.locator('#cgu').isChecked();
  const hdsChecked = await page.locator('#hds').isChecked();
  ok('consentements coches', cguChecked && hdsChecked, `cgu=${cguChecked} hds=${hdsChecked}`);
  await page.click('#panel3 button:has-text("Vérifier mon inscription")');
  await page.waitForTimeout(700);
  ok('etape 3 -> etape 4', await page.locator('#panel4.active').count() === 1);

  // Le resume doit refleter les donnees saisies
  const summary = await page.locator('#panel4').innerText();
  ok('resume coherent', summary.includes('Durand') && summary.includes(email) && summary.includes('25 rue des Lilas'),
     summary.replace(/\n+/g, ' | ').slice(0, 140));

  // Etape 4 : creation
  await page.click('#submitBtn');
  await page.waitForTimeout(2000);
  const success = await page.locator('#successView.show').count();
  ok('compte cree', success === 1);
  const shownEmail = await page.locator('#successEmail').innerText();
  ok('e-mail confirme', shownEmail.trim() === email, shownEmail);

  // Un e-mail de verification doit etre parti (MailHog)
  const mails = await (await fetch('http://localhost:8025/api/v2/messages?limit=5')).json();
  const items = mails.items || mails.messages || [];
  const found = items.some((m) =>
    (m.To || []).some((t) => `${t.Mailbox || ''}@${t.Domain || ''}` === email ||
      (t.Address || '') === email),
  );
  ok('e-mail de verification envoye', found, items.length + ' message(s) en boite');

  ok('aucune erreur JS', errors.length === 0, errors.slice(0, 2).join(' | ') || 'aucune');

  console.log(fails === 0 ? '\n=> INSCRIPTION FONCTIONNELLE' : `\n=> ${fails} ECHEC(S)`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
