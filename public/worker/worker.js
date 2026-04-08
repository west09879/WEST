// worker/worker.js

(function() {
  const token = localStorage.getItem('workerToken');
  if (!token) {
    window.location.replace('/worker-login.html');
    return;
  }
  
  let workerName = 'Worker';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    workerName = payload.name || payload.username || 'Worker';
    const workerChip = document.getElementById('workerChip');
    if (workerChip) {
      workerChip.innerHTML = `<i class="fas fa-user-cog"></i> ${workerName}`;
    }
  } catch (e) {
    console.error('Error parsing token:', e);
  }
  
  function toast(msg, type = 'success') {
    const toastsContainer = document.getElementById('toasts');
    if (!toastsContainer) return;
    const el = document.createElement('div');
    el.className = `toast t-${type}`;
    const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    el.innerHTML = `<i class="fas fa-${icon}"></i>${msg}`;
    toastsContainer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      ...opts
    });
    if (res.status === 401) {
      localStorage.removeItem('workerToken');
      window.location.replace('/worker-login.html');
      return null;
    }
    return res;
  }
  
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
  
  function formatDate(d) {
    if (!d) return '—';
    const n = new Date(d);
    return n.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) + ' ' +
           n.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  }
  
  let allOrders = [];
  let activeTab = 'queue';
  
  const tabs = document.getElementById('tabs');
  if (tabs) {
    tabs.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab')) return;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      activeTab = e.target.dataset.tab;
      const secTitle = document.getElementById('secTitle');
      if (secTitle) {
        const titles = {
          queue: 'Available Queue',
          mine: 'My Orders',
          all: 'All Orders'
        };
        secTitle.innerHTML = `<i class="fas fa-list"></i> ${titles[activeTab]}`;
      }
      renderOrders();
    });
  }
  
  async function loadOrders() {
    const icon = document.getElementById('refreshIcon');
    if (icon) icon.classList.add('spin');
    const res = await api('/worker-api/orders');
    if (icon) icon.classList.remove('spin');
    if (!res || !res.ok) {
      toast('Failed to load orders', 'error');
      return;
    }
    allOrders = await res.json();
    updateStats();
    renderOrders();
  }
  
  function updateStats() {
    const today = new Date().toDateString();
    const queueCount = allOrders.filter(o => ['pending', 'confirmed'].includes(o.status) && !o.assignedTo).length;
    const mineCount = allOrders.filter(o => o.assignedTo === workerName && !['delivered', 'cancelled'].includes(o.status)).length;
    const readyCount = allOrders.filter(o => o.status === 'ready').length;
    const deliveredToday = allOrders.filter(o => o.status === 'delivered' && new Date(o.updatedAt || o.createdAt).toDateString() === today).length;
    
    const statQueue = document.getElementById('stat-queue');
    const statMine = document.getElementById('stat-mine');
    const statReady = document.getElementById('stat-ready');
    const statDone = document.getElementById('stat-done');
    
    if (statQueue) statQueue.textContent = queueCount;
    if (statMine) statMine.textContent = mineCount;
    if (statReady) statReady.textContent = readyCount;
    if (statDone) statDone.textContent = deliveredToday;
  }
  
  function renderOrders() {
    let filtered = allOrders;
    if (activeTab === 'queue') {
      filtered = allOrders.filter(o => ['pending', 'confirmed'].includes(o.status) && !o.assignedTo);
    } else if (activeTab === 'mine') {
      filtered = allOrders.filter(o => o.assignedTo === workerName && !['delivered', 'cancelled'].includes(o.status));
    }
    
    const container = document.getElementById('ordersContainer');
    if (!container) return;
    
    if (!filtered.length) {
      const messages = {
        queue: 'No orders in the queue',
        mine: 'You have no active orders',
        all: 'No orders found'
      };
      container.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i>${messages[activeTab]}</div>`;
      return;
    }
    
    container.innerHTML = `<div class="orders-grid">${filtered.map(orderCard).join('')}</div>`;
  }
  
  function orderCard(o) {
    const items = Array.isArray(o.items) ? o.items : [];
    const isMine = o.assignedTo === workerName;
    const canClaim = ['pending', 'confirmed'].includes(o.status) && !o.assignedTo;
    const canStart = isMine && o.status === 'confirmed';
    const canReady = isMine && o.status === 'preparing';
    const canDeliver = isMine && o.status === 'ready';
    
    function fmtMoney(n) {
      return `KSh ${Number(n || 0).toLocaleString()}`;
    }
    
    return `
      <div class="order-card" id="card-${o.id}">
        <div class="card-top">
          <span class="order-id">Order #${o.id}</span>
          ${statusBadge(o.status)}
        </div>
        <div class="card-body">
          <ul class="order-items">
            ${items.map(i => `<li><span>${i.title || 'Item'}</span><span>×${i.qty} · ${fmtMoney(i.price * i.qty)}</span></li>`).join('')}
          </ul>
          <div class="order-total">
            <span>Total</span>
            <span>${fmtMoney(o.total)}</span>
          </div>
          <div class="order-meta">
            <span><i class="fas fa-user"></i>${o.customerName}</span>
            <span><i class="fas fa-phone"></i>${o.phone || '—'}</span>
            ${o.deliveryDate ? `<span><i class="fas fa-calendar"></i>${formatDate(o.deliveryDate)}</span>` : ''}
            ${o.deliveryAddress ? `<span><i class="fas fa-map-marker-alt"></i>${o.deliveryAddress}</span>` : ''}
            ${o.specialInstructions ? `<span><i class="fas fa-sticky-note"></i><em>${o.specialInstructions.slice(0, 100)}${o.specialInstructions.length > 100 ? '…' : ''}</em></span>` : ''}
            <span><i class="fas fa-clock"></i>${formatDate(o.createdAt)}</span>
          </div>
          ${o.assignedTo ? `<div class="assigned-badge"><i class="fas fa-user-cog"></i> ${o.assignedTo}</div>` : ''}
        </div>
        <div class="card-foot">
          ${canClaim ? `<button class="btn btn-primary" onclick="claimOrder(${o.id})"><i class="fas fa-hand-pointer"></i> Claim</button>` : ''}
          ${canStart ? `<button class="btn btn-ghost" onclick="setStatus(${o.id},'preparing')"><i class="fas fa-play"></i> Start Preparing</button>` : ''}
          ${canReady ? `<button class="btn btn-ready" onclick="setStatus(${o.id},'ready')"><i class="fas fa-bell"></i> Mark Ready</button>` : ''}
          ${canDeliver ? `<button class="btn btn-success" onclick="setStatus(${o.id},'delivered')"><i class="fas fa-check-double"></i> Mark Delivered</button>` : ''}
        </div>
      </div>
    `;
  }
  
  window.claimOrder = async function(id) {
    const btn = document.querySelector(`#card-${id} .btn-primary`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner spin"></i> Claiming…';
    }
    const res = await api(`/worker-api/orders/${id}/claim`, { method: 'PUT' });
    if (res?.ok) {
      toast('Order claimed! Start preparing when ready.');
      loadOrders();
    } else {
      const d = await res?.json().catch(() => ({}));
      toast(d.error || 'Could not claim order', 'error');
      loadOrders();
    }
  };
  
  window.setStatus = async function(id, status) {
    const res = await api(`/worker-api/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    const labels = {
      preparing: 'Preparing started 👨‍🍳',
      ready: 'Order marked ready! 🎂',
      delivered: 'Delivered ✓'
    };
    if (res?.ok) {
      toast(labels[status] || 'Status updated');
      loadOrders();
    } else {
      const d = await res?.json().catch(() => ({}));
      toast(d.error || 'Failed', 'error');
    }
  };
  
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadOrders);
  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('workerToken');
      window.location.replace('/worker-login.html');
    });
  }
  
  loadOrders();
  setInterval(loadOrders, 60000);
})();