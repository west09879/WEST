function tokenHeader() {
    const t = (document.getElementById('token') && document.getElementById('token').value) || '';
    const token = t && t.trim() ? t.trim() : (window.DEFAULT_WORKER_TOKEN || 'workerdevtoken');
    return { 'x-worker-token': token };
}

async function loadOrders() {
    const headers = Object.assign({}, tokenHeader());
    try {
        const res = await fetch('/worker-api/orders', { headers });
        if (!res.ok) return alert('Failed to load orders: ' + res.statusText);
        const list = await res.json();
        const tbody = document.querySelector('#ordersTable tbody');
        tbody.innerHTML = '';
        list.forEach(o => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${o.id}</td>
        <td>${o.customerName}<br/><small>${o.email}</small></td>
        <td>${o.items.map(i => `${i.qty}× ${i.title} (KES ${i.price})`).join('<br/>')}</td>
        <td>KES ${o.total}</td>
        <td><span class="badge">${o.status}</span></td>
        <td>${o.assignedTo || ''}</td>
        <td class="controls">
          <button data-id="${o.id}" class="claim">Claim</button>
          <button data-id="${o.id}" class="done">Mark Done</button>
        </td>
      `;
            tbody.appendChild(tr);
        });
        document.querySelectorAll('.claim').forEach(b => b.addEventListener('click', async e => {
            const id = e.target.dataset.id;
            const worker = document.getElementById('workerName').value || 'worker';
            const res = await fetch('/worker-api/orders/' + id + '/claim', { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, tokenHeader()), body: JSON.stringify({ worker }) });
            if (res.ok) loadOrders(); else { const t = await res.json(); alert('Error: ' + (t.error || res.statusText)); }
        }));
        document.querySelectorAll('.done').forEach(b => b.addEventListener('click', async e => {
            const id = e.target.dataset.id;
            const res = await fetch('/worker-api/orders/' + id + '/status', { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, tokenHeader()), body: JSON.stringify({ status: 'completed' }) });
            if (res.ok) loadOrders(); else { const t = await res.json(); alert('Error: ' + (t.error || res.statusText)); }
        }));
    } catch (e) { alert('Network error: ' + e.message); }
}

document.getElementById('btnLoad').addEventListener('click', loadOrders);

// auto-fill token from env if served with query param ?token=...
const q = new URLSearchParams(window.location.search);
if (q.get('token')) document.getElementById('token').value = q.get('token');
// load once on open and refresh periodically so new orders appear
loadOrders();
setInterval(loadOrders, 8000);
