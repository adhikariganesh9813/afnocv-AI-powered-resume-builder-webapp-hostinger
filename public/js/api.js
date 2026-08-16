const TOKEN_KEY = 'afnocv_token';

const Auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
  isSignedIn() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },
  signOut() {
    Auth.clear();
    window.location.href = '/';
  },
  // Called at the top of pages that only make sense when signed in.
  requirePage() {
    if (!Auth.isSignedIn()) window.location.href = '/';
  },
};

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, { ...options, headers });

  // An expired or missing token means the session is over — send them back
  // to the homepage rather than letting the page fail in confusing ways.
  if (response.status === 401 && Auth.isSignedIn()) {
    Auth.clear();
    window.location.href = '/';
    throw new Error('Session expired.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

const api = {
  signup: (email, password) =>
    apiRequest('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => apiRequest('/api/auth/me'),
  getProfile: () => apiRequest('/api/profile'),
  saveProfile: (profile) =>
    apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
};
