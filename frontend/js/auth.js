const AUTH_TOKEN_KEY = 'medicare_token';
const AUTH_USER_KEY  = 'medicare_user';

/**
 * La session est conservée dans localStorage si l'utilisateur a demandé à
 * rester connecté, dans sessionStorage sinon (elle expire alors avec le
 * navigateur). Les deux emplacements sont donc toujours consultés.
 */
function readSession(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function authGuard() {
  if (!readSession(AUTH_TOKEN_KEY)) {
    window.location.replace('/login.html');
    return false;
  }
  return true;
}

function getToken() {
  return readSession(AUTH_TOKEN_KEY);
}

function getUser() {
  try {
    return JSON.parse(readSession(AUTH_USER_KEY) || '{}');
  } catch {
    return {};
  }
}

function logout() {
  // On efface toutes les clés de session, dans les deux emplacements.
  const keys = [
    AUTH_TOKEN_KEY, AUTH_USER_KEY, 'access_token', 'token_type',
    'user_role', 'role', 'user_nom', 'user_prenom',
  ];
  keys.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  window.location.replace('/login.html');
}

function initUserNav() {
  const user = getUser();
  if (!user.nom) return;
  const nameEl   = document.getElementById('user-nav-name');
  const avatarEl = document.getElementById('user-nav-avatar');
  if (nameEl) {
    const prefix = user.role === 'medecin' ? 'Dr. ' : '';
    nameEl.textContent = prefix + (user.prenom || '') + ' ' + (user.nom || '');
  }
  if (avatarEl) {
    avatarEl.textContent = ((user.prenom || '')[0] || '') + ((user.nom || '')[0] || '');
  }
}
