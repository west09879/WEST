// admin-login.js

(function() {
  // Check if already logged in
  if (localStorage.getItem('adminToken')) {
    window.location.replace('/admin/index.html');
    return;
  }

  const $ = id => document.getElementById(id);

  function showAlert(msg, type = 'error') {
    const msgDiv = $('msg');
    if (!msgDiv) return;
    const icons = { error: 'exclamation-triangle', success: 'check-circle' };
    msgDiv.innerHTML = `<div class="alert alert-${type}"><i class="fas fa-${icons[type]}"></i>${msg}</div>`;
  }

  const adminForm = $('adminForm');
  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('username');
      const password = $('password');
      const btn = $('submit-btn');
      
      if (!username || !password) return;
      
      btn.classList.add('loading');
      btn.disabled = true;
      
      try {
        const res = await fetch('/auth/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.value.trim(),
            password: password.value
          })
        });
        const data = await res.json();
        btn.classList.remove('loading');
        btn.disabled = false;
        
        if (res.ok) {
          localStorage.setItem('adminToken', data.token);
          showAlert('Login successful! Redirecting…', 'success');
          setTimeout(() => window.location.replace('/admin/index.html'), 900);
        } else {
          showAlert(data.error || 'Invalid credentials. Please try again.');
        }
      } catch {
        btn.classList.remove('loading');
        btn.disabled = false;
        showAlert('Network error. Please try again.');
      }
    });
  }
})();