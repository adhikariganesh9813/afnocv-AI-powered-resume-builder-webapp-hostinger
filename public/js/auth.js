// Already signed in? Skip the homepage entirely.
if (Auth.isSignedIn()) window.location.href = '/dashboard.html';

const tabsEl = document.querySelector('.auth-tabs');
const tabs = document.querySelectorAll('.auth-tab');
const forms = {
  login: document.getElementById('login-form'),
  signup: document.getElementById('signup-form'),
};

const HEADINGS = {
  login: { title: 'Welcome back', subtitle: 'Sign in to keep building your resume.' },
  signup: { title: 'Create your account', subtitle: 'Start tailoring your resume in minutes.' },
};

function switchTab(name) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === name;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  Object.entries(forms).forEach(([key, form]) => {
    form.hidden = key !== name;
  });

  tabsEl.classList.toggle('show-signup', name === 'signup');
  document.getElementById('auth-title').textContent = HEADINGS[name].title;
  document.getElementById('auth-subtitle').textContent = HEADINGS[name].subtitle;
  document.querySelectorAll('.auth-error').forEach((el) => (el.hidden = true));

  forms[name].querySelector('input').focus();
}

tabs.forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

// ---------- Show / hide password ----------

document.querySelectorAll('.password-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.toggle);
    const revealed = input.type === 'text';
    input.type = revealed ? 'password' : 'text';
    btn.textContent = revealed ? 'Show' : 'Hide';
    btn.setAttribute('aria-label', revealed ? 'Show password' : 'Hide password');
    input.focus();
  });
});

// ---------- Password strength (signup only) ----------

const signupPassword = document.getElementById('signup-password');
const strengthEl = document.getElementById('signup-strength');

signupPassword.addEventListener('input', () => {
  const value = signupPassword.value;

  if (!value) {
    strengthEl.hidden = true;
    return;
  }

  // Rough guidance only — the backend enforces the real minimum.
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  const level = score <= 2 ? 'weak' : score <= 3 ? 'fair' : 'strong';
  const label = { weak: 'Weak', fair: 'Fair', strong: 'Strong' }[level];

  strengthEl.hidden = false;
  strengthEl.className = `strength is-${level}`;
  strengthEl.querySelector('.strength-label').textContent = label;
});

// ---------- Submit ----------

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.hidden = false;
}

async function submitAuth(event, { errorId, request }) {
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Please wait...';
  document.getElementById(errorId).hidden = true;

  try {
    const { token } = await request();
    Auth.setToken(token);
    window.location.href = '/dashboard.html';
  } catch (err) {
    showError(errorId, err.message);
    button.disabled = false;
    button.textContent = originalText;
  }
}

forms.login.addEventListener('submit', (e) =>
  submitAuth(e, {
    errorId: 'login-error',
    request: () =>
      api.login(
        document.getElementById('login-email').value,
        document.getElementById('login-password').value
      ),
  })
);

forms.signup.addEventListener('submit', (e) =>
  submitAuth(e, {
    errorId: 'signup-error',
    request: () =>
      api.signup(
        document.getElementById('signup-email').value,
        document.getElementById('signup-password').value
      ),
  })
);
