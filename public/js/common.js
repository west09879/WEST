// common.js — Shared utility functions

(function() {
  // Update navigation based on login status
  function updateNavigation() {
    const navAccount = document.getElementById('nav-account');
    if (!navAccount) return;
    
    if (window.API && API.isLoggedIn && API.isLoggedIn()) {
      navAccount.href = 'customer-dashboard.html';
      navAccount.innerHTML = '<i class="fas fa-tachometer-alt"></i> Dashboard';
    } else {
      navAccount.href = 'customer-login.html';
      navAccount.innerHTML = '<i class="fas fa-user"></i> My Orders';
    }
  }

  // Mobile menu toggle
  function initMobileMenu() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    
    if (mobileBtn && navLinks) {
      mobileBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
      });
      
      document.addEventListener('click', (e) => {
        if (!navLinks.contains(e.target) && !mobileBtn.contains(e.target)) {
          navLinks.classList.remove('active');
        }
      });
    }
  }

  // Set active nav link based on current page
  function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Toast notification
  function showToast(msg, type = 'success') {
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
    el.className = 'toast';
    el.style.background = 'white';
    el.style.border = '1px solid #eee';
    el.style.borderRadius = '10px';
    el.style.padding = '11px 16px';
    el.style.fontSize = '.84rem';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '10px';
    el.style.boxShadow = '0 2px 10px rgba(0,0,0,.1)';
    
    const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    const color = type === 'success' ? '#27ae60' : '#e74c3c';
    el.innerHTML = `<i class="fas fa-${icon}" style="color:${color}"></i>${msg}`;
    
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-KE', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }

  // Format money
  function formatMoney(amount) {
    return `KSh ${Number(amount || 0).toLocaleString()}`;
  }

  // Show alert in container
  function showAlert(containerId, msg, type = 'error') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const icons = { 
      error: 'exclamation-triangle', 
      success: 'check-circle', 
      warn: 'exclamation-circle' 
    };
    container.innerHTML = `<div class="alert alert-${type}"><i class="fas fa-${icons[type]}"></i>${msg}</div>`;
  }

  // Set loading state on button
  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    updateNavigation();
    initMobileMenu();
    setActiveNavLink();
  });

  // Make functions available globally
  window.Utils = {
    showToast,
    formatDate,
    formatMoney,
    showAlert,
    setLoading,
    updateNavigation,
    setActiveNavLink
  };
})();