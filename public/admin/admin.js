// admin/admin.js - Admin Dashboard JavaScript

(function() {
  const TOKEN_KEY = 'adminToken';
  let token = localStorage.getItem(TOKEN_KEY);
  let currentSection = 'dashboard';
  
  // Chart instances
  let visitorsChart = null;

  // Toast notification
  function toast(msg, type = 'success') {
    let toastContainer = document.getElementById('toasts');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toasts';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '20px';
      toastContainer.style.right = '20px';
      toastContainer.style.zIndex = '999';
      toastContainer.style.display = 'flex';
      toastContainer.style.flexDirection = 'column';
      toastContainer.style.gap = '8px';
      document.body.appendChild(toastContainer);
    }
    const el = document.createElement('div');
    el.style.background = 'var(--surface, #162233)';
    el.style.border = '1px solid var(--border, #243549)';
    el.style.borderRadius = '10px';
    el.style.padding = '11px 16px';
    el.style.fontSize = '.84rem';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '10px';
    const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    const color = type === 'success' ? '#2ecc71' : '#e74c3c';
    el.innerHTML = `<i class="fas fa-${icon}" style="color:${color}"></i>${msg}`;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // API request
  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(path, opts);
      if (res.status === 401) { doLogout(); return null; }
      return res;
    } catch (err) { toast('Network error', 'error'); return null; }
  }

  function doLogout() {
    localStorage.removeItem(TOKEN_KEY);
    token = null;
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appShell').style.display = 'none';
  }

  function showApp(username) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';
    document.getElementById('adminName').textContent = username || 'Admin';
    loadSection('dashboard');
  }

  function loadSection(sec) {
    currentSection = sec;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === sec));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${sec}`).classList.add('active');
    const titles = { dashboard: 'Dashboard', orders: 'Orders', gallery: 'Cake Gallery', 'add-cake': 'Add Cake', customers: 'Customers', workers: 'Workers', admins: 'Admin Users', visitors: 'Visitor Analytics' };
    document.getElementById('pageTitle').textContent = titles[sec] || sec;
    
    if (sec === 'dashboard') { loadStats(); loadRecentOrders(); }
    else if (sec === 'orders') loadOrders();
    else if (sec === 'gallery') loadGallery();
    else if (sec === 'add-cake') { /* form ready */ }
    else if (sec === 'customers') loadCustomers();
    else if (sec === 'workers') loadWorkers();
    else if (sec === 'admins') loadAdmins();
    else if (sec === 'visitors') loadVisitorAnalytics();
  }

  // Dashboard Stats
  async function loadStats() {
    const res = await api('GET', '/admin-api/stats');
    if (!res?.ok) return;
    const d = await res.json();
    document.getElementById('st-total').textContent = d.totalOrders || 0;
    document.getElementById('st-pending').textContent = d.pending || 0;
    document.getElementById('st-preparing').textContent = d.preparing || 0;
    document.getElementById('st-ready').textContent = d.ready || 0;
    document.getElementById('st-delivered').textContent = d.delivered || 0;
    document.getElementById('st-revenue').textContent = `KSh ${Number(d.revenue || 0).toLocaleString()}`;
    document.getElementById('st-customers').textContent = d.totalCustomers || 0;
  }

  function statusBadge(s) {
    const cls = { pending: 'b-pending', confirmed: 'b-confirmed', preparing: 'b-preparing', ready: 'b-ready', delivered: 'b-delivered', cancelled: 'b-cancelled' };
    return `<span class="badge ${cls[s] || 'b-pending'}">${s}</span>`;
  }

  function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

  async function loadRecentOrders() {
    const res = await api('GET', '/admin-api/orders?limit=10');
    if (!res?.ok) return;
    const orders = await res.json();
    const tbody = document.getElementById('recentOrdersTbody');
    if (!orders?.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No orders yet</td></tr>'; return; }
    tbody.innerHTML = orders.map(o => `<tr><td><strong>#${o.id}</strong></td><td>${o.customerName}</td><td>KSh ${Number(o.total).toLocaleString()}</td><td>${statusBadge(o.status)}</td><td>${formatDate(o.createdAt)}</td><td><select class="status-select order-status-sel" data-id="${o.id}"><option value="pending" ${o.status==='pending'?'selected':''}>pending</option><option value="confirmed" ${o.status==='confirmed'?'selected':''}>confirmed</option><option value="preparing" ${o.status==='preparing'?'selected':''}>preparing</option><option value="ready" ${o.status==='ready'?'selected':''}>ready</option><option value="delivered" ${o.status==='delivered'?'selected':''}>delivered</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>cancelled</option></select></td></tr>`).join('');
    bindStatusSelects(tbody);
  }

  async function loadOrders() {
    const filter = document.getElementById('orderStatusFilter')?.value || '';
    const url = filter ? `/admin-api/orders?status=${filter}&limit=200` : '/admin-api/orders?limit=200';
    const res = await api('GET', url);
    if (!res?.ok) return;
    const orders = await res.json();
    const tbody = document.getElementById('ordersTbody');
    if (!orders?.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty">No orders found</td></tr>'; return; }
    tbody.innerHTML = orders.map(o => `<tr><td><strong>#${o.id}</strong></td><td>${o.customerName}<br><small>${o.email}</small>${o.phone?`<br><small>${o.phone}</small>`:''}</td><td style="max-width:180px">${(Array.isArray(o.items)?o.items:[]).map(i=>`${i.qty}× ${i.title||i.id}`).join(', ')}</td><td>KSh ${Number(o.total).toLocaleString()}</td><td>${o.deliveryDate?formatDate(o.deliveryDate):'Pickup'}</td><td>${statusBadge(o.status)}</td><td>${o.assignedTo||'—'}</td><td>${formatDate(o.createdAt)}</td><td><button class="btn btn-danger btn-sm del-order" data-id="${o.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    bindStatusSelects(tbody);
    document.querySelectorAll('.del-order').forEach(btn => btn.addEventListener('click', async () => { if(confirm('Delete order?')){ const r=await api('DELETE',`/admin-api/orders/${btn.dataset.id}`); if(r?.ok){ toast('Order deleted'); loadOrders(); } } }));
  }

  function bindStatusSelects(container) {
    container.querySelectorAll('.order-status-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        const r = await api('PUT', `/admin-api/orders/${sel.dataset.id}/status`, { status: sel.value });
        if(r?.ok) toast(`Order #${sel.dataset.id} → ${sel.value}`);
        else toast('Failed to update', 'error');
      });
    });
  }

  // ============ GALLERY MANAGEMENT ============
  let galleryItems = [];

  async function loadGallery() {
    const res = await api('GET', '/admin-api/gallery');
    if (!res?.ok) return;
    galleryItems = await res.json();
    renderGallery();
  }

  function renderGallery() {
    const filter = document.getElementById('galleryFilter')?.value || 'all';
    const filtered = filter === 'all' ? galleryItems : galleryItems.filter(item => item.category === filter);
    const container = document.getElementById('galleryGrid');
    if (!filtered.length) { container.innerHTML = '<div class="empty"><i class="fas fa-images"></i><p>No cakes found in this category</p></div>'; return; }
    
    container.innerHTML = filtered.map(item => `
      <div class="cake-card" style="background:var(--surface);border-radius:14px;overflow:hidden;border:1px solid var(--border);transition:all 0.3s">
        <div style="height:200px;overflow:hidden">
          <img src="${item.imageUrl}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
        </div>
        <div style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <h4 style="font-size:1rem;color:var(--text)">${escapeHtml(item.title)}</h4>
            <span class="category-tag cat-${item.category || 'other'}">${item.category || 'other'}</span>
          </div>
          <p style="font-size:12px;color:var(--muted);margin-bottom:12px">${escapeHtml(item.description || 'No description')}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-size:1.2rem;font-weight:700;color:var(--primary)">KSh ${Number(item.price || 0).toLocaleString()}</span>
            <span style="font-size:11px;color:var(--muted)"><i class="fas fa-calendar"></i> ${formatDate(item.createdAt)}</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-danger btn-sm delete-cake" data-id="${item.id}" style="flex:1"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      </div>
    `).join('');
    
    document.querySelectorAll('.delete-cake').forEach(btn => {
      btn.addEventListener('click', async () => {
        if(confirm('Delete this cake from gallery?')){
          const r = await api('DELETE', `/admin-api/gallery/${btn.dataset.id}`);
          if(r?.ok){ toast('Cake deleted'); loadGallery(); }
          else toast('Failed to delete', 'error');
        }
      });
    });
  }

  function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, function(m){ if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }

  // Image preview
  function setupImagePreview() {
    const fileInput = document.getElementById('cakeImageFile');
    const urlInput = document.getElementById('cakeImageUrl');
    const preview = document.getElementById('cakeImagePreview');
    
    fileInput.addEventListener('change', function(e) {
      if(e.target.files && e.target.files[0]){
        const reader = new FileReader();
        reader.onload = function(ev) { preview.src = ev.target.result; };
        reader.readAsDataURL(e.target.files[0]);
        urlInput.value = '';
      }
    });
    
    urlInput.addEventListener('input', function() {
      if(urlInput.value) preview.src = urlInput.value;
      else fileInput.value = '';
    });
  }

  // Save new cake
  async function saveCake() {
    const title = document.getElementById('cakeTitle').value.trim();
    const category = document.getElementById('cakeCategory').value;
    const price = parseFloat(document.getElementById('cakePrice').value) || 0;
    const description = document.getElementById('cakeDescription').value.trim();
    const features = document.getElementById('cakeFeatures').value.trim();
    const imageUrl = document.getElementById('cakeImageUrl').value.trim();
    const imageFile = document.getElementById('cakeImageFile').files[0];
    
    if(!title){ toast('Please enter a cake title', 'error'); return; }
    if(!imageUrl && !imageFile){ toast('Please provide an image URL or upload an image', 'error'); return; }
    
    let finalImageUrl = imageUrl;
    if(imageFile){
      toast('Uploading image...', 'info');
      const formData = new FormData();
      formData.append('image', imageFile);
      try {
        const uploadRes = await fetch('/admin-api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
        if(uploadRes.ok){ const data = await uploadRes.json(); finalImageUrl = data.url; }
        else throw new Error('Upload failed');
      } catch(err){ toast('Image upload failed', 'error'); return; }
    }
    
    const cakeData = { title, imageUrl: finalImageUrl, description: description || null, category, price };
    const res = await api('POST', '/admin-api/gallery', cakeData);
    if(res?.status === 201){
      toast('Cake added to gallery!', 'success');
      document.getElementById('cakeTitle').value = '';
      document.getElementById('cakeDescription').value = '';
      document.getElementById('cakeFeatures').value = '';
      document.getElementById('cakeImageUrl').value = '';
      document.getElementById('cakeImageFile').value = '';
      document.getElementById('cakeImagePreview').src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\' viewBox=\'0 0 80 80\'%3E%3Crect width=\'80\' height=\'80\' fill=\'%232d3748\'/%3E%3Ctext x=\'40\' y=\'45\' font-size=\'10\' text-anchor=\'middle\' fill=\'%237a95ae\'%3ENo Image%3C/text%3E%3C/svg%3E';
      document.getElementById('cakePrice').value = '0';
      document.getElementById('cakeCategory').value = 'wedding';
      loadGallery();
      document.querySelector('[data-section="gallery"]').click();
    } else { const err = await res?.json(); toast(err?.error || 'Failed to add cake', 'error'); }
  }

  // Quick add cake
  async function quickAddCake() {
    const imageUrl = document.getElementById('bulkImageUrl').value.trim();
    const category = document.getElementById('bulkCategory').value;
    if(!imageUrl){ toast('Please enter an image URL', 'error'); return; }
    const title = prompt('Enter cake title:', 'New Cake');
    if(!title) return;
    const price = parseFloat(prompt('Enter price (KSh):', '0')) || 0;
    const cakeData = { title, imageUrl, description: null, category, price };
    const res = await api('POST', '/admin-api/gallery', cakeData);
    if(res?.status === 201){ toast('Cake added!', 'success'); document.getElementById('bulkImageUrl').value = ''; loadGallery(); }
    else toast('Failed to add', 'error');
  }

  // ============ CUSTOMERS ============
  async function loadCustomers() {
    const res = await api('GET', '/admin-api/customers');
    if(!res?.ok) return;
    const customers = await res.json();
    const tbody = document.getElementById('customersTbody');
    if(!customers?.length){ tbody.innerHTML = '<tr><td colspan="8" class="empty">No customers yet</td></tr>'; return; }
    tbody.innerHTML = customers.map(c => `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.email}</td><td>${c.phone||'—'}</td><td>${c.emailVerified?'<span class="badge b-delivered">✓ Yes</span>':'<span class="badge b-cancelled">No</span>'}</td><td>${c.isActive?'<span class="badge b-active">Active</span>':'<span class="badge b-inactive">Suspended</span>'}</td><td>${formatDate(c.createdAt)}</td><td><button class="btn btn-sm ${c.isActive?'btn-danger':'btn-success'} toggle-customer" data-id="${c.id}" data-active="${c.isActive}">${c.isActive?'Suspend':'Activate'}</button></td></tr>`).join('');
    document.querySelectorAll('.toggle-customer').forEach(btn => btn.addEventListener('click', async () => { const isActive = Number(btn.dataset.active)?0:1; const r=await api('PUT',`/admin-api/customers/${btn.dataset.id}/active`,{isActive}); if(r?.ok){ toast(isActive?'Customer activated':'Customer suspended'); loadCustomers(); } }));
  }

  // ============ WORKERS ============
  let editingWorker = null;
  async function loadWorkers() {
    const res = await api('GET', '/admin-api/workers');
    if(!res?.ok) return;
    const workers = await res.json();
    const tbody = document.getElementById('workersTbody');
    if(!workers?.length){ tbody.innerHTML = '<tr><td colspan="7" class="empty">No workers yet</td></tr>'; return; }
    tbody.innerHTML = workers.map(w => `<tr><td>${w.id}</td><td>${w.name}</td><td>${w.username}</td><td><span class="badge b-confirmed">${w.role || 'worker'}</span></td><td>${w.isActive?'<span class="badge b-active">Active</span>':'<span class="badge b-inactive">Inactive</span>'}</td><td>${formatDate(w.createdAt)}</td><td><button class="btn btn-ghost btn-sm edit-worker" data-id="${w.id}" data-name="${w.name}" data-username="${w.username}" data-role="${w.role||'worker'}"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm del-worker" data-id="${w.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    document.querySelectorAll('.edit-worker').forEach(btn => btn.addEventListener('click', () => { editingWorker=btn.dataset.id; document.getElementById('workerModalTitle').textContent='Edit Worker'; document.getElementById('wName').value=btn.dataset.name; document.getElementById('wUsername').value=btn.dataset.username; document.getElementById('wRole').value=btn.dataset.role; document.getElementById('wPassword').value=''; document.getElementById('wPassword').placeholder='Leave blank to keep current'; document.getElementById('workerModal').style.display='flex'; }));
    document.querySelectorAll('.del-worker').forEach(btn => btn.addEventListener('click', async () => { if(confirm('Delete this worker?')){ const r=await api('DELETE',`/admin-api/workers/${btn.dataset.id}`); if(r?.ok){ toast('Worker deleted'); loadWorkers(); } } }));
  }

  // ============ ADMINS ============
  async function loadAdmins() {
    const res = await api('GET', '/admin-api/admins');
    if(!res?.ok) return;
    const admins = await res.json();
    const tbody = document.getElementById('adminsTbody');
    tbody.innerHTML = admins.map(a => `<tr><td>${a.id}</td><td><strong>${a.username}</strong></td><td>${formatDate(a.createdAt)}</td><td><button class="btn btn-ghost btn-sm chg-pw" data-id="${a.id}" data-user="${a.username}"><i class="fas fa-key"></i> Change PW</button><button class="btn btn-danger btn-sm del-admin" data-id="${a.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    document.querySelectorAll('.chg-pw').forEach(btn => btn.addEventListener('click', async () => { const pw=prompt(`New password for ${btn.dataset.user}:`); if(pw && pw.length>=8){ const r=await api('PUT',`/admin-api/admins/${btn.dataset.id}/password`,{password:pw}); if(r?.ok) toast('Password changed'); } else if(pw) toast('Password too short (min 8)','warn'); }));
    document.querySelectorAll('.del-admin').forEach(btn => btn.addEventListener('click', async () => { if(confirm('Delete this admin?')){ const r=await api('DELETE',`/admin-api/admins/${btn.dataset.id}`); if(r?.ok){ toast('Admin deleted'); loadAdmins(); } } }));
  }

  // ============ VISITOR ANALYTICS ============
  async function loadVisitorAnalytics() {
    const days = document.getElementById('visitorDaysFilter')?.value || 30;
    const res = await api('GET', `/admin-api/visitors/stats?days=${days}`);
    if(!res?.ok) return;
    const stats = await res.json();
    document.getElementById('rt-active').textContent = stats.realtime?.active_visitors || 0;
    document.getElementById('total-visitors').textContent = stats.total_visitors || 0;
    document.getElementById('total-visits').textContent = stats.total_visits || 0;
    if(visitorsChart) visitorsChart.destroy();
    const data = (stats.visitors_by_day || []).reverse();
    const ctx = document.getElementById('visitorsChart').getContext('2d');
    visitorsChart = new Chart(ctx, { type:'line', data:{ labels:data.map(d=>d.date), datasets:[{ label:'Visits', data:data.map(d=>d.count), borderColor:'#C17B4B', backgroundColor:'rgba(193,123,75,0.1)', fill:true, tension:0.4 }] }, options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{ labels:{ color:'#dde6f0' } } }, scales:{ y:{ ticks:{ color:'#7a95ae' }, grid:{ color:'#243549' } }, x:{ ticks:{ color:'#7a95ae' }, grid:{ color:'#243549' } } } } });
  }

  // ============ EVENT LISTENERS ============
  function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => loadSection(n.dataset.section)));
    document.getElementById('refreshBtn').addEventListener('click', () => loadSection(currentSection));
    document.getElementById('logoutBtn').addEventListener('click', doLogout);
    document.getElementById('orderStatusFilter')?.addEventListener('change', loadOrders);
    document.getElementById('galleryFilter')?.addEventListener('change', renderGallery);
    document.getElementById('saveCakeBtn')?.addEventListener('click', saveCake);
    document.getElementById('clearCakeFormBtn')?.addEventListener('click', () => { document.getElementById('cakeTitle').value=''; document.getElementById('cakeDescription').value=''; document.getElementById('cakeFeatures').value=''; document.getElementById('cakeImageUrl').value=''; document.getElementById('cakeImageFile').value=''; document.getElementById('cakePrice').value='0'; document.getElementById('cakeCategory').value='wedding'; document.getElementById('cakeImagePreview').src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\' viewBox=\'0 0 80 80\'%3E%3Crect width=\'80\' height=\'80\' fill=\'%232d3748\'/%3E%3Ctext x=\'40\' y=\'45\' font-size=\'10\' text-anchor=\'middle\' fill=\'%237a95ae\'%3ENo Image%3C/text%3E%3C/svg%3E'; toast('Form cleared'); });
    document.getElementById('quickAddBtn')?.addEventListener('click', quickAddCake);
    document.getElementById('addWorkerBtn')?.addEventListener('click', () => { editingWorker=null; document.getElementById('workerModalTitle').textContent='Add Worker'; document.getElementById('wName').value=''; document.getElementById('wUsername').value=''; document.getElementById('wRole').value='baker'; document.getElementById('wPassword').value=''; document.getElementById('workerModal').style.display='flex'; });
    document.getElementById('workerModalCancel')?.addEventListener('click', () => document.getElementById('workerModal').style.display='none');
    document.getElementById('workerModalSave')?.addEventListener('click', async () => { const name=document.getElementById('wName').value.trim(); const username=document.getElementById('wUsername').value.trim(); const role=document.getElementById('wRole').value; const password=document.getElementById('wPassword').value; if(!name||!username){ toast('Name and username required','warn'); return; } let r; if(editingWorker){ const body={name}; if(password) body.password=password; if(role) body.role=role; r=await api('PUT',`/admin-api/workers/${editingWorker}`,body); } else { if(!password||password.length<8){ toast('Password required (min 8 chars)','warn'); return; } r=await api('POST','/admin-api/workers',{name,username,password,role}); } if(r?.ok||r?.status===201){ toast(editingWorker?'Worker updated':'Worker created'); document.getElementById('workerModal').style.display='none'; loadWorkers(); } else { const d=await r?.json(); toast(d?.error||'Failed','error'); } });
    document.getElementById('addAdminBtn')?.addEventListener('click', () => document.getElementById('adminModal').style.display='flex');
    document.getElementById('adminModalCancel')?.addEventListener('click', () => document.getElementById('adminModal').style.display='none');
    document.getElementById('adminModalSave')?.addEventListener('click', async () => { const username=document.getElementById('aUsername').value.trim(); const password=document.getElementById('aPassword').value; if(!username||!password){ toast('Username and password required','warn'); return; } if(password.length<8){ toast('Password too short (min 8)','warn'); return; } const r=await api('POST','/admin-api/admins',{username,password}); if(r?.status===201){ toast('Admin created'); document.getElementById('adminModal').style.display='none'; document.getElementById('aUsername').value=''; document.getElementById('aPassword').value=''; loadAdmins(); } else toast('Failed to create admin','error'); });
    document.getElementById('visitorDaysFilter')?.addEventListener('change', loadVisitorAnalytics);
    document.getElementById('refreshVisitorsBtn')?.addEventListener('change', loadVisitorAnalytics);
    setupImagePreview();
  }

  // ============ LOGIN ============
  async function doLogin() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    if(!username||!password){ document.getElementById('loginErr').textContent='Enter credentials'; return; }
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';
    try {
      const res = await fetch('/auth/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,password}) });
      const data = await res.json();
      if(res.ok){ token=data.token; localStorage.setItem(TOKEN_KEY,token); showApp(username); }
      else document.getElementById('loginErr').textContent = data.error || 'Invalid credentials';
    } catch(err){ document.getElementById('loginErr').textContent = 'Network error'; }
    finally { btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Sign In'; }
  }

  document.getElementById('loginBtn')?.addEventListener('click', doLogin);
  document.getElementById('loginPass')?.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  
  if(token){
    try { const payload = JSON.parse(atob(token.split('.')[1])); if(payload.exp && payload.exp*1000 > Date.now()) showApp(payload.username||'Admin'); else doLogout(); } 
    catch(e){ doLogout(); }
  }
  
  setupEventListeners();
})();
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    if (body) opts.body = JSON.stringify(body);
    
    try {
      const res = await fetch(path, opts);
      if (res.status === 401) {
        doLogout();
        return null;
      }
      return res;
    } catch (err) {
      console.error('API error:', err);
      toast('Network error. Please check your connection.', 'error');
      return null;
    }
  }

  // Logout function
  function doLogout() {
    localStorage.removeItem(TOKEN_KEY);
    token = null;
    const loginScreen = document.getElementById('loginScreen');
    const appShell = document.getElementById('appShell');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appShell) appShell.style.display = 'none';
    const loginErr = document.getElementById('loginErr');
    if (loginErr) loginErr.textContent = '';
  }

  // Show main app after login
  function showApp(username) {
    const loginScreen = document.getElementById('loginScreen');
    const appShell = document.getElementById('appShell');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appShell) appShell.style.display = 'block';
    const adminName = document.getElementById('adminName');
    if (adminName) adminName.textContent = username || 'Admin';
    loadSection('dashboard');
  }

  // Load a specific section
  function loadSection(sec) {
    currentSection = sec;
    
    // Update active nav item
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => {
      n.classList.toggle('active', n.dataset.section === sec);
    });
    
    // Show active section
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById(`sec-${sec}`);
    if (targetSection) targetSection.classList.add('active');
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    const titles = {
      dashboard: 'Dashboard',
      orders: 'Orders',
      gallery: 'Gallery',
      customers: 'Customers',
      workers: 'Workers',
      admins: 'Admin Users',
      visitors: 'Visitor Analytics'
    };
    if (pageTitle) pageTitle.textContent = titles[sec] || sec;
    
    // Load section data
    if (sec === 'dashboard') {
      loadStats();
      loadRecentOrders();
    } else if (sec === 'orders') {
      loadOrders();
    } else if (sec === 'gallery') {
      loadGallery();
    } else if (sec === 'customers') {
      loadCustomers();
    } else if (sec === 'workers') {
      loadWorkers();
    } else if (sec === 'admins') {
      loadAdmins();
    } else if (sec === 'visitors') {
      loadVisitorAnalytics();
    }
  }

  // Load dashboard stats
  async function loadStats() {
    const res = await api('GET', '/admin-api/stats');
    if (!res?.ok) return;
    const d = await res.json();
    
    const statElements = {
      total: document.getElementById('st-total'),
      pending: document.getElementById('st-pending'),
      preparing: document.getElementById('st-preparing'),
      ready: document.getElementById('st-ready'),
      delivered: document.getElementById('st-delivered'),
      revenue: document.getElementById('st-revenue'),
      customers: document.getElementById('st-customers')
    };
    
    if (statElements.total) statElements.total.textContent = d.totalOrders || 0;
    if (statElements.pending) statElements.pending.textContent = d.pending || 0;
    if (statElements.preparing) statElements.preparing.textContent = d.preparing || 0;
    if (statElements.ready) statElements.ready.textContent = d.ready || 0;
    if (statElements.delivered) statElements.delivered.textContent = d.delivered || 0;
    if (statElements.revenue) statElements.revenue.textContent = `KSh ${Number(d.revenue || 0).toLocaleString()}`;
    if (statElements.customers) statElements.customers.textContent = d.totalCustomers || 0;
  }

  // Status badge helper
  function statusBadge(s) {
    const cls = {
      pending: 'b-pending',
      confirmed: 'b-confirmed',
      preparing: 'b-preparing',
      ready: 'b-ready',
      delivered: 'b-delivered',
      cancelled: 'b-cancelled'
    };
    return `<span class="badge ${cls[s] || 'b-pending'}">${s}</span>`;
  }

  // Format date helper
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Load recent orders for dashboard
  async function loadRecentOrders() {
    const res = await api('GET', '/admin-api/orders?limit=10');
    if (!res?.ok) return;
    const orders = await res.json();
    const tbody = document.getElementById('recentOrdersTbody');
    if (!tbody) return;
    
    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No orders yet</td></tr>';
      return;
    }
    
    tbody.innerHTML = orders.slice(0, 10).map(o => `
      <tr>
        <td><strong>#${o.id}</strong></td>
        <td>${o.customerName}</td>
        <td>KSh ${Number(o.total).toLocaleString()}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${formatDate(o.createdAt)}</td>
        <td>
          <select class="status-select order-status-sel" data-id="${o.id}">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>pending</option>
            <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>confirmed</option>
            <option value="preparing" ${o.status === 'preparing' ? 'selected' : ''}>preparing</option>
            <option value="ready" ${o.status === 'ready' ? 'selected' : ''}>ready</option>
            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>delivered</option>
            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>cancelled</option>
          </select>
        </td>
      </tr>
    `).join('');
    
    bindStatusSelects(tbody);
  }

  // Load all orders
  async function loadOrders() {
    const filter = document.getElementById('orderStatusFilter');
    const filterValue = filter ? filter.value : '';
    const url = filterValue ? `/admin-api/orders?status=${filterValue}&limit=200` : '/admin-api/orders?limit=200';
    const res = await api('GET', url);
    if (!res?.ok) return;
    const orders = await res.json();
    const tbody = document.getElementById('ordersTbody');
    if (!tbody) return;
    
    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">No orders found</td></tr>';
      return;
    }
    
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>#${o.id}</strong></td>
        <td>
          ${o.customerName}<br><small>${o.email}</small>
          ${o.phone ? `<br><small>${o.phone}</small>` : ''}
        </td>
        <td style="max-width:180px">${(Array.isArray(o.items) ? o.items : []).map(i => `${i.qty}× ${i.title || i.id}`).join(', ')}</td>
        <td>KSh ${Number(o.total).toLocaleString()}</td>
        <td>${o.deliveryDate ? formatDate(o.deliveryDate) : 'Pickup'}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${o.assignedTo || '—'}</td>
        <td>${formatDate(o.createdAt)}</td>
        <td><button class="btn btn-danger btn-sm del-order" data-id="${o.id}"><i class="fas fa-trash"></i></button></td>
      </tr>
    `).join('');
    
    bindStatusSelects(tbody);
    
    document.querySelectorAll('.del-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Delete order #${btn.dataset.id}? This action cannot be undone.`)) return;
        const r = await api('DELETE', `/admin-api/orders/${btn.dataset.id}`);
        if (r?.ok) {
          toast('Order deleted successfully');
          loadOrders();
        } else {
          toast('Failed to delete order', 'error');
        }
      });
    });
  }

  // Bind status change handlers
  function bindStatusSelects(container) {
    container.querySelectorAll('.order-status-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.id;
        const status = sel.value;
        const r = await api('PUT', `/admin-api/orders/${id}/status`, { status });
        if (r?.ok) {
          toast(`Order #${id} status updated to ${status}`);
          loadSection(currentSection);
        } else {
          toast('Failed to update status', 'error');
        }
      });
    });
  }

  // Load gallery items
  async function loadGallery() {
    const res = await api('GET', '/admin-api/gallery');
    if (!res?.ok) return;
    const items = await res.json();
    const tbody = document.getElementById('galleryTbody');
    if (!tbody) return;
    
    if (!items || items.length === 0) {
      tbody.innerHTML = '年轻时<td colspan="6" class="empty">No gallery items</td></tr>';
      return;
    }
    
    tbody.innerHTML = items.map(it => `
      <tr>
        <td><img src="${it.imageUrl}" style="width:50px;height:40px;object-fit:cover;border-radius:6px" onerror="this.src='https://via.placeholder.com/50x40?text=No+Image'"></td>
        <td><strong>${it.title}</strong>${it.description ? `<br><small>${it.description.slice(0, 60)}</small>` : ''}</td>
        <td><span class="badge b-confirmed">${it.category || 'other'}</span></td>
        <td>KSh ${Number(it.price || 0).toLocaleString()}</td>
        <td>${formatDate(it.createdAt)}</td>
        <td><button class="btn btn-danger btn-sm del-gallery" data-id="${it.id}"><i class="fas fa-trash"></i></button></td>
      </tr>
    `).join('');
    
    document.querySelectorAll('.del-gallery').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this gallery item?')) return;
        const r = await api('DELETE', `/admin-api/gallery/${btn.dataset.id}`);
        if (r?.ok) {
          toast('Gallery item deleted');
          loadGallery();
        } else {
          toast('Failed to delete item', 'error');
        }
      });
    });
  }

  // Load customers
  async function loadCustomers() {
    const res = await api('GET', '/admin-api/customers');
    if (!res?.ok) return;
    const customers = await res.json();
    const tbody = document.getElementById('customersTbody');
    if (!tbody) return;
    
    if (!customers || customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No customers yet</td></tr>';
      return;
    }
    
    tbody.innerHTML = customers.map(c => `
      <tr>
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>${c.email}</td>
        <td>${c.phone || '—'}</td>
        <td>${c.emailVerified ? '<span class="badge b-delivered">✓ Yes</span>' : '<span class="badge b-cancelled">No</span>'}</td>
        <td>${c.isActive ? '<span class="badge b-active">Active</span>' : '<span class="badge b-inactive">Suspended</span>'}</td>
        <td>${formatDate(c.createdAt)}</td>
        <td><button class="btn btn-sm ${c.isActive ? 'btn-danger' : 'btn-success'} toggle-customer" data-id="${c.id}" data-active="${c.isActive}">${c.isActive ? 'Suspend' : 'Activate'}</button></td>
      </tr>
    `).join('');
    
    document.querySelectorAll('.toggle-customer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isActive = Number(btn.dataset.active) ? 0 : 1;
        const r = await api('PUT', `/admin-api/customers/${btn.dataset.id}/active`, { isActive });
        if (r?.ok) {
          toast(isActive ? 'Customer activated' : 'Customer suspended');
          loadCustomers();
        } else {
          toast('Failed to update customer', 'error');
        }
      });
    });
  }

  // Worker management
  let editingWorker = null;

  async function loadWorkers() {
    const res = await api('GET', '/admin-api/workers');
    if (!res?.ok) return;
    const workers = await res.json();
    const tbody = document.getElementById('workersTbody');
    if (!tbody) return;
    
    if (!workers || workers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No workers yet</td></tr>';
      return;
    }
    
    tbody.innerHTML = workers.map(w => `
      <tr>
        <td>${w.id}</td>
        <td>${w.name}</td>
        <td>${w.username}</td>
        <td>${w.isActive ? '<span class="badge b-active">Active</span>' : '<span class="badge b-inactive">Inactive</span>'}</td>
        <td>${formatDate(w.createdAt)}</td>
        <td>
          <button class="btn btn-ghost btn-sm edit-worker" data-id="${w.id}" data-name="${w.name}" data-username="${w.username}"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm del-worker" data-id="${w.id}"><i class="fas fa-trash"></i></button>
         </td>
       </tr>
    `).join('');
    
    document.querySelectorAll('.edit-worker').forEach(btn => {
      btn.addEventListener('click', () => {
        editingWorker = btn.dataset.id;
        const modalTitle = document.getElementById('workerModalTitle');
        const wName = document.getElementById('wName');
        const wUsername = document.getElementById('wUsername');
        const wPassword = document.getElementById('wPassword');
        if (modalTitle) modalTitle.textContent = 'Edit Worker';
        if (wName) wName.value = btn.dataset.name;
        if (wUsername) wUsername.value = btn.dataset.username;
        if (wPassword) {
          wPassword.value = '';
          wPassword.placeholder = 'Leave blank to keep current';
        }
        const workerModal = document.getElementById('workerModal');
        if (workerModal) workerModal.style.display = 'flex';
      });
    });
    
    document.querySelectorAll('.del-worker').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this worker?')) return;
        const r = await api('DELETE', `/admin-api/workers/${btn.dataset.id}`);
        if (r?.ok) {
          toast('Worker deleted');
          loadWorkers();
        } else {
          toast('Failed to delete worker', 'error');
        }
      });
    });
  }

  // Load admins
  async function loadAdmins() {
    const res = await api('GET', '/admin-api/admins');
    if (!res?.ok) return;
    const admins = await res.json();
    const tbody = document.getElementById('adminsTbody');
    if (!tbody) return;
    
    tbody.innerHTML = admins.map(a => `
      <tr>
        <td>${a.id}</td>
        <td><strong>${a.username}</strong></td>
        <td>${formatDate(a.createdAt)}</td>
        <td>
          <button class="btn btn-ghost btn-sm chg-pw" data-id="${a.id}" data-user="${a.username}"><i class="fas fa-key"></i> Change PW</button>
          <button class="btn btn-danger btn-sm del-admin" data-id="${a.id}"><i class="fas fa-trash"></i></button>
         </td>
       </tr>
    `).join('');
    
    document.querySelectorAll('.chg-pw').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pw = prompt(`New password for ${btn.dataset.user}:`);
        if (!pw) return;
        if (pw.length < 8) {
          toast('Password must be at least 8 characters', 'warn');
          return;
        }
        const r = await api('PUT', `/admin-api/admins/${btn.dataset.id}/password`, { password: pw });
        if (r?.ok) {
          toast('Password changed successfully');
        } else {
          toast('Failed to change password', 'error');
        }
      });
    });
    
    document.querySelectorAll('.del-admin').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this admin?')) return;
        const r = await api('DELETE', `/admin-api/admins/${btn.dataset.id}`);
        if (r?.ok) {
          toast('Admin deleted');
          loadAdmins();
        } else {
          const d = await r?.json().catch(() => ({}));
          toast(d.error || 'Failed to delete admin', 'error');
        }
      });
    });
  }

  // ============ Visitor Analytics Functions ============
  
  // Load visitor analytics
  async function loadVisitorAnalytics() {
    const days = document.getElementById('visitorDaysFilter')?.value || 30;
    
    try {
      const statsRes = await api('GET', `/admin-api/visitors/stats?days=${days}`);
      if (!statsRes?.ok) return;
      const stats = await statsRes.json();
      
      // Update real-time stats
      const rtActive = document.getElementById('rt-active');
      const rtSessions = document.getElementById('rt-sessions');
      const totalVisitors = document.getElementById('total-visitors');
      const totalVisits = document.getElementById('total-visits');
      
      if (rtActive) rtActive.textContent = stats.realtime?.active_visitors || 0;
      if (rtSessions) rtSessions.textContent = stats.realtime?.active_sessions || 0;
      if (totalVisitors) totalVisitors.textContent = stats.total_visitors || 0;
      if (totalVisits) totalVisits.textContent = stats.total_visits || 0;
      
      // Update daily visitors chart
      updateVisitorsChart(stats.visitors_by_day);
      
      // Update top pages table
      updateTopPages(stats.top_pages);
      
      // Update browsers chart
      updateBrowsersChart(stats.browsers);
      
      // Update devices chart
      updateDevicesChart(stats.browsers);
      
      // Update hourly chart
      updateHourlyChart(stats.hourly_distribution);
      
      // Update referrers table
      updateReferrers(stats.top_referrers);
      
      // Update recent visitors table
      updateRecentVisitors(stats.recent_visitors);
      
    } catch (err) {
      console.error('Error loading visitor analytics:', err);
      toast('Failed to load visitor analytics', 'error');
    }
  }

  // Update daily visitors chart
  function updateVisitorsChart(data) {
    const canvas = document.getElementById('visitorsChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const reversed = [...data].reverse();
    const labels = reversed.map(d => d.date);
    const counts = reversed.map(d => d.count);
    const uniqueCounts = reversed.map(d => d.unique_visitors);
    
    if (visitorsChart) visitorsChart.destroy();
    
    visitorsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Visits',
            data: counts,
            borderColor: '#C17B4B',
            backgroundColor: 'rgba(193,123,75,0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Unique Visitors',
            data: uniqueCounts,
            borderColor: '#D4AF37',
            backgroundColor: 'rgba(212,175,55,0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: { color: '#dde6f0' }
          }
        },
        scales: {
          y: {
            ticks: { color: '#7a95ae' },
            grid: { color: '#243549' }
          },
          x: {
            ticks: { color: '#7a95ae', maxRotation: 45, minRotation: 45 },
            grid: { color: '#243549' }
          }
        }
      }
    });
  }

  // Update browsers chart
  function updateBrowsersChart(browsers) {
    const canvas = document.getElementById('browsersChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const labels = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'IE', 'Other'];
    const data = labels.map(l => browsers[l] || 0);
    const filteredLabels = labels.filter((_, i) => data[i] > 0);
    const filteredData = data.filter(v => v > 0);
    
    if (filteredData.length === 0) {
      if (browsersChart) browsersChart.destroy();
      return;
    }
    
    if (browsersChart) browsersChart.destroy();
    
    browsersChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: filteredLabels,
        datasets: [{
          data: filteredData,
          backgroundColor: ['#C17B4B', '#D4AF37', '#8B4513', '#2C1810', '#E91E63', '#3498db', '#95a5a6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: { color: '#dde6f0' }
          }
        }
      }
    });
  }

  // Update devices chart
  function updateDevicesChart(browsers) {
    const canvas = document.getElementById('devicesChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const data = [
      browsers.Desktop || 0,
      browsers.Mobile || 0,
      browsers.Tablet || 0
    ];
    
    if (devicesChart) devicesChart.destroy();
    
    devicesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Desktop', 'Mobile', 'Tablet'],
        datasets: [{
          data: data,
          backgroundColor: ['#C17B4B', '#D4AF37', '#8B4513']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: { color: '#dde6f0' }
          }
        }
      }
    });
  }

  // Update hourly chart
  function updateHourlyChart(hourlyData) {
    const canvas = document.getElementById('hourlyChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
    const counts = Array(24).fill(0);
    
    hourlyData.forEach(h => {
      counts[parseInt(h.hour)] = h.count;
    });
    
    if (hourlyChart) hourlyChart.destroy();
    
    hourlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: hours,
        datasets: [{
          label: 'Visits',
          data: counts,
          backgroundColor: '#C17B4B',
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: { color: '#dde6f0' }
          }
        },
        scales: {
          y: {
            ticks: { color: '#7a95ae' },
            grid: { color: '#243549' }
          },
          x: {
            ticks: { color: '#7a95ae', maxRotation: 45, minRotation: 45 },
            grid: { color: '#243549' }
          }
        }
      }
    });
  }

  // Update top pages table
  function updateTopPages(pages) {
    const tbody = document.getElementById('topPagesTbody');
    if (!tbody) return;
    
    if (!pages || pages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty">No data available</td></tr>';
      return;
    }
    
    tbody.innerHTML = pages.map(p => `
      <tr>
        <td>${p.page || '/'}</td>
        <td style="text-align:right">${p.views} views</td>
      </tr>
    `).join('');
  }

  // Update referrers table
  function updateReferrers(referrers) {
    const tbody = document.getElementById('referrersTbody');
    if (!tbody) return;
    
    if (!referrers || referrers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty">No referrer data available</td></tr>';
      return;
    }
    
    tbody.innerHTML = referrers.map(r => `
      <tr>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${r.referer}</td>
        <td style="text-align:right">${r.count} visits</td>
      </tr>
    `).join('');
  }

  // Update recent visitors table
  function updateRecentVisitors(visitors) {
    const tbody = document.getElementById('recentVisitorsTbody');
    if (!tbody) return;
    
    if (!visitors || visitors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No recent visitors</td></tr>';
      return;
    }
    
    tbody.innerHTML = visitors.map(v => {
      const time = new Date(v.visited_at).toLocaleString();
      const browser = getBrowserFromUA(v.user_agent);
      return `
        <tr>
          <td>${v.ip}</td>
          <td>${v.page || '/'}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${v.referer || 'Direct'}</td>
          <td>${browser}</td>
          <td>${time}</td>
        </tr>
      `;
    }).join('');
  }

  // Helper: Get browser from user agent
  function getBrowserFromUA(ua) {
    if (!ua) return 'Unknown';
    const u = ua.toLowerCase();
    if (u.includes('chrome') && !u.includes('edg')) return 'Chrome';
    if (u.includes('firefox')) return 'Firefox';
    if (u.includes('safari') && !u.includes('chrome')) return 'Safari';
    if (u.includes('edg')) return 'Edge';
    if (u.includes('opera') || u.includes('opr')) return 'Opera';
    return 'Other';
  }

  // ============ Event Listeners Setup ============
  
  function setupEventListeners() {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => {
      n.addEventListener('click', () => loadSection(n.dataset.section));
    });
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const icon = document.getElementById('refreshIcon');
        if (icon) icon.classList.add('spin');
        setTimeout(() => {
          if (icon) icon.classList.remove('spin');
        }, 700);
        loadSection(currentSection);
      });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    
    // Order status filter
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    if (orderStatusFilter) orderStatusFilter.addEventListener('change', loadOrders);
    
    // Add gallery item
    const addGalleryBtn = document.getElementById('addGalleryBtn');
    if (addGalleryBtn) {
      addGalleryBtn.addEventListener('click', async () => {
        const title = document.getElementById('gTitle');
        const imageUrl = document.getElementById('gImage');
        const category = document.getElementById('gCategory');
        const price = document.getElementById('gPrice');
        const desc = document.getElementById('gDesc');
        
        if (!title || !imageUrl || !title.value.trim() || !imageUrl.value.trim()) {
          toast('Title and Image URL are required', 'warn');
          return;
        }
        
        const r = await api('POST', '/admin-api/gallery', {
          title: title.value.trim(),
          imageUrl: imageUrl.value.trim(),
          category: category ? category.value : 'other',
          price: Number(price ? price.value : 0) || 0,
          description: desc ? desc.value.trim() : null
        });
        
        if (r?.status === 201) {
          toast('Gallery item added successfully');
          if (title) title.value = '';
          if (imageUrl) imageUrl.value = '';
          if (desc) desc.value = '';
          if (price) price.value = '0';
          loadGallery();
        } else {
          const d = await r?.json().catch(() => ({}));
          toast(d.error || 'Failed to add gallery item', 'error');
        }
      });
    }
    
    // Add worker button
    const addWorkerBtn = document.getElementById('addWorkerBtn');
    if (addWorkerBtn) {
      addWorkerBtn.addEventListener('click', () => {
        editingWorker = null;
        const modalTitle = document.getElementById('workerModalTitle');
        const wName = document.getElementById('wName');
        const wUsername = document.getElementById('wUsername');
        const wPassword = document.getElementById('wPassword');
        if (modalTitle) modalTitle.textContent = 'Add Worker';
        if (wName) wName.value = '';
        if (wUsername) wUsername.value = '';
        if (wPassword) {
          wPassword.value = '';
          wPassword.placeholder = 'Min 8 chars';
        }
        const workerModal = document.getElementById('workerModal');
        if (workerModal) workerModal.style.display = 'flex';
      });
    }
    
    // Worker modal cancel
    const workerModalCancel = document.getElementById('workerModalCancel');
    if (workerModalCancel) {
      workerModalCancel.addEventListener('click', () => {
        const workerModal = document.getElementById('workerModal');
        if (workerModal) workerModal.style.display = 'none';
      });
    }
    
    // Worker modal save
    const workerModalSave = document.getElementById('workerModalSave');
    if (workerModalSave) {
      workerModalSave.addEventListener('click', async () => {
        const wName = document.getElementById('wName');
        const wUsername = document.getElementById('wUsername');
        const wPassword = document.getElementById('wPassword');
        
        if (!wName || !wUsername) return;
        const name = wName.value.trim();
        const username = wUsername.value.trim();
        const password = wPassword ? wPassword.value : '';
        
        if (!name || !username) {
          toast('Name and username are required', 'warn');
          return;
        }
        if (!editingWorker && !password) {
          toast('Password is required for new worker', 'warn');
          return;
        }
        
        let r;
        if (editingWorker) {
          const body = { name };
          if (password) body.password = password;
          r = await api('PUT', `/admin-api/workers/${editingWorker}`, body);
        } else {
          if (password.length < 8) {
            toast('Password must be at least 8 characters', 'warn');
            return;
          }
          r = await api('POST', '/admin-api/workers', { name, username, password });
        }
        
        if (r?.ok || r?.status === 201) {
          toast(editingWorker ? 'Worker updated' : 'Worker created');
          const workerModal = document.getElementById('workerModal');
          if (workerModal) workerModal.style.display = 'none';
          loadWorkers();
        } else {
          const d = await r?.json().catch(() => ({}));
          toast(d.error || 'Operation failed', 'error');
        }
      });
    }
    
    // Add admin button
    const addAdminBtn = document.getElementById('addAdminBtn');
    if (addAdminBtn) {
      addAdminBtn.addEventListener('click', () => {
        const adminModal = document.getElementById('adminModal');
        if (adminModal) adminModal.style.display = 'flex';
      });
    }
    
    // Admin modal cancel
    const adminModalCancel = document.getElementById('adminModalCancel');
    if (adminModalCancel) {
      adminModalCancel.addEventListener('click', () => {
        const adminModal = document.getElementById('adminModal');
        if (adminModal) adminModal.style.display = 'none';
      });
    }
    
    // Admin modal save
    const adminModalSave = document.getElementById('adminModalSave');
    if (adminModalSave) {
      adminModalSave.addEventListener('click', async () => {
        const aUsername = document.getElementById('aUsername');
        const aPassword = document.getElementById('aPassword');
        
        if (!aUsername || !aPassword) return;
        const username = aUsername.value.trim();
        const password = aPassword.value;
        
        if (!username || !password) {
          toast('Username and password are required', 'warn');
          return;
        }
        if (password.length < 8) {
          toast('Password must be at least 8 characters', 'warn');
          return;
        }
        
        const r = await api('POST', '/admin-api/admins', { username, password });
        if (r?.status === 201) {
          toast('Admin created successfully');
          const adminModal = document.getElementById('adminModal');
          if (adminModal) adminModal.style.display = 'none';
          if (aUsername) aUsername.value = '';
          if (aPassword) aPassword.value = '';
          loadAdmins();
        } else {
          const d = await r?.json().catch(() => ({}));
          toast(d.error || 'Failed to create admin', 'error');
        }
      });
    }
    
    // Visitor days filter
    const visitorDaysFilter = document.getElementById('visitorDaysFilter');
    if (visitorDaysFilter) {
      visitorDaysFilter.addEventListener('change', loadVisitorAnalytics);
    }
    
    // Refresh visitors button
    const refreshVisitorsBtn = document.getElementById('refreshVisitorsBtn');
    if (refreshVisitorsBtn) {
      refreshVisitorsBtn.addEventListener('click', loadVisitorAnalytics);
    }
  }

  // Login function
  async function doLogin() {
    const username = document.getElementById('loginUser');
    const password = document.getElementById('loginPass');
    const loginErr = document.getElementById('loginErr');
    
    if (!username || !password) return;
    const user = username.value.trim();
    const pass = password.value;
    
    if (!user || !pass) {
      if (loginErr) loginErr.textContent = 'Please enter both username and password';
      return;
    }
    
    const btn = document.getElementById('loginBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';
    }
    
    try {
      const res = await fetch('/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await res.json();
      if (res.ok) {
        token = data.token;
        localStorage.setItem(TOKEN_KEY, token);
        showApp(user);
      } else {
        if (loginErr) loginErr.textContent = data.error || 'Invalid credentials';
      }
    } catch (err) {
      if (loginErr) loginErr.textContent = 'Network error. Is the server running?';
      console.error('Login error:', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
      }
    }
  }

  // Check for existing token on page load
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        showApp(payload.username || 'Admin');
      } else {
        doLogout();
      }
    } catch {
      doLogout();
    }
  }
  
  // Bind login button
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', doLogin);
  
  const loginPass = document.getElementById('loginPass');
  if (loginPass) {
    loginPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
  }
  
  // Initialize event listeners
  setupEventListeners();
})();