// navigation.js - Handles all navigation and link management

(function() {
  // Get the base URL (protocol + host)
  function getBaseUrl() {
    return `${window.location.protocol}//${window.location.host}`;
  }

  // Navigate to a specific page
  function navigateTo(page) {
    window.location.href = page;
  }

  // Fix all links to ensure proper navigation
  function fixAllLinks() {
    // With <base href="/">, relative links like "order.html" automatically resolve to "/order.html"
    // No modification needed - let the browser handle it naturally
    console.log('Navigation: Using base href="/" for root-relative links');
  }

  // Handle internal navigation without page reload (optional)
  function initNavigation() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      // Skip external links, anchors, etc.
      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:') || 
          href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      
      // Allow default navigation for now (let the browser handle it)
      // This ensures all links work normally
    });
  }

  // Set active class on current page link
  function setActiveLinks() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('.nav-links a, .footer-column a');
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPage) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Handle mobile menu closing after link click
  function closeMobileMenuOnClick() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    
    if (!mobileMenuBtn || !navLinks) return;
    
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
      });
    });
  }

  // Fix any broken images
  function fixBrokenImages() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      img.onerror = function() {
        if (!this.src.includes('via.placeholder.com')) {
          this.src = 'https://via.placeholder.com/300x200?text=Image+Not+Found';
        }
      };
    });
  }

  // Handle back/forward browser navigation
  function handleBrowserNavigation() {
    window.addEventListener('popstate', () => {
      setActiveLinks();
    });
  }

  // Initialize everything when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    fixAllLinks();
    initNavigation();
    setActiveLinks();
    closeMobileMenuOnClick();
    fixBrokenImages();
    handleBrowserNavigation();
    
    console.log('Navigation initialized - all links are relative and working');
  });

  // Expose functions globally
  window.Navigation = {
    getBaseUrl,
    navigateTo,
    fixAllLinks,
    setActiveLinks
  };
})();