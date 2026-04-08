// customer-login.js

(function() {
  // Check if already logged in
  if (API.isLoggedIn && API.isLoggedIn()) {
    window.location.replace('/customer-dashboard.html');
    return;
  }

  let pendingEmail = null;
  let timerInterval = null;
  let timeLeft = 600;

  const $ = id => document.getElementById(id);

  function showAlert(containerId, msg, type = 'error') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const icons = { error: 'exclamation-circle', success: 'check-circle', info: 'info-circle' };
    const colors = { error: '#e74c3c', success: '#27ae60', info: '#3498db' };
    container.innerHTML = `<div style="padding: 12px; border-radius: 8px; background: ${colors[type]}20; border-left: 4px solid ${colors[type]}; display: flex; align-items: center; gap: 10px;">
      <i class="fas fa-${icons[type]}" style="color: ${colors[type]};"></i>
      <span>${msg}</span>
    </div>`;
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.setAttribute('data-original-text', btn.innerHTML);
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.getAttribute('data-original-text') || btn.textContent;
      btn.disabled = false;
    }
  }

  function show(card) {
    $('login-card').style.display = card === 'login' ? 'block' : 'none';
    $('register-card').style.display = card === 'register' ? 'block' : 'none';
  }

  // Password strength meter
  const rPass = $('r-pass');
  if (rPass) {
    rPass.addEventListener('input', function() {
      const p = this.value;
      let s = 0;
      if (p.length >= 8) s = 100;
      else s = (p.length / 8) * 100;
      const fill = $('pw-fill');
      if (fill) {
        fill.style.width = s + '%';
        fill.style.background = s >= 100 ? '#27ae60' : '#f39c12';
      }
      const pwTxt = $('pw-txt');
      if (pwTxt) {
        pwTxt.textContent = s >= 100 ? 'Strong password' : (p.length ? `Add ${8 - p.length} more characters` : 'Min 8 characters');
      }
    });
  }

  // Registration
  const registerForm = $('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!$('terms').checked) {
        showAlert('reg-msg', 'Please accept the Terms & Conditions');
        return;
      }
      const btn = e.target.querySelector('button');
      setLoading(btn, true);
      try {
        const res = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: $('r-name').value.trim(),
            email: $('r-email').value.trim().toLowerCase(),
            phone: $('r-phone').value.trim() || null,
            password: $('r-pass').value
          })
        });
        const data = await res.json();
        setLoading(btn, false);
        if (res.ok) {
          showAlert('reg-msg', 'Account created! Check your email for verification code.', 'success');
          const email = $('r-email').value.trim().toLowerCase();
          setTimeout(() => openOTP(email), 1000);
        } else {
          showAlert('reg-msg', data.error || 'Registration failed');
        }
      } catch (err) {
        setLoading(btn, false);
        showAlert('reg-msg', 'Network error. Please try again.');
      }
    });
  }

  // Login
  const loginForm = $('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      setLoading(btn, true);
      const email = $('l-email').value.trim().toLowerCase();
      try {
        const res = await fetch('/auth/customer/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: $('l-pass').value })
        });
        const data = await res.json();
        setLoading(btn, false);
        if (res.ok) {
          API.setTokens(data.accessToken, data.refreshToken, data.customer);
          showAlert('login-msg', 'Login successful! Redirecting...', 'success');
          setTimeout(() => window.location.replace('/customer-dashboard.html'), 1000);
        } else if (data.needsVerification) {
          showAlert('login-msg', `Email not verified. Please verify first.`, 'warn');
          openOTP(email);
        } else {
          showAlert('login-msg', data.error || 'Login failed');
        }
      } catch (err) {
        setLoading(btn, false);
        showAlert('login-msg', 'Network error. Please try again.');
      }
    });
  }

  // OTP Functions
  window.openOTP = function(email) {
    pendingEmail = email;
    $('otp-subtitle').textContent = `We sent a 6-digit code to ${email}`;
    $('otp-msg').innerHTML = '';
    $('otp-overlay').classList.add('show');
    document.body.style.overflow = 'hidden';
    resetOTPInputs();
    startTimer();
  };

  function closeOTP() {
    $('otp-overlay').classList.remove('show');
    document.body.style.overflow = '';
    clearInterval(timerInterval);
  }

  function resetOTPInputs() {
    const inputs = $('otp-inputs').querySelectorAll('input');
    inputs.forEach(i => { i.value = ''; });
    if (inputs[0]) inputs[0].focus();
  }

  function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 600;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft <= 0) clearInterval(timerInterval);
    }, 1000);
  }

  function updateTimerDisplay() {
    const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const s = String(timeLeft % 60).padStart(2, '0');
    $('otp-timer').textContent = `Time remaining: ${m}:${s}`;
  }

  const otpInputs = $('otp-inputs');
  if (otpInputs) {
    otpInputs.addEventListener('input', e => {
      if (!/^\d$/.test(e.target.value)) { e.target.value = ''; return; }
      const inputs = [...otpInputs.querySelectorAll('input')];
      const idx = inputs.indexOf(e.target);
      if (idx < inputs.length - 1) inputs[idx + 1].focus();
    });

    otpInputs.addEventListener('keydown', e => {
      if (e.key !== 'Backspace') return;
      const inputs = [...otpInputs.querySelectorAll('input')];
      const idx = inputs.indexOf(e.target);
      if (!e.target.value && idx > 0) inputs[idx - 1].focus();
    });

    otpInputs.addEventListener('paste', e => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
      const inputs = [...otpInputs.querySelectorAll('input')];
      digits.forEach((d, i) => { if (inputs[i]) inputs[i].value = d; });
      const next = inputs[Math.min(digits.length, inputs.length - 1)];
      if (next) next.focus();
    });
  }

  const verifyBtn = $('verify-btn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const otp = [...$('otp-inputs').querySelectorAll('input')].map(i => i.value).join('');
      if (otp.length !== 6) {
        showAlert('otp-msg', 'Please enter the full 6-digit code');
        return;
      }
      const btn = $('verify-btn');
      setLoading(btn, true);
      try {
        const res = await fetch('/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: pendingEmail, otp })
        });
        const data = await res.json();
        setLoading(btn, false);
        if (res.ok) {
          showAlert('otp-msg', 'Email verified! You can now sign in.', 'success');
          setTimeout(() => { closeOTP(); show('login'); }, 1500);
        } else {
          showAlert('otp-msg', data.error || 'Verification failed');
          resetOTPInputs();
        }
      } catch (err) {
        setLoading(btn, false);
        showAlert('otp-msg', 'Network error. Please try again.');
      }
    });
  }

  const resendLink = $('resend-link');
  if (resendLink) {
    resendLink.addEventListener('click', async e => {
      e.preventDefault();
      if (!pendingEmail) return;
      const link = $('resend-link');
      link.style.pointerEvents = 'none';
      link.style.opacity = '.5';
      try {
        const res = await fetch('/auth/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: pendingEmail })
        });
        const data = await res.json();
        if (res.ok) {
          showAlert('otp-msg', 'New code sent to your email.', 'success');
          startTimer();
          resetOTPInputs();
        } else {
          showAlert('otp-msg', data.error || 'Could not resend');
        }
      } catch (err) {
        showAlert('otp-msg', 'Network error. Please try again.');
      } finally {
        link.style.pointerEvents = '';
        link.style.opacity = '';
      }
    });
  }

  const otpBackLink = $('otp-back-link');
  if (otpBackLink) {
    otpBackLink.addEventListener('click', e => {
      e.preventDefault();
      closeOTP();
      show('login');
    });
  }

  const goRegister = $('go-register');
  const goLogin = $('go-login');
  if (goRegister) goRegister.addEventListener('click', e => { e.preventDefault(); show('register'); });
  if (goLogin) goLogin.addEventListener('click', e => { e.preventDefault(); show('login'); });
})();