// production.js - Unified Production Hub

(function() {
  const token = localStorage.getItem('workerToken');
  if (!token) {
    window.location.replace('/worker-login.html');
    return;
  }

  let currentRole = 'baker';
  let workerInfo = null;
  let tasks = [];

  // Parse worker info from token
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    workerInfo = {
      id: payload.id,
      name: payload.name || payload.username || 'Worker',
      canBake: payload.canBake || 1,
      canDesign: payload.canDesign || 0,
      canDeliver: payload.canDeliver || 0
    };
    document.getElementById('workerName').innerHTML = `<i class="fas fa-user-check"></i> ${workerInfo.name}`;
  } catch(e) {
    workerInfo = { name: 'Worker', canBake: 1, canDesign: 0, canDeliver: 0 };
  }

  // Role configurations
  const roleConfig = {
    baker: {
      title: "Baker's Station",
      icon: "fa-bread-slice",
      description: "Manage cake baking tasks - sponge preparation, baking, and quality check",
      sectionTitle: "Baking Queue",
      endpoint: '/production/baking/queue',
      claimEndpoint: '/production/baking/:id/claim',
      completeEndpoint: '/production/baking/:id/complete',
      claimButtonText: '🎂 Claim & Start Baking',
      completeButtonText: '✅ Mark Baking Complete',
      completeConfirmMessage: 'Mark this baking task as complete? The cake will move to design team.',
      successMessage: 'Baking complete! Cake sent to design team.',
      canAccess: () => workerInfo.canBake
    },
    designer: {
      title: "Designer's Studio",
      icon: "fa-palette",
      description: "Cake decoration, icing, writing, and artistic finishing",
      sectionTitle: "Design Queue",
      endpoint: '/production/design/queue',
      claimEndpoint: '/production/design/:id/claim',
      completeEndpoint: '/production/design/:id/complete',
      claimButtonText: '🎨 Claim & Start Design',
      completeButtonText: '✨ Mark Design Complete',
      completeConfirmMessage: 'Mark this design task as complete? The cake will move to delivery team.',
      successMessage: 'Design complete! Cake ready for delivery.',
      canAccess: () => workerInfo.canDesign
    },
    delivery: {
      title: "Delivery Dispatch",
      icon: "fa-truck",
      description: "Route planning, customer delivery, and order completion",
      sectionTitle: "Delivery Queue",
      endpoint: '/production/delivery/queue',
      claimEndpoint: '/production/delivery/:id/claim',
      completeEndpoint: '/production/delivery/:id/complete',
      claimButtonText: '🚚 Claim & Start Delivery',
      completeButtonText: '✅ Mark Delivered',
      completeConfirmMessage: 'Confirm this order has been delivered to the customer?',
      successMessage: 'Order delivered successfully!',
      canAccess: () => workerInfo.canDeliver
    }
  };

  // Check which roles user can access
  function getAvailableRoles() {
    const available = [];
    if (workerInfo.canBake) available.push('baker');
    if (workerInfo.canDesign) available.push('designer');
    if (workerInfo.canDeliver) available.push('delivery');
    return available;
  }

  // Update UI based on available roles
  function updateRoleSelector() {
    const availableRoles = getAvailableRoles();
    const roleSelector = document.getElementById('roleSelector');

    if (availableRoles.length === 1) {
      // Only one role available, hide selector and set role
      roleSelector.style.display = 'none';
      currentRole = availableRoles[0];
    } else {
      roleSelector.style.display = 'flex';
      // Show only buttons for available roles
      const buttons = roleSelector.querySelectorAll('.role-btn');
      buttons.forEach(btn => {
        const role = btn.dataset.role;
        if (availableRoles.includes(role)) {
          btn.style.display = 'flex';
        } else {
          btn.style.display = 'none';
        }
      });
    }
    updateRoleUI();
  }

  // Update UI for current role
  function updateRoleUI() {
    const config = roleConfig[currentRole];
    const titleEl = document.getElementById('roleTitle');
    const descEl = document.getElementById('roleDescription');
    const sectionTitleEl = document.getElementById('sectionTitle');

    titleEl.innerHTML = `<i class="fas ${config.icon}"></i> ${config.title}`;
    descEl.textContent = config.description;
    sectionTitleEl.innerHTML = `<i class="fas fa-list"></i> ${config.sectionTitle}`;

    // Update active state in role selector
    document.querySelectorAll('.role-btn').forEach(btn => {
      if (btn.dataset.role === currentRole) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // API request helper
  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      ...options
    });
    if (res.status === 401) {
      localStorage.removeItem('workerToken');
      window.location.replace('/worker-login.html');
      return null;
    }
    return res;
  }

  // Load tasks for current role
  async function loadTasks() {
    const config = roleConfig[currentRole];
    if (!config.canAccess()) {
      showToast(`You don't have permission to access ${config.title}`, 'error');
      return;
    }

    const container = document.getElementById('tasksContainer');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading tasks...</p></div>';

    const res = await api(config.endpoint);
    if (!res || !res.ok) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load tasks</p></div>';
      return;
    }

    const data = await res.json();
    tasks = data.tasks || [];
    updateStats();
    renderTasks();
  }

  // Update statistics
  function updateStats() {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completedToday = tasks.filter(t => {
      if (!t.completed_at) return false;
      const today = new Date().toDateString();
      const completedDate = new Date(t.completed_at).toDateString();
      return completedDate === today;
    }).length;

    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('inProgressCount').textContent = inProgress;
    document.getElementById('completedCount').textContent = completedToday;
  }

  // Render tasks
  function renderTasks() {
    const container = document.getElementById('tasksContainer');

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-check-circle"></i>
          <p>No tasks in queue. Great job!</p>
          <p style="font-size: 12px; margin-top: 8px;">Check back later for new orders</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '<div class="orders-grid" id="ordersGrid"></div>';
    const grid = document.getElementById('ordersGrid');

    tasks.forEach(task => {
      const card = createTaskCard(task);
      grid.appendChild(card);
    });
  }

  // Create task card based on role
  function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'order-card';

    const items = task.items || [];
    const itemsHtml = items.map(item => `
      <li>
        <span>${item.title || 'Cake'}</span>
        <span>x${item.qty} - KSh ${(item.price * item.qty).toLocaleString()}</span>
      </li>
    `).join('');

    const statusClass = task.status === 'in_progress' ? 'status-in_progress' :
                        task.status === 'completed' ? 'status-completed' : 'status-pending';
    const statusText = task.status === 'in_progress' ? 'In Progress' :
                       task.status === 'completed' ? 'Completed' : 'Pending';

    // Role-specific details
    let roleDetails = '';

    if (currentRole === 'baker') {
      roleDetails = `
        <div class="detail-row">
          <span class="detail-label">Sponge Type</span>
          <span class="detail-value">${task.sponge_type || 'Vanilla'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Cake Shape</span>
          <span class="detail-value">${task.cake_shape || 'Round'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pan Size</span>
          <span class="detail-value">${task.pan_size || 'Medium'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Layers</span>
          <span class="detail-value">${task.layers || 1}</span>
        </div>
        ${task.baking_notes ? `
        <div class="detail-row">
          <span class="detail-label">Baking Notes</span>
          <span class="detail-value">${task.baking_notes}</span>
        </div>
        ` : ''}
      `;
    } else if (currentRole === 'designer') {
      roleDetails = `
        <div class="detail-row">
          <span class="detail-label">Icing Type</span>
          <span class="detail-value">${task.icing_type || 'Buttercream'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Icing Color</span>
          <span class="detail-value">${task.icing_color || 'White'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Topper Type</span>
          <span class="detail-value">${task.topper_type || 'Standard'}</span>
        </div>
        ${task.writing_text ? `
        <div class="detail-row">
          <span class="detail-label">Writing Text</span>
          <span class="detail-value">"${task.writing_text}"</span>
        </div>
        ` : ''}
        ${task.design_reference ? `
        <div class="detail-row">
          <span class="detail-label">Design Reference</span>
          <span class="detail-value">${task.design_reference}</span>
        </div>
        ` : ''}
      `;
    } else if (currentRole === 'delivery') {
      roleDetails = `
        <div class="detail-row">
          <span class="detail-label">Customer</span>
          <span class="detail-value">${task.customerName || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${task.customer_phone || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Delivery Address</span>
          <span class="detail-value">${task.delivery_address || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Delivery Zone</span>
          <span class="detail-value">${task.delivery_zone || 'Nairobi'}</span>
        </div>
        ${task.special_handling ? `
        <div class="detail-row">
          <span class="detail-label">Special Handling</span>
          <span class="detail-value">${task.special_handling}</span>
        </div>
        ` : ''}
      `;
    }

    const config = roleConfig[currentRole];

    card.innerHTML = `
      <div class="card-header">
        <span class="order-number">Order #${task.order_id}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="card-body">
        <div class="cake-details">
          ${roleDetails}
        </div>
        <div class="items-list">
          <h4>Order Items</h4>
          <ul>${itemsHtml}</ul>
        </div>
      </div>
      <div class="card-footer">
        ${task.status === 'pending' ? `
          <button class="btn btn-primary claim-btn" data-id="${task.id}">
            <i class="fas fa-hand-paper"></i> ${config.claimButtonText}
          </button>
        ` : task.status === 'in_progress' ? `
          <button class="btn btn-success complete-btn" data-id="${task.id}">
            <i class="fas fa-check"></i> ${config.completeButtonText}
          </button>
        ` : ''}
      </div>
    `;

    // Add event listeners
    if (task.status === 'pending') {
      const claimBtn = card.querySelector('.claim-btn');
      claimBtn.addEventListener('click', () => claimTask(task.id));
    } else if (task.status === 'in_progress') {
      const completeBtn = card.querySelector('.complete-btn');
      completeBtn.addEventListener('click', () => completeTask(task.id));
    }

    return card;
  }

  // Claim task
  async function claimTask(taskId) {
    const config = roleConfig[currentRole];
    const btn = document.querySelector(`.claim-btn[data-id="${taskId}"]`);

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Claiming...';
    }

    const endpoint = config.claimEndpoint.replace(':id', taskId);
    const res = await api(endpoint, { method: 'POST' });

    if (res && res.ok) {
      await loadTasks();
      showToast(`Task claimed! ${currentRole === 'baker' ? 'Start baking!' : currentRole === 'designer' ? 'Start designing!' : 'Prepare for delivery!'}`, 'success');
    } else {
      showToast('Failed to claim task', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-hand-paper"></i> ${config.claimButtonText}`;
      }
    }
  }

  // Complete task
  async function completeTask(taskId) {
    const config = roleConfig[currentRole];

    if (!confirm(config.completeConfirmMessage)) return;

    const btn = document.querySelector(`.complete-btn[data-id="${taskId}"]`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    const endpoint = config.completeEndpoint.replace(':id', taskId);
    const res = await api(endpoint, { method: 'POST' });

    if (res && res.ok) {
      await loadTasks();
      showToast(config.successMessage, 'success');
    } else {
      showToast('Failed to complete task', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check"></i> ${config.completeButtonText}`;
      }
    }
  }

  // Show toast notification
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Switch role
  function switchRole(role) {
    if (!roleConfig[role].canAccess()) {
      showToast(`You don't have permission to access ${roleConfig[role].title}`, 'error');
      return;
    }
    currentRole = role;
    updateRoleUI();
    loadTasks();
  }

  // Event listeners
  document.getElementById('refreshBtn').addEventListener('click', loadTasks);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('workerToken');
    window.location.replace('/worker-login.html');
  });

  // Role selector buttons
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchRole(btn.dataset.role);
    });
  });

  // Initialize
  updateRoleSelector();
  loadTasks();

  // Auto-refresh every 30 seconds
  setInterval(loadTasks, 30000);
})();