// worker-login.js

(function() {
  // Check if already logged in
  if (localStorage.getItem('workerToken')) {
    window.location.replace('/worker/worker.html');
    return;
  }

  const $ = id => document.getElementById(id);

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
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Order Queue';
    }
  }

  const workerForm = $('workerForm');
  if (workerForm) {
    workerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('username');
      const password = $('password');
      const btn = $('submit-btn');
      
      if (!username || !password) return;
      
      setLoading(btn, true);
      
      try {
        const res = await fetch('/auth/worker/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.value.trim(),
            password: password.value
          })
        });
        
        const data = await res.json();
        setLoading(btn, false);
        
        if (res.ok) {
          localStorage.setItem('workerToken', data.token);
          if (data.worker) {
            localStorage.setItem('workerInfo', JSON.stringify(data.worker));
          } else {
            localStorage.setItem('workerInfo', JSON.stringify({ username: username.value.trim() }));
          }
          showAlert('Login successful! Redirecting...', 'success');
          setTimeout(() => {
            window.location.replace('/worker/worker.html');
          }, 1000);
        } else {
          showAlert(data.error || 'Invalid credentials. Please try again.');
        }
      } catch (err) {
        setLoading(btn, false);
        showAlert('Network error. Please try again.');
        console.error('Login error:', err);
      }
    });
  }
})();