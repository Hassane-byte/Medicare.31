/**
 * Medicare31 API Client
 * Centralized handler for all network requests.
 */

const API_BASE_URL = ''; // Relative path to current domain
const AUTH_TOKEN_KEY = 'medicare_token';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  // 1. Setup Headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 2. Handle Loading State
  const loadingEl = document.getElementById('global-loader');
  if (loadingEl) loadingEl.classList.add('show');

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // 3. Handle Authorization Errors
    if (response.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem('medicare_user');
      window.location.replace('/login.html');
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Extract detail from FastAPI error format
      const errorMsg = data.detail || 'Une erreur est survenue lors de la requête.';
      throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
    }

    return data;

  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  } finally {
    if (loadingEl) loadingEl.classList.remove('show');
  }
}

// Helper for POST requests
async function post(endpoint, body) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Helper for GET requests
async function get(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${endpoint}?${query}` : endpoint;
  return request(url, { method: 'GET' });
}

// Helper for PUT requests
async function put(endpoint, body) {
  return request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// Helper for DELETE requests
async function del(endpoint) {
  return request(endpoint, { method: 'DELETE' });
}

// UI Notification Helper
function notify(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  if (!toast || !toastMsg) {
    // Fallback to alert if toast element doesn't exist on current page
    alert(message);
    return;
  }

  toastMsg.textContent = message;
  toast.className = `toast show toast-${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

window.api = { get, post, put, del, request, notify };
