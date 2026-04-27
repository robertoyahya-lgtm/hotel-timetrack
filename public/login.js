'use strict';
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('htp_token')) {
    window.location.href = '/';
    return;
  }

  const form  = document.getElementById('login-form');
  const btn   = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    btn.disabled    = true;
    btn.textContent = 'Signing in...';
    errEl.textContent = '';
    errEl.style.display = 'none';

    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    document.getElementById('email').value.trim(),
          password: document.getElementById('password').value
        })
      });
      const data = await res.json();

      if (!res.ok) {
        errEl.textContent   = data.error || 'Login failed. Please try again.';
        errEl.style.display = 'block';
        btn.disabled    = false;
        btn.textContent = 'Sign In';
        return;
      }

      localStorage.setItem('htp_token', data.token);
      localStorage.setItem('htp_user',  JSON.stringify(data.user));
      window.location.href = '/';
    } catch {
      errEl.textContent   = 'Connection error. Please try again.';
      errEl.style.display = 'block';
      btn.disabled    = false;
      btn.textContent = 'Sign In';
    }
  });
});
