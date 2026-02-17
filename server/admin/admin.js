function authHeader() {
  const token = localStorage.getItem('west-admin-token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

async function login() {
  const u = document.getElementById('user').value;
  const p = document.getElementById('pass').value;
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  });
  if (res.ok) {
    const data = await res.json();
    localStorage.setItem('west-admin-token', data.token);
    document.getElementById('login').style.display = 'none';
    document.getElementById('panel').style.display = 'block';
    loadGallery();
    loadOrders();
  } else {
    document.getElementById('loginError').innerText = 'Login failed';
  }
}

document.getElementById('btnLogin').addEventListener('click', login);

function logout() {
  localStorage.removeItem('west-admin-token');
  document.getElementById('login').style.display = 'block';
  document.getElementById('panel').style.display = 'none';
}

// add logout button
const logoutBtn = document.createElement('button');
logoutBtn.textContent = 'Logout';
logoutBtn.style.marginLeft = '10px';
logoutBtn.addEventListener('click', logout);
document.getElementById('login').appendChild(logoutBtn);

document.getElementById('addGallery').addEventListener('click', async () => {
  const title = document.getElementById('gTitle').value;
  const imageUrl = document.getElementById('gImage').value;
  const description = document.getElementById('gDesc').value;
  const res = await fetch('/admin-api/gallery', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
    body: JSON.stringify({ title, imageUrl, description })
  });
  if (res.status === 201) {
    document.getElementById('gTitle').value = '';
    document.getElementById('gImage').value = '';
    document.getElementById('gDesc').value = '';
    loadGallery();
  } else {
    alert('Failed to add');
  }
});

async function loadGallery() {
  const res = await fetch('/admin-api/gallery', { headers: authHeader() });
  if (res.ok) {
    const items = await res.json();
    const ul = document.getElementById('galleryList');
    ul.innerHTML = '';
    items.forEach(it => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${it.title}</strong> — <em>${it.createdAt}</em> <button data-id="${it.id}" class="del">Delete</button>`;
      ul.appendChild(li);
    });
    document.querySelectorAll('.del').forEach(b => b.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      await fetch('/admin-api/gallery/' + id, { method: 'DELETE', headers: authHeader() });
      loadGallery();
    }));
  }
}

async function loadOrders() {
  const res = await fetch('/admin-api/orders', { headers: authHeader() });
  if (res.ok) {
    const items = await res.json();
    const ul = document.getElementById('ordersList');
    ul.innerHTML = '';
    items.forEach(o => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>#${o.id}</strong> ${o.customerName} (${o.email}) — <em>${o.status}</em> <button data-id="${o.id}" class="mark">Mark shipped</button>`;
      ul.appendChild(li);
    });
    document.querySelectorAll('.mark').forEach(b => b.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      await fetch('/admin-api/orders/' + id + '/status', { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()), body: JSON.stringify({ status: 'shipped' }) });
      loadOrders();
    }));
  }
}

// Auto-login if token present
if (localStorage.getItem('west-admin-token')) {
  document.getElementById('login').style.display = 'none';
  document.getElementById('panel').style.display = 'block';
  loadGallery();
  loadOrders();
  loadAdmins();
}

// Admin users management UI
document.getElementById('addUser').addEventListener('click', async () => {
  const username = document.getElementById('newUserName').value.trim();
  const password = document.getElementById('newUserPass').value.trim();
  if (!username || !password) return alert('Provide username and password');
  const res = await fetch('/admin-api/admins', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()), body: JSON.stringify({ username, password }) });
  if (res.status === 201) {
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserPass').value = '';
    loadAdmins();
  } else {
    const err = await res.json();
    alert('Failed: ' + (err.error || res.statusText));
  }
});

async function loadAdmins() {
  const res = await fetch('/admin-api/admins', { headers: authHeader() });
  if (!res.ok) return;
  const list = await res.json();
  const tbody = document.querySelector('#adminsTable tbody');
  tbody.innerHTML = '';
  list.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${a.id}</td><td>${a.username}</td><td>${a.createdAt}</td><td><button data-id="${a.id}" class="chg">Change PW</button> <button data-id="${a.id}" class="delUser">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.chg').forEach(b => b.addEventListener('click', async e => {
    const id = e.target.dataset.id;
    const pw = prompt('New password for admin id ' + id);
    if (!pw) return;
    const r = await fetch('/admin-api/admins/' + id + '/password', { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()), body: JSON.stringify({ password: pw }) });
    if (r.ok) alert('Password changed'); else { const t = await r.json(); alert('Failed: ' + (t.error || r.statusText)); }
    loadAdmins();
  }));
  document.querySelectorAll('.delUser').forEach(b => b.addEventListener('click', async e => {
    const id = e.target.dataset.id;
    if (!confirm('Delete admin id ' + id + '?')) return;
    const r = await fetch('/admin-api/admins/' + id, { method: 'DELETE', headers: authHeader() });
    if (r.ok) loadAdmins(); else { const t = await r.json(); alert('Failed: ' + (t.error || r.statusText)); }
  }));
}
