// customer-dashboard.js

(function() {
  if (!API.requireCustomerAuth()) return;

  const customer = API.getCustomer();
  if (customer?.name) {
    const welcomeEl = document.getElementById('welcome-name');
    if (welcomeEl) {
      welcomeEl.textContent = `Welcome back, ${customer.name.split(' ')[0]}! 👋`;
    }
  }

  // Helper functions for formatting
  function formatMoney(amount) {
    return `KSh ${Number(amount || 0).toLocaleString()}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await API.logout();
    });
  }

  let allOrders = [];
  let activeFilter = 'all';

  async function loadOrders() {
    const res = await API.request('/api/orders/my-orders');
    if (!res || !res.ok) {
      const container = document.getElementById('orders-container');
      if (container) {
        container.innerHTML = '<div class="empty"><i class="fas fa-exclamation-circle"></i><p>Failed to load orders.</p></div>';
      }
      return;
    }
    allOrders = await res.json();
    renderStats(allOrders);
    renderOrders(allOrders);
  }

  function renderStats(orders) {
    const pending = orders.filter(o => o.status === 'pending').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const spent = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
    const statsDiv = document.getElementById('stats');
    if (statsDiv) {
      statsDiv.innerHTML = `
        <div class="stat"><div class="num">${orders.length}</div><div class="lbl">Total Orders</div></div>
        <div class="stat"><div class="num">${pending}</div><div class="lbl">Pending</div></div>
        <div class="stat"><div class="num">${delivered}</div><div class="lbl">Delivered</div></div>
        <div class="stat"><div class="num">${formatMoney(spent)}</div><div class="lbl">Total Spent</div></div>
      `;
    }}
  }

  function renderOrders(orders) {
    const filtered = activeFilter === 'all' ? orders : orders.filter(o => o.status === activeFilter);
    const container = document.getElementById('orders-container');
    if (!container) return;
    
    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty"><i class="fas fa-birthday-cake"></i><p>${activeFilter === 'all' ? "You haven't placed any orders yet." : `No ${activeFilter} orders.`}</p><a href="/order.html" style="background:var(--grad-gold);color:white;padding:12px 28px;border-radius:30px;text-decoration:none;display:inline-block;margin-top:16px">Order a Cake</a></div>`;
      return;
    }
    
    container.innerHTML = '<div class="orders-grid" id="orders-grid"></div>';
    const grid = document.getElementById('orders-grid');
    
    filtered.forEach(order => {
      const statusClass = `s-${order.status.toLowerCase().replace(/\s+/g, '-')}`;
      const items = Array.isArray(order.items) ? order.items : (order.items ? JSON.parse(order.items) : []);
      const itemsHtml = items.map(i => `<li><span>${i.title || i.id}</span><span>x${i.qty} · ${formatMoney(i.price * i.qty)}</span></li>`).join('');
      const canCancel = order.status === 'pending';
      const date = formatDate(order.createdAt);
      
      const card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML = `
        <div class="card-header"><span class="order-id">Order #${order.id}</span><span class="status ${statusClass}">${order.status}</span></div>
        <div class="card-body">
          <ul class="order-items">${itemsHtml}</ul>
          <div class="order-total"><span>Total</span><span>${formatMoney(order.total)}</span></div>
          <div class="order-date"><i class="fas fa-calendar-alt"></i> ${date}</div>
          ${order.deliveryDate ? `<div class="order-date" style="margin-top:4px"><i class="fas fa-truck"></i> Delivery: ${formatDate(order.deliveryDate)}</div>` : ''}
        </div>
        ${canCancel ? `<div class="card-footer"><button class="cancel-btn" data-id="${order.id}"><i class="fas fa-times"></i> Cancel Order</button></div>` : ''}
      `;
      grid.appendChild(card);
    });
    
    grid.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this order?')) return;
        btn.disabled = true;
        btn.textContent = 'Cancelling…';
        const res = await API.request(`/api/orders/my-orders/${btn.dataset.id}/cancel`, { method: 'POST' });
        if (res?.ok) loadOrders();
        else alert('Could not cancel order.');
      });
    });
  }

  const filterTabs = document.getElementById('filter-tabs');
  if (filterTabs) {
    filterTabs.addEventListener('click', e => {
      if (!e.target.classList.contains('tab')) return;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      activeFilter = e.target.dataset.status;
      renderOrders(allOrders);
    });
  }

  loadOrders();
})();