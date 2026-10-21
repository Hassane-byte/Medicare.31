/**
 * Création d'un espace patient : toutes les informations saisies sont
 * transmises à l'API, qui crée le dossier et envoie l'e-mail de confirmation.
 */

let current = 1;

function goTo(step) {
  if (step > current && !validate(current)) return;

  if (step === 4) fillSummary();

  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById('s' + i);
    s.classList.remove('active', 'done');

    if (i < step) s.classList.add('done');
    if (i === step) s.classList.add('active');
  }

  document.querySelectorAll('.step-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  document.getElementById('panel' + step).classList.add('active');

  current = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validate(step) {
  let ok = true;

  function check(id, errId, condition) {
    const el = document.getElementById(id);
    const err = document.getElementById(errId);

    if (!el || !err) return;

    if (!condition(el.value)) {
      el.classList.add('error');
      el.classList.remove('valid');
      err.classList.add('show');
      ok = false;
    } else {
      el.classList.remove('error');
      el.classList.add('valid');
      err.classList.remove('show');
    }
  }

  if (step === 1) {
    check('nom', 'err-nom', value => value.trim().length > 0);
    check('prenom', 'err-prenom', value => value.trim().length > 0);
    check('ddn', 'err-ddn', value => value.length > 0);
    check('sexe', 'err-sexe', value => value !== '');
    check('email', 'err-email', value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()));
  }

  if (step === 2) {
    check('tel', 'err-tel', value => value.replace(/\s/g, '').length >= 10);
    check('adresse', 'err-adresse', value => value.trim().length > 0);
    check('cp', 'err-cp', value => /^\d{5}$/.test(value));
    check('ville', 'err-ville', value => value.trim().length > 0);
  }

  if (step === 3) {
    const pwd = document.getElementById('pwd');
    const pwd2 = document.getElementById('pwd2');
    const cgu = document.getElementById('cgu');
    const hds = document.getElementById('hds');

    if (pwd.value.length < 8) {
      pwd.classList.add('error');
      document.getElementById('err-pwd').classList.add('show');
      ok = false;
    } else {
      pwd.classList.remove('error');
      pwd.classList.add('valid');
      document.getElementById('err-pwd').classList.remove('show');
    }

    if (pwd.value !== pwd2.value || pwd2.value.length === 0) {
      pwd2.classList.add('error');
      document.getElementById('err-pwd2').classList.add('show');
      ok = false;
    } else {
      pwd2.classList.remove('error');
      pwd2.classList.add('valid');
      document.getElementById('err-pwd2').classList.remove('show');
    }

    if (!cgu.checked) {
      document.getElementById('err-cgu').classList.add('show');
      ok = false;
    } else {
      document.getElementById('err-cgu').classList.remove('show');
    }

    if (!hds.checked) {
      document.getElementById('err-hds').classList.add('show');
      ok = false;
    } else {
      document.getElementById('err-hds').classList.remove('show');
    }
  }

  return ok;
}

function fillSummary() {
  const civ = document.querySelector('input[name="civilite"]:checked');
  const ddn = document.getElementById('ddn').value;
  const adresse = [
    document.getElementById('adresse').value,
    document.getElementById('cp').value,
    document.getElementById('ville').value
  ].filter(Boolean).join(', ');

  const CIVILITES = { M: 'M.', Mme: 'Mme', Autre: 'Autre' };

  document.getElementById('sum-civ').textContent = civ
    ? CIVILITES[civ.value] || civ.value
    : '—';
  document.getElementById('sum-nom').textContent = document.getElementById('nom').value || '—';
  document.getElementById('sum-prenom').textContent = document.getElementById('prenom').value || '—';
  document.getElementById('sum-email').textContent = document.getElementById('email').value || '—';
  document.getElementById('sum-tel').textContent = document.getElementById('tel').value || '—';
  document.getElementById('sum-adresse').textContent = adresse || '—';

  if (ddn) {
    const date = new Date(ddn);
    document.getElementById('sum-ddn').textContent = date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } else {
    document.getElementById('sum-ddn').textContent = '—';
  }
}

function showFeedback(message, type = 'error') {
  const el = document.getElementById('registerFeedback');
  if (!el) return;
  el.textContent = message;
  el.className = 'register-feedback ' + type;
  el.classList.add('show');
}

async function submitForm() {
  // On revalide l'ensemble des étapes avant d'envoyer.
  for (const step of [1, 2, 3]) {
    if (!validate(step)) {
      goTo(step);
      showFeedback('Certaines informations sont incomplètes ou invalides.');
      return;
    }
  }

  const submitBtn = document.getElementById('submitBtn');
  const civ = document.querySelector('input[name="civilite"]:checked');

  const payload = {
    civilite: civ ? civ.value : null,
    nom: document.getElementById('nom').value.trim(),
    prenom: document.getElementById('prenom').value.trim(),
    date_naissance: document.getElementById('ddn').value,
    sexe: document.getElementById('sexe').value || null,
    email: document.getElementById('email').value.trim().toLowerCase(),
    password: document.getElementById('pwd').value,
    telephone_principal: document.getElementById('tel').value.trim() || null,
    telephone_secondaire: document.getElementById('tel2').value.trim() || null,
    adresse_ligne1: document.getElementById('adresse').value.trim() || null,
    code_postal: document.getElementById('cp').value.trim() || null,
    ville: document.getElementById('ville').value.trim() || null,
    cgu_accepted: document.getElementById('cgu').checked,
    hds_consent: document.getElementById('hds').checked,
    notif_email_sms_consent: true
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Création en cours…';

  try {
    const response = await fetch('/api/auth/register/patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = typeof data.detail === 'string'
        ? data.detail
        : 'Erreur pendant la création du compte.';
      showFeedback(detail);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Créer mon compte';
      return;
    }

    document.querySelectorAll('.step-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    document.getElementById('stepper').style.display = 'none';
    document.getElementById('successEmail').textContent = payload.email;
    document.getElementById('successView').classList.add('show');

  } catch (error) {
    console.error(error);
    showFeedback('Erreur serveur. Vérifiez que le backend est lancé.');
  } finally {
    if (submitBtn.disabled) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Créer mon compte';
    }
  }
}

/* ── Force du mot de passe ────────────────────────────────────────────────── */

const STRENGTH_COLORS = ['#f04438', '#f79009', '#e8a838', '#12b76a'];
const STRENGTH_LABELS = ['Très faible', 'Faible', 'Moyen', 'Fort'];

function checkStrength(value) {
  const bars = ['sb1', 'sb2', 'sb3', 'sb4'];
  const label = document.getElementById('strengthLabel');

  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  const index = value ? Math.min(Math.floor((score / 5) * 4), 3) : -1;

  bars.forEach((id, i) => {
    const bar = document.getElementById(id);
    if (!bar) return;
    if (i <= index) {
      bar.style.background = STRENGTH_COLORS[index];
      bar.classList.add('on');
    } else {
      bar.style.background = '';
      bar.classList.remove('on');
    }
  });

  if (label) label.textContent = value ? STRENGTH_LABELS[index] : 'Entrez un mot de passe';
}

function toggleEye(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);

  if (!input) return;

  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';

  if (!icon) return;

  icon.innerHTML = visible
    ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
    : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = year;
  });
});
