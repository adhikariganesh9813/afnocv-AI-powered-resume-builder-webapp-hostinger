// Already signed in? Skip the homepage entirely.
if (Auth.isSignedIn()) window.location.href = '/dashboard.html';

const tabs = document.querySelectorAll('.auth-tab');
const forms = {
  login: document.getElementById('login-form'),
  signup: document.getElementById('signup-form'),
};

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
    Object.entries(forms).forEach(([name, form]) => {
      form.hidden = name !== tab.dataset.tab;
    });
    document.querySelectorAll('.auth-error').forEach((el) => (el.hidden = true));
  });
});

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
