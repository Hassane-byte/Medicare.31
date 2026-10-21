/**
 * Medicare31 API Client
 * Centralized handler for all network requests.
 *
 * Encapsulated in an IIFE: this file is loaded alongside auth.js on the same
 * page, and both declare a top-level `AUTH_TOKEN_KEY`. Sharing the global
 * scope would make the second one fail with a SyntaxError and silently
 * leave `window.api` undefined. The only public surface is `window.api`.
 */
(function () {
  const API_BASE_URL = ''; // Relative path to current domain
  const AUTH_TOKEN_KEY = 'medicare_token';

  async function request(endpoint, options = {}) {
    // La session peut être dans localStorage (connexion durable) ou
    // sessionStorage (jusqu'à la fermeture du navigateur).
    const token =
      localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);

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
        [AUTH_TOKEN_KEY, 'medicare_user', 'access_token', 'token_type'].forEach((k) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });
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

  // Helper for PATCH requests
  async function patch(endpoint, body) {
    return request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // Helper for DELETE requests
  async function del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  }

  // UI Notification Helper
  function ensureToast() {
    let toast = document.getElementById('toast');
    let toastMsg = document.getElementById('toastMsg');

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      toast.innerHTML = '<span id="toastMsg"></span>';
      document.body.appendChild(toast);
      toastMsg = document.getElementById('toastMsg');
    } else if (!toastMsg) {
      toastMsg = document.createElement('span');
      toastMsg.id = 'toastMsg';
      toast.appendChild(toastMsg);
    }

    return { toast, toastMsg };
  }

  function notify(message, type = 'info') {
    const { toast, toastMsg } = ensureToast();

    toastMsg.textContent = message;
    toast.className = `toast show toast-${type}`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  window.api = { get, post, put, patch, del, request, notify };
})();
