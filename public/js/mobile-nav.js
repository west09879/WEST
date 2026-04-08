// mobile-nav.js - Ensures all links work on mobile devices

(function() {
  // Get the current host and protocol
  const currentHost = window.location.host;
  const currentProtocol = window.location.protocol;
  
  // Function to ensure all links work on mobile devices
  function fixMobileLinks() {
    // With <base href="/">, all relative links automatically resolve from root
    // No modification needed - let the browser handle navigation naturally
    console.log('Mobile nav: Using base href="/" for consistent link resolution');
  }
  
  // Function to handle mobile menu
  function initMobileMenu() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    
    if (mobileBtn && navLinks) {
      mobileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.classList.toggle('active');
      });
      
      // Close menu when clicking a link
      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('active');
        });
      });
    }
  }
  
  // Function to set active link based on current page
  function setActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-links a, .footer-column a');
    
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPage) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
  
  // Function to handle back button navigation
  function handleBackNavigation() {
    window.addEventListener('pageshow', () => {
      setActiveLink();
    });
  }
  
  // Debug function to log current URL
  function logCurrentUrl() {
    console.log('Current URL:', window.location.href);
    console.log('Pathname:', window.location.pathname);
    console.log('Host:', window.location.host);
  }
  
  // Run when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    fixMobileLinks();
    initMobileMenu();
    setActiveLink();
    handleBackNavigation();
    logCurrentUrl();
  });
})();