// index.js

(function() {
  function updateNavAccount() {
    const navAccount = document.getElementById('navAccount');
    if (navAccount) {
      if (API.isLoggedIn && API.isLoggedIn()) {
        navAccount.href = '/customer-dashboard.html';
        navAccount.innerHTML = '<i class="fas fa-tachometer-alt"></i> Dashboard';
      } else {
        navAccount.href = '/customer-login.html';
        navAccount.innerHTML = '<i class="fas fa-user"></i> Account';
      }
    }
  }

  function loadFeaturedProducts() {
    const featured = [
      { title: "Elegant Wedding Cake", price: "KSh 35,000", image: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=300&h=200&fit=crop", badge: "Best Seller" },
      { title: "Unicorn Birthday Cake", price: "KSh 8,500", image: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=300&h=200&fit=crop", badge: "Popular" },
      { title: "Maasai Cultural Cake", price: "KSh 38,000", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=200&fit=crop", badge: "New" },
      { title: "Chocolate Fudge Cake", price: "KSh 4,200", image: "https://images.unsplash.com/photo-1565806029259-e72c030c6e8f?w=300&h=200&fit=crop", badge: "" }
    ];
    
    const container = document.getElementById('featuredProducts');
    if (container) {
      container.innerHTML = featured.map(p => `
        <div class="product-card">
          ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ''}
          <div class="product-img"><img src="${p.image}" alt="${p.title}" loading="lazy"></div>
          <div class="product-info">
            <h3>${p.title}</h3>
            <div class="product-price">${p.price}</div>
            <button class="product-order" onclick="window.location.href='/order.html'"><i class="fas fa-shopping-cart"></i> Order Now</button>
          </div>
        </div>
      `).join('');
    }
  }

  function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    if (mobileMenuBtn && navLinks) {
      mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
      });
      document.addEventListener('click', (e) => {
        if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          navLinks.classList.remove('active');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateNavAccount();
    loadFeaturedProducts();
    initMobileMenu();
  });
})();