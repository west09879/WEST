// reset-password.js

(function() {
  const token = new URLSearchParams(window.location.search).get('token');
  const $ = id => document.getElementById(id);

  if (token) {
    const requestForm = $('request-form');
    const resetForm = $('reset-form');
    const topSub = $('top-sub');
    if (requestForm) requestForm.style.display = 'none';
    if (resetForm) resetForm.style.display = '';
    if (topSub) topSub.textContent = 'Enter your new password below';
  }

  function showAlert(msg, type = 'error') {
    const msgDiv = $('msg');
    if (!msgDiv) return;
    const icons = { error: 'exclamation-triangle', success: 'check-circle' };
    msgDiv.innerHTML = `<div class="alert alert-${type}"><i class="fas fa-${icons[type]}"></i>${msg}</div>`;
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  const newPass = $('new-pass');
  if (newPass) {
    newPass.addEventListener('input', function() {
      const p = this.value;
      let s = 0;
      if (p.length >= 8) s += 25;
      if (/[a-z]/.test(p)) s += 25;
      if (/[A-Z]/.test(p)) s += 25;
      if (/\d/.test(p) && /[@$!%*?&^#]/.test(p)) s += 25;
      const fill = $('pw-fill');
      if (fill) {
        fill.style.width = s + '%';
        const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#27ae60'];
        const labels = ['Weak', 'Fair', 'Good', 'Strong'];
        const idx = Math.min(Math.floor(s / 26), 3);
        fill.style.background = colors[idx];
        const pwTxt = $('pw-txt');
        if (pwTxt) pwTxt.textContent = labels[idx] + ' password';
      }
    });
  }

  const reqBtn = $('req-btn');
  if (reqBtn) {
    reqBtn.addEventListener('click', async () => {
      const reqEmail = $('req-email');
      if (!reqEmail) return;
      const email = reqEmail.value.trim();
      if (!email) {
        showAlert('Please enter your email address');
        return;
      }
      const btn = $('req-btn');
      setLoading(btn, true);
      try {
        await fetch('/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        setLoading(btn, false);
        showAlert('If that email is registered, a reset link has been sent. Check your inbox.', 'success');
        if (reqEmail) reqEmail.value = '';
      } catch {
        setLoading(btn, false);
        showAlert('Network error. Please try again.');
      }
    });
  }

  const resetBtn = $('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const newPassword = $('new-pass');
      const confirmPass = $('confirm-pass');
      if (!newPassword || !confirmPass) return;
      const newPw = newPassword.value;
      const confirm = confirmPass.value;
      if (!newPw || !confirm) {
        showAlert('Please fill in both fields');
        return;
      }
      if (newPw !== confirm) {
        showAlert('Passwords do not match');
        return;
      }
      const btn = $('reset-btn');
      setLoading(btn, true);
      try {
        const res = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: newPw })
        });
        const data = await res.json();
        setLoading(btn, false);
        if (res.ok) {
          showAlert('Password reset successful! Redirecting to login…', 'success');
          setTimeout(() => window.location.href = '/customer-login.html', 2000);
        } else {
          showAlert(data.error || 'Failed to reset password');
        }
      } catch {
        setLoading(btn, false);
        showAlert('Network error. Please try again.');
      }
    });
  }
})();