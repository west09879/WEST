// api.js — BeFo Bakers shared API module
// Place this file at the root next to your HTML files

const API = (() => {
  const BASE = '';  // Empty because API is on same origin

  // Token storage keys
  const KEYS = {
    access: 'bf_access',
    refresh: 'bf_refresh',
    customer: 'bf_customer',
    admin: 'adminToken',
    worker: 'workerToken'
  };

  function getAccess() { return localStorage.getItem(KEYS.access); }
  function getRefresh() { return localStorage.getItem(KEYS.refresh); }
  function getCustomer() {
    try { return JSON.parse(localStorage.getItem(KEYS.customer) || 'null'); }
    catch { return null; }
  }
  function getAdminToken() { return localStorage.getItem(KEYS.admin); }
  function getWorkerToken() { return localStorage.getItem(KEYS.worker); }

  function setTokens(accessToken, refreshToken, customer) {
    if (accessToken) localStorage.setItem(KEYS.access, accessToken);
    if (refreshToken) localStorage.setItem(KEYS.refresh, refreshToken);
    if (customer) localStorage.setItem(KEYS.customer, JSON.stringify(customer));
  }

  function clearSession() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  function isLoggedIn() { return !!getAccess(); }
  function isAdminLoggedIn() { return !!getAdminToken(); }
  function isWorkerLoggedIn() { return !!getWorkerToken(); }

  // Authenticated fetch with automatic token refresh
  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const access = getAccess();
    if (access) headers['Authorization'] = `Bearer ${access}`;

    try {
      let res = await fetch(BASE + path, { ...options, headers });

      if (res.status === 401) {
        let body = {};
        try { body = await res.clone().json(); } catch {}
        if (body.code === 'TOKEN_EXPIRED') {
          const refreshed = await tryRefresh();
          if (refreshed) {
            headers['Authorization'] = `Bearer ${getAccess()}`;
            res = await fetch(BASE + path, { ...options, headers });
          } else {
            clearSession();
            // Don't redirect if already on login page
            if (!window.location.pathname.includes('customer-login') && 
                !window.location.pathname.includes('reset-password')) {
              window.location.href = '/customer-login.html';
            }
            return null;
          }
        }
      }
      return res;
    } catch (err) {
      console.error('API request error:', err);
      return null;
    }
  }

  async function tryRefresh() {
    const refreshToken = getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) return false;
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken || null);
      return true;
    } catch { return false; }
  }

  async function logout() {
    const refreshToken = getRefresh();
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });
    } catch {}
    clearSession();
    window.location.href = '/customer-login.html';
  }

  function requireCustomerAuth() {
    if (!isLoggedIn()) {
      window.location.href = '/customer-login.html';
      return false;
    }
    return true;
  }

  function getFirstName() {
    const c = getCustomer();
    return c && c.name ? c.name.split(' ')[0] : null;
  }

  return {
    BASE,
    KEYS,
    getAccess,
    getRefresh,
    getCustomer,
    getFirstName,
    getAdminToken,
    getWorkerToken,
    setTokens,
    clearSession,
    isLoggedIn,
    isAdminLoggedIn,
    isWorkerLoggedIn,
    request,
    logout,
    requireCustomerAuth
  };
})();

// Make it globally available
window.API = API;