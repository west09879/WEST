// customer-account.js

(function() {
  if (!API.requireCustomerAuth()) return;

  const $ = id => document.getElementById(id);
  
  function showAlert(containerId, msg, type = 'error') {
    API.showAlert(containerId, msg, type);
  }
  
  function setLoading(btn, on) {
    API.setLoading(btn, on);
  }

  // Tab switching
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $(`sec-${t.dataset.tab}`).classList.add('active');
    });
  });

  async function loadProfile() {
    const res = await API.request('/auth/me');
    if (!res || !res.ok) return;
    const c = await res.json();
    
    const avatar = $('avatar');
    if (avatar) avatar.textContent = c.name ? c.name.charAt(0).toUpperCase() : '?';
    
    const profileName = $('profile-name');
    if (profileName) profileName.textContent = c.name || '—';
    
    const profileEmail = $('profile-email');
    if (profileEmail) profileEmail.textContent = c.email || '—';
    
    const pName = $('p-name');
    if (pName) pName.value = c.name || '';
    
    const pEmail = $('p-email');
    if (pEmail) pEmail.value = c.email || '';
    
    const pPhone = $('p-phone');
    if (pPhone) pPhone.value = c.phone || '';
    
    const memberSince = $('member-since');
    if (memberSince) memberSince.textContent = c.createdAt ? API.formatDate(c.createdAt) : '—';
    
    const emailVerified = $('email-verified');
    if (emailVerified) emailVerified.textContent = c.emailVerified ? '✅ Yes' : '❌ No';
  }

  const saveProfileBtn = $('save-profile-btn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const name = $('p-name').value.trim();
      const phone = $('p-phone').value.trim();
      if (!name) {
        showAlert('profile-msg', 'Name cannot be empty');
        return;
      }
      const btn = $('save-profile-btn');
      setLoading(btn, true);
      const res = await API.request('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone: phone || null })
      });
      const data = await res.json();
      setLoading(btn, false);
      if (res.ok) {
        showAlert('profile-msg', 'Profile updated successfully.', 'success');
        const profileName = $('profile-name');
        if (profileName) profileName.textContent = data.name || name;
        const avatar = $('avatar');
        if (avatar) avatar.textContent = (data.name || name).charAt(0).toUpperCase();
      } else {
        showAlert('profile-msg', data.error || 'Failed to update profile');
      }
    });
  }

  // Password strength meter
  const pwNew = $('pw-new');
  if (pwNew) {
    pwNew.addEventListener('input', function() {
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

  const changePwBtn = $('change-pw-btn');
  if (changePwBtn) {
    changePwBtn.addEventListener('click', async () => {
      const current = $('pw-current').value;
      const newPw = $('pw-new').value;
      const confirm = $('pw-confirm').value;
      if (!current || !newPw || !confirm) {
        showAlert('pw-msg', 'Please fill in all fields');
        return;
      }
      if (newPw !== confirm) {
        showAlert('pw-msg', 'New passwords do not match');
        return;
      }
      const btn = $('change-pw-btn');
      setLoading(btn, true);
      const res = await API.request('/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: current, newPassword: newPw })
      });
      const data = await res.json();
      setLoading(btn, false);
      if (res.ok) {
        showAlert('pw-msg', 'Password changed successfully. Please log in again.', 'success');
        setTimeout(async () => {
          await API.logout();
        }, 2200);
      } else {
        showAlert('pw-msg', data.error || 'Failed to change password');
      }
    });
  }

  const signoutAllBtn = $('signout-all-btn');
  if (signoutAllBtn) {
    signoutAllBtn.addEventListener('click', async () => {
      if (!confirm('Sign out of all devices?')) return;
      await API.logout();
    });
  }

  const logoutBtn = $('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await API.logout();
    });
  }

  loadProfile();
})();