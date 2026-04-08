// gallary.js

(function() {
  // Gallery Data
  const cakeCollections = {
    wedding: [
      {
        id: 1,
        title: "Elegant Three-Tier Wedding Cake",
        description: "Classic white wedding cake with delicate sugar flowers and gold leaf accents.",
        image: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80",
        features: ["3 Tiers", "Sugar Flowers", "Gold Leaf", "Vanilla Sponge"],
        price: "KSh 35,000",
        popular: true,
        orderData: { cakeType: "vanilla", cakeFilling: "buttercream", icingType: "buttercream", cakeSize: "large", isMultiTier: true, tiers: ["10-inch", "8-inch", "6-inch"], features: ["flowers"], price: 35000 }
      },
      {
        id: 2,
        title: "Chocolate Fudge Wedding Cake",
        description: "Luxurious chocolate fudge cake with ganache drips and fresh berries.",
        image: "https://images.unsplash.com/photo-1565806029259-e72c030c6e8f?auto=format&fit=crop&w=800&q=80",
        features: ["Chocolate Fudge", "Ganache Drip", "Fresh Berries", "3 Tiers"],
        price: "KSh 42,000",
        popular: false,
        orderData: { cakeType: "chocolate", cakeFilling: "chocolate-ganache", icingType: "ganache", cakeSize: "large", isMultiTier: true, tiers: ["10-inch", "8-inch", "6-inch"], features: [], price: 42000 }
      },
      {
        id: 12,
        title: "Rose Gold Glamour Cake",
        description: "Stunning rose gold drip cake with edible gold leaf and fresh roses.",
        image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=800&q=80",
        features: ["Rose Gold Drip", "Edible Gold", "Fresh Roses", "2 Tiers"],
        price: "KSh 28,000",
        popular: true,
        orderData: { cakeType: "red-velvet", cakeFilling: "cream-cheese", icingType: "buttercream", cakeSize: "large", isMultiTier: true, tiers: ["8-inch", "6-inch"], features: ["flowers"], price: 28000 }
      }
    ],
    birthday: [
      {
        id: 3,
        title: "Unicorn Fantasy Birthday Cake",
        description: "Colourful unicorn-themed cake with rainbow layers and magical horn topper.",
        image: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=800&q=80",
        features: ["Rainbow Layers", "Edible Glitter", "Buttercream", "Fondant Decor"],
        price: "KSh 8,500",
        popular: true,
        orderData: { cakeType: "vanilla", cakeFilling: "buttercream", icingType: "buttercream", cakeSize: "medium", isMultiTier: false, features: ["sparklers"], topper: "figure", price: 8500 }
      },
      {
        id: 4,
        title: "Princess Castle Cake",
        description: "Magical castle cake complete with turrets, flags, and princess figurines.",
        image: "https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&w=800&q=80",
        features: ["Multi-Tier", "Fondant Castle", "Figurines", "Vanilla"],
        price: "KSh 15,000",
        popular: true,
        orderData: { cakeType: "vanilla", cakeFilling: "strawberry-jam", icingType: "fondant", cakeSize: "large", isMultiTier: true, tiers: ["8-inch", "6-inch"], features: ["figurines"], topper: "figure", price: 15000 }
      }
    ],
    cultural: [
      {
        id: 5,
        title: "Maasai Cultural Wedding Cake",
        description: "Traditional Maasai-inspired design with beadwork patterns and earthy tones.",
        image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
        features: ["Maasai Beadwork", "Traditional Colours", "3 Tiers", "Spice Cake"],
        price: "KSh 38,000",
        popular: true,
        orderData: { cakeType: "fruit", cakeFilling: "cream-cheese", icingType: "fondant", cakeSize: "large", isMultiTier: true, tiers: ["10-inch", "8-inch", "6-inch"], features: ["flowers", "figurines"], price: 38000 }
      },
      {
        id: 6,
        title: "Kenyan Safari-Themed Cake",
        description: "Celebrating Kenyan wildlife with animal figurines and safari motifs.",
        image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
        features: ["Safari Theme", "Animal Figurines", "Carrot Cake", "Cream Cheese"],
        price: "KSh 18,000",
        popular: false,
        orderData: { cakeType: "carrot", cakeFilling: "cream-cheese", icingType: "buttercream", cakeSize: "medium", isMultiTier: false, features: ["figurines"], price: 18000 }
      }
    ],
    other: [
      {
        id: 7,
        title: "Corporate Logo Cake",
        description: "Custom-designed cake featuring company logo and brand colours.",
        image: "https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=800&q=80",
        features: ["Custom Design", "Edible Print", "Fondant", "Chocolate"],
        price: "KSh 25,000",
        popular: true,
        orderData: { cakeType: "chocolate", cakeFilling: "chocolate-ganache", icingType: "fondant", cakeSize: "large", isMultiTier: false, features: ["edible-image"], price: 25000 }
      },
      {
        id: 8,
        title: "Baby Shower Safari Cake",
        description: "Adorable safari-themed cake with animal fondant figures for baby showers.",
        image: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=800&q=80",
        features: ["Safari Theme", "Fondant Animals", "Carrot Cake", "Cream Cheese"],
        price: "KSh 9,500",
        popular: true,
        orderData: { cakeType: "carrot", cakeFilling: "cream-cheese", icingType: "buttercream", cakeSize: "medium", isMultiTier: false, features: ["figurines"], price: 9500 }
      }
    ]
  };

  let selectedCake = null;
  let selectedCategory = null;

  function getCategoryLabel(c) {
    const labels = { wedding: 'Wedding Cake', birthday: 'Birthday Cake', cultural: 'Cultural Event', other: 'Special Event' };
    return labels[c] || c;
  }

  function loadCategory(category, gridElement) {
    if (!gridElement) return;
    cakeCollections[category].forEach((cake, index) => {
      gridElement.appendChild(createCakeCard(cake, category, index));
    });
  }

  function createCakeCard(cake, category, index) {
    const card = document.createElement('div');
    card.className = 'cake-card';
    card.style.animationDelay = `${index * 0.1}s`;
    card.innerHTML = `
      <div class="cake-image">
        <img src="${cake.image}" alt="${cake.title}" loading="lazy">
        ${cake.popular ? '<div class="cake-badge">Popular</div>' : ''}
      </div>
      <div class="cake-details">
        <span class="cake-category">${getCategoryLabel(category)}</span>
        <h3 class="cake-title">${cake.title}</h3>
        <p class="cake-description">${cake.description}</p>
        <div class="cake-features">${cake.features.map(f => `<span class="feature-tag">${f}</span>`).join('')}</div>
        <div class="cake-price">${cake.price}</div>
        <div class="cake-actions">
          <button class="btn btn-primary"><i class="fas fa-shopping-cart"></i> Order This Cake</button>
          <button class="btn btn-outline"><i class="fas fa-eye"></i> Details</button>
        </div>
      </div>`;
    
    card.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', () => showOrderModal(cake, category));
    });
    return card;
  }

  function showOrderModal(cake, category) {
    selectedCake = cake;
    selectedCategory = category;
    
    const modalCakeImage = document.getElementById('modalCakeImage');
    if (modalCakeImage) modalCakeImage.src = cake.image;
    const modalCakeTitle = document.getElementById('modalCakeTitle');
    if (modalCakeTitle) modalCakeTitle.textContent = cake.title;
    const modalCakeCategory = document.getElementById('modalCakeCategory');
    if (modalCakeCategory) modalCakeCategory.textContent = getCategoryLabel(category);
    const modalCakePrice = document.getElementById('modalCakePrice');
    if (modalCakePrice) modalCakePrice.textContent = cake.price;
    const modalCakeFeatures = document.getElementById('modalCakeFeatures');
    if (modalCakeFeatures) modalCakeFeatures.textContent = cake.features.join(', ');
    const modalCakeDescription = document.getElementById('modalCakeDescription');
    if (modalCakeDescription) modalCakeDescription.textContent = cake.description;
    
    const orderModal = document.getElementById('orderModal');
    if (orderModal) {
      orderModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeOrderModal() {
    const orderModal = document.getElementById('orderModal');
    if (orderModal) {
      orderModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  }

  function saveCakeForOrder() {
    if (!selectedCake) return;
    localStorage.setItem('selectedCakeOrder', JSON.stringify({
      cake: selectedCake,
      category: selectedCategory,
      timestamp: Date.now()
    }));
    window.location.href = '/order.html';
  }

  function loadAllCategories() {
    loadCategory('wedding', document.getElementById('weddingGrid'));
    loadCategory('birthday', document.getElementById('birthdayGrid'));
    loadCategory('cultural', document.getElementById('culturalGrid'));
    loadCategory('other', document.getElementById('otherGrid'));
  }

  function updateAuthNav() {
    const navAccount = document.getElementById('nav-account');
    if (!navAccount) return;
    if (API.isLoggedIn && API.isLoggedIn()) {
      navAccount.href = '/customer-dashboard.html';
      navAccount.innerHTML = '<i class="fas fa-tachometer-alt"></i> Dashboard';
    } else {
      navAccount.href = '/customer-login.html';
      navAccount.innerHTML = '<i class="fas fa-user"></i> My Orders';
    }
  }

  function setupEventListeners() {
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

    const categoryNavBtns = document.querySelectorAll('.category-nav-btn');
    categoryNavBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(btn.getAttribute('href'));
        if (target) {
          categoryNavBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          window.scrollTo({ top: target.offsetTop - 100, behavior: 'smooth' });
          if (navLinks) navLinks.classList.remove('active');
        }
      });
    });

    const modalClose = document.getElementById('modalClose');
    if (modalClose) modalClose.addEventListener('click', closeOrderModal);
    const cancelOrder = document.getElementById('cancelOrder');
    if (cancelOrder) cancelOrder.addEventListener('click', closeOrderModal);
    const confirmOrder = document.getElementById('confirmOrder');
    if (confirmOrder) confirmOrder.addEventListener('click', () => {
      saveCakeForOrder();
      closeOrderModal();
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOrderModal();
    });
    
    const orderModal = document.getElementById('orderModal');
    if (orderModal) {
      orderModal.addEventListener('click', (e) => {
        if (e.target === orderModal) closeOrderModal();
      });
    }
    
    const backToTop = document.getElementById('backToTop');
    if (backToTop) {
      backToTop.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function setupAnimations() {
    setTimeout(() => {
      document.querySelectorAll('.cake-card').forEach(c => c.classList.add('visible'));
    }, 300);
  }

  function setupScrollSpy() {
    const backToTop = document.getElementById('backToTop');
    const categoryNavBtns = document.querySelectorAll('.category-nav-btn');
    const sections = document.querySelectorAll('.category-section');
    
    window.addEventListener('scroll', () => {
      if (backToTop) {
        backToTop.classList.toggle('visible', window.scrollY > 500);
      }
      if (sections.length) {
        let current = 'wedding';
        sections.forEach(s => {
          if (window.scrollY >= s.offsetTop - 150) current = s.id;
        });
        categoryNavBtns.forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('href') === `#${current}`);
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAllCategories();
    setupEventListeners();
    setupAnimations();
    setupScrollSpy();
    updateAuthNav();
  });
})();