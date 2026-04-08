// order.js - Complete order functionality

(function() {
  // Show logged-in bar if authenticated
  if (window.API && API.getCustomer) {
    const customer = API.getCustomer();
    if (customer && customer.name) {
      const bar = document.getElementById('logged-in-bar');
      if (bar) bar.style.display = 'flex';
      const loggedInName = document.getElementById('logged-in-name');
      if (loggedInName) {
        loggedInName.textContent = `Welcome back, ${customer.name.split(' ')[0]}! Your orders are saved to your account.`;
      }
      const navAccount = document.getElementById('nav-account');
      if (navAccount) {
        navAccount.href = 'customer-dashboard.html';
        navAccount.innerHTML = '<i class="fas fa-tachometer-alt"></i> Dashboard';
      }
      const customerName = document.getElementById('customerName');
      if (customerName) customerName.value = customer.name;
      const customerEmail = document.getElementById('customerEmail');
      if (customerEmail) customerEmail.value = customer.email;
    }
  }

  // Configuration
  const config = {
    prices: {
      size: { small: 1500, medium: 2800, large: 4200 },
      tiers: { '4-inch': 1800, '6-inch': 2500, '8-inch': 3800, '10-inch': 5500 },
      features: { flowers: 500, figurines: 800, 'edible-image': 400, sparklers: 300 },
      dietary: { eggless: 500, glutenfree: 800, sugarfree: 600, vegan: 700 },
      topper: { none: 0, standard: 300, 'custom-name': 500, figure: 800 },
      urgency: { standard: 0, express: 0.20, 'same-day': 0.50 }
    },
    wa: { number: '254727205660', name: 'BeFo Bakers' }
  };

  // State
  let state = {
    hasCustomDesign: false,
    uploadedImageUrl: null,
    isMultiTier: false,
    mpesaCodeVerified: false,
    orderId: '',
    baseCakePrice: 0,
    fromGallery: false
  };

  // Helper functions
  function $(id) { return document.getElementById(id); }

  function updateSummary() {
    // Get cake type
    const cakeType = $('cakeType');
    const summaryCakeType = $('summaryCakeType');
    if (summaryCakeType && cakeType) {
      summaryCakeType.textContent = cakeType.value ? cakeType.options[cakeType.selectedIndex].text : 'Not selected';
    }

    // Update cake preview image - REMOVED/COMMENTED OUT to prevent errors since cakeImages config no longer exists
    // if (cakeType && cakeType.value && !state.fromGallery && config.cakeImages[cakeType.value]) {
    //   const cakePreview = $('cakePreview');
    //   if (cakePreview) {
    //     cakePreview.innerHTML = `<img src="${config.cakeImages[cakeType.value]}" alt="${cakeType.value}" style="width:100%;height:100%;object-fit:cover">`;
    //   }
    // }

    // Get filling
    const cakeFilling = $('cakeFilling');
    const summaryFilling = $('summaryFilling');
    if (summaryFilling && cakeFilling) {
      summaryFilling.textContent = cakeFilling.value ? cakeFilling.options[cakeFilling.selectedIndex].text : 'Not selected';
    }

    // Calculate base price
    let basePrice = state.baseCakePrice;
    const summarySize = $('summarySize');

    if (state.isMultiTier) {
      let tp = 0, tDesc = [];
      const tierSelectors = document.querySelectorAll('.tier-selector');
      tierSelectors.forEach(s => {
        if (s.value !== 'none') {
          tp += config.prices.tiers[s.value];
          tDesc.push(s.options[s.selectedIndex].text.split(' - ')[0]);
        }
      });
      if (!state.baseCakePrice) basePrice = tp;
      if (summarySize) summarySize.textContent = tDesc.length ? tDesc.join(' + ') : 'No tiers';
    } else {
      let selSize = null;
      const cakeSizes = document.querySelectorAll('input[name=cakeSize]');
      cakeSizes.forEach(r => { if (r.checked) selSize = r; });
      if (selSize) {
        if (!state.baseCakePrice) basePrice = config.prices.size[selSize.value];
        if (summarySize) summarySize.textContent = selSize.nextElementSibling.textContent.split(' - ')[0];
      } else {
        if (summarySize) summarySize.textContent = 'Not selected';
      }
    }

    state.baseCakePrice = basePrice;

    // Get icing
    let icing = '';
    const icingTypes = document.querySelectorAll('input[name=icingType]');
    icingTypes.forEach(r => { if (r.checked) icing = r.nextElementSibling.textContent; });
    const summaryIcing = $('summaryIcing');
    if (summaryIcing) summaryIcing.textContent = icing || 'Not selected';

    // Get dietary
    const dietary = [];
    const dietaryOpts = document.querySelectorAll('input[name=dietary]');
    dietaryOpts.forEach(c => { if (c.checked) dietary.push(c.nextElementSibling.textContent.split(' (+')[0]); });
    const summaryDietary = $('summaryDietary');
    if (summaryDietary) summaryDietary.textContent = dietary.length ? dietary.join(', ') : 'None';

    // Get features
    const features = [];
    const featureOpts = document.querySelectorAll('input[name=features]');
    featureOpts.forEach(c => { if (c.checked) features.push(c.nextElementSibling.textContent.split(' (+')[0]); });
    const summaryFeatures = $('summaryFeatures');
    if (summaryFeatures) summaryFeatures.textContent = features.length ? features.join(', ') : 'None';

    // Get urgency
    let urg = 'standard';
    const urgencyOpts = document.querySelectorAll('input[name=urgency]');
    urgencyOpts.forEach(r => {
      if (r.checked) {
        urg = r.value;
        const summaryUrgency = $('summaryUrgency');
        if (summaryUrgency) summaryUrgency.textContent = r.nextElementSibling.textContent.split(' -')[0];
      }
    });

    // Show/hide urgency warning
    const urgencyWarning = $('urgencyWarning');
    const warningText = $('warningText');
    if (urg === 'express') {
      if (urgencyWarning) urgencyWarning.style.display = 'block';
      if (warningText) warningText.textContent = 'Express orders require phone confirmation within 30 minutes.';
    } else if (urg === 'same-day') {
      if (urgencyWarning) urgencyWarning.style.display = 'block';
      if (warningText) warningText.textContent = 'Same-day orders subject to availability. We will call immediately.';
    } else {
      if (urgencyWarning) urgencyWarning.style.display = 'none';
    }

    // Get topper
    let tp = 'none';
    const topperOpts = document.querySelectorAll('input[name=topper]');
    topperOpts.forEach(r => { if (r.checked) tp = r.value; });
    const topMap = { none: 'No topper', standard: '"Happy Birthday"', 'custom-name': 'Custom name', figure: 'Figure topper' };
    const customName = $('customName');
    const summaryTopper = $('summaryTopper');
    if (summaryTopper) {
      if (tp === 'custom-name' && customName && customName.value) {
        summaryTopper.textContent = `Custom: "${customName.value}"`;
      } else {
        summaryTopper.textContent = topMap[tp] || 'No topper';
      }
    }

    // Get M-Pesa code
    const mpesaCode = $('mpesaCode');
    const summaryMpesaCode = $('summaryMpesaCode');
    if (summaryMpesaCode && mpesaCode) {
      summaryMpesaCode.textContent = mpesaCode.value ? `${mpesaCode.value} (${state.mpesaCodeVerified ? 'Verified' : 'Pending'})` : 'Not provided';
    }

    // Get delivery date
    const deliveryDate = $('deliveryDate');
    const summaryDate = $('summaryDate');
    if (summaryDate && deliveryDate) {
      summaryDate.textContent = deliveryDate.value ? new Date(deliveryDate.value).toLocaleDateString('en-KE') : 'Not selected';
    }

    // Get customer name
    const customerName = $('customerName');
    const summaryName = $('summaryName');
    if (summaryName && customerName) {
      summaryName.textContent = customerName.value || 'Not provided';
    }

    // Calculate extras
    let featP = 0;
    const featuresChecked = document.querySelectorAll('input[name=features]:checked');
    featuresChecked.forEach(c => { featP += config.prices.features[c.value] || 0; });

    let dietP = 0;
    const dietaryChecked = document.querySelectorAll('input[name=dietary]:checked');
    dietaryChecked.forEach(c => { dietP += config.prices.dietary[c.value] || 0; });

    let topP = 0;
    const topperChecked = document.querySelector('input[name=topper]:checked');
    if (topperChecked) topP = config.prices.topper[topperChecked.value] || 0;

    // Calculate total
    const base = (basePrice || 0) + featP + dietP + topP;
    const surcharge = base * (config.prices.urgency[urg] || 0);
    const total = base + surcharge;
    const totalPriceEl = $('totalPrice');
    if (totalPriceEl) {
      totalPriceEl.innerHTML = `KSh ${total.toLocaleString()}`;
      if (surcharge > 0) {
        totalPriceEl.innerHTML += ` <small style="color:#f44336">(+${(config.prices.urgency[urg] * 100).toFixed(0)}% urgency)</small>`;
      }
    }
  }

  // Initialize date picker
  function initDate() {
    const today = new Date();
    const min = new Date(today);
    min.setDate(today.getDate() + 2);
    const max = new Date(today);
    max.setMonth(today.getMonth() + 3);
    const deliveryDate = $('deliveryDate');
    if (deliveryDate) {
      deliveryDate.min = min.toISOString().split('T')[0];
      deliveryDate.max = max.toISOString().split('T')[0];
    }
  }

  // Handle auto-fill from gallery
  function initAutoFill() {
    const saved = localStorage.getItem('selectedCakeOrder');
    if (!saved) return;
    try {
      const { cake } = JSON.parse(saved);
      const banner = $('autoFillBanner');
      if (banner) banner.classList.add('visible');
      const bannerCakeImage = $('bannerCakeImage');
      if (bannerCakeImage && cake.image) bannerCakeImage.src = cake.image;
      const bannerCakeTitle = $('bannerCakeTitle');
      if (bannerCakeTitle) bannerCakeTitle.textContent = cake.title;
      const cakePreview = $('cakePreview');
      if (cakePreview && cake.image) {
        cakePreview.innerHTML = `<img src="${cake.image}" alt="${cake.title}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`;
      }
      const designPreview = $('designPreview');
      if (designPreview) designPreview.style.display = 'block';
      const cakeSelectionText = $('cakeSelectionText');
      if (cakeSelectionText) cakeSelectionText.innerHTML = `<strong>${cake.title}</strong>`;
      state.fromGallery = true;
      if (cake.orderData) {
        if (cake.orderData.cakeType) {
          const ct = $('cakeType');
          if (ct) ct.value = cake.orderData.cakeType;
        }
        if (cake.orderData.cakeFilling) {
          const cf = $('cakeFilling');
          if (cf) cf.value = cake.orderData.cakeFilling;
        }
        if (cake.orderData.icingType) {
          const r = document.querySelector(`input[name=icingType][value="${cake.orderData.icingType}"]`);
          if (r) r.checked = true;
        }
        if (cake.orderData.cakeSize && !cake.orderData.isMultiTier) {
          const r = document.querySelector(`input[name=cakeSize][value="${cake.orderData.cakeSize}"]`);
          if (r) r.checked = true;
        }
        if (cake.orderData.price) state.baseCakePrice = cake.orderData.price;
      }
      updateSummary();
    } catch (e) {
      console.error('Auto-fill error:', e);
    }
  }

  // Validate form
  function validateForm() {
    const customerName = $('customerName');
    const customerPhone = $('customerPhone');
    const cakeType = $('cakeType');
    const cakeFilling = $('cakeFilling');
    
    if (!customerName || !customerName.value) {
      alert('Please enter your name');
      return false;
    }
    if (!customerPhone || !customerPhone.value) {
      alert('Please enter your phone number');
      return false;
    }
    if (!cakeType || !cakeType.value) {
      alert('Please select a cake type');
      return false;
    }
    if (!cakeFilling || !cakeFilling.value) {
      alert('Please select a cake filling');
      return false;
    }
    
    let sizeOk = state.isMultiTier ? 
      [...document.querySelectorAll('.tier-selector')].some(s => s.value !== 'none') : 
      [...document.querySelectorAll('input[name=cakeSize]')].some(r => r.checked);
    if (!sizeOk) {
      alert('Please select a cake size');
      return false;
    }
    
    const selTop = document.querySelector('input[name=topper]:checked')?.value;
    const customName = $('customName');
    if (selTop === 'custom-name' && (!customName || !customName.value.trim())) {
      alert('Please enter custom topper text');
      return false;
    }
    
    const termsAgree = $('terms-agree');
    const depositAgree = $('deposit-agree');
    if (!termsAgree || !termsAgree.checked) {
      alert('Please agree to the terms and conditions');
      return false;
    }
    if (!depositAgree || !depositAgree.checked) {
      alert('Please acknowledge the deposit requirement');
      return false;
    }
    
    return true;
  }

  // Prepare order data
  function prepareOrderData() {
    const totalPriceEl = $('totalPrice');
    const totalRaw = totalPriceEl ? totalPriceEl.textContent.replace(/[^0-9.]/g, '') : '0';
    const total = parseFloat(totalRaw) || 0;
    
    const cakeType = $('cakeType');
    const cakeFilling = $('cakeFilling');
    const cakeDesc = [
      cakeType ? cakeType.options[cakeType.selectedIndex]?.text : '',
      cakeFilling ? cakeFilling.options[cakeFilling.selectedIndex]?.text : '',
      'Cake'
    ].filter(Boolean).join(' ');
    
    const customerName = $('customerName');
    const customerEmail = $('customerEmail');
    const customerPhone = $('customerPhone');
    const deliveryDate = $('deliveryDate');
    const deliveryAddress = $('deliveryAddress');
    const specialInstructions = $('specialInstructions');
    const mpesaCode = $('mpesaCode');
    const summaryDietary = $('summaryDietary');
    const summaryFeatures = $('summaryFeatures');
    const summaryIcing = $('summaryIcing');
    const summaryTopper = $('summaryTopper');
    const summaryUrgency = $('summaryUrgency');
    
    return {
      customerName: customerName ? customerName.value.trim() : '',
      email: customerEmail ? customerEmail.value.trim() || `guest-${Date.now()}@befobakers.com` : `guest-${Date.now()}@befobakers.com`,
      phone: customerPhone ? customerPhone.value.trim() : '',
      items: [{
        id: Date.now(),
        title: cakeDesc,
        price: total,
        qty: 1
      }],
      deliveryDate: deliveryDate ? deliveryDate.value || null : null,
      deliveryAddress: deliveryAddress ? deliveryAddress.value.trim() || null : null,
      specialInstructions: [
        specialInstructions ? specialInstructions.value.trim() : '',
        summaryDietary && summaryDietary.textContent !== 'None' ? `Dietary: ${summaryDietary.textContent}` : '',
        summaryFeatures && summaryFeatures.textContent !== 'None' ? `Features: ${summaryFeatures.textContent}` : '',
        summaryIcing ? `Icing: ${summaryIcing.textContent}` : '',
        summaryTopper ? `Topper: ${summaryTopper.textContent}` : '',
        summaryUrgency ? `Urgency: ${summaryUrgency.textContent}` : '',
        mpesaCode && mpesaCode.value ? `M-Pesa: ${mpesaCode.value} (${state.mpesaCodeVerified ? 'Verified' : 'Pending'})` : ''
      ].filter(Boolean).join(' | ') || null
    };
  }

  // Generate order ID
  function generateOrderId() {
    const d = new Date();
    return `BF${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Format WhatsApp message
  function formatWhatsApp(od) {
    const now = new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `🎂 *${config.wa.name.toUpperCase()} — ORDER CONFIRMATION* 🎂\n\n📋 *ORDER DETAILS*\nOrder ID: ${state.orderId}\nDate: ${now}\nCustomer: ${od.customerName}\nPhone: ${od.phone}\n${od.email ? `Email: ${od.email}\n` : ''}\n🍰 *CAKE SPECIFICATIONS*\n${od.items[0]?.title || 'Custom Cake'}\n${od.specialInstructions ? `\n📝 ${od.specialInstructions}` : ''}\n\n💰 Total: KSh ${Number(od.items[0]?.price || 0).toLocaleString()}\n🚚 Delivery: ${od.deliveryDate || 'Pickup'}\n${od.deliveryAddress ? `📍 ${od.deliveryAddress}` : '📍 Bakery Pickup'}\n\n---\n📞 We will call you within 2 hours to confirm\n\n*Thank you for choosing ${config.wa.name}!* 🌟`;
  }

  // Send WhatsApp message
  function sendWhatsApp(msg, phone = null) {
    let num = config.wa.number;
    if (phone) {
      let n = phone.replace(/\D/g, '');
      if (n.startsWith('0')) n = '254' + n.slice(1);
      if (!n.startsWith('254')) n = '254' + n;
      if (n.length === 12) num = n;
    }
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Submit order
  async function submitOrder(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const orderBtn = $('orderBtn');
    if (orderBtn) {
      orderBtn.disabled = true;
      orderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating order...';
    }

    const orderData = prepareOrderData();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (window.API && API.getAccess) {
        const access = API.getAccess();
        if (access) headers['Authorization'] = `Bearer ${access}`;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(orderData)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const result = await res.json();
      const orderId = result.order.id;
      const totalAmount = result.order.total;

      // Redirect to M-Pesa payment page
      window.location.href = `/mpesa-payment.html?orderId=${orderId}&amount=${totalAmount}`;

    } catch (err) {
      console.error('Order error:', err);
      alert(`Failed to place order: ${err.message}. Please try again.`);
      if (orderBtn) {
        orderBtn.disabled = false;
        orderBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Place Order & Pay';
      }
    }
  }

  // Event listeners
  function initEventListeners() {
    // Tier toggle
    const tierToggle = $('tierToggle');
    if (tierToggle) {
      tierToggle.addEventListener('click', (e) => {
        if (!e.target.classList.contains('toggle-option')) return;
        document.querySelectorAll('.toggle-option').forEach(o => o.classList.remove('active'));
        e.target.classList.add('active');
        state.isMultiTier = e.target.dataset.tier === 'multi';
        const singleTier = $('singleTierDetails');
        const multiTier = $('multiTierDetails');
        if (singleTier) singleTier.classList.toggle('active', !state.isMultiTier);
        if (multiTier) multiTier.classList.toggle('active', state.isMultiTier);
        const summaryCakeStyle = $('summaryCakeStyle');
        if (summaryCakeStyle) summaryCakeStyle.textContent = state.isMultiTier ? 'Multi-Tier' : 'Single Tier';
        updateSummary();
      });
    }

    // Form inputs
    const cakeType = $('cakeType');
    if (cakeType) cakeType.addEventListener('change', updateSummary);
    const cakeFilling = $('cakeFilling');
    if (cakeFilling) cakeFilling.addEventListener('change', updateSummary);
    const mpesaCode = $('mpesaCode');
    if (mpesaCode) mpesaCode.addEventListener('input', updateSummary);
    const customName = $('customName');
    if (customName) customName.addEventListener('input', updateSummary);
    const customerName = $('customerName');
    if (customerName) customerName.addEventListener('input', updateSummary);
    const deliveryDate = $('deliveryDate');
    if (deliveryDate) deliveryDate.addEventListener('change', updateSummary);
    
    const cakeSizes = document.querySelectorAll('input[name=cakeSize]');
    cakeSizes.forEach(r => r.addEventListener('change', updateSummary));
    const icingTypes = document.querySelectorAll('input[name=icingType]');
    icingTypes.forEach(r => r.addEventListener('change', updateSummary));
    const dietaryOpts = document.querySelectorAll('input[name=dietary]');
    dietaryOpts.forEach(c => c.addEventListener('change', updateSummary));
    const featureOpts = document.querySelectorAll('input[name=features]');
    featureOpts.forEach(c => c.addEventListener('change', updateSummary));
    const urgencyOpts = document.querySelectorAll('input[name=urgency]');
    urgencyOpts.forEach(r => r.addEventListener('change', updateSummary));
    const topperOpts = document.querySelectorAll('input[name=topper]');
    topperOpts.forEach(r => {
      r.addEventListener('change', (e) => {
        const customNameField = $('customNameField');
        if (customNameField) {
          customNameField.style.display = e.target.value === 'custom-name' ? 'block' : 'none';
        }
        updateSummary();
      });
    });
    
    const tierSelectors = document.querySelectorAll('.tier-selector');
    tierSelectors.forEach(s => s.addEventListener('change', updateSummary));
    
    const verifyCodeBtn = $('verifyCode');
    if (verifyCodeBtn) {
      verifyCodeBtn.addEventListener('click', () => {
        const code = $('mpesaCode');
        if (!code) return;
        if (code.value.trim() && code.value.trim().length === 10) {
          state.mpesaCodeVerified = true;
          verifyCodeBtn.innerHTML = '<i class="fas fa-check"></i> Verified';
          verifyCodeBtn.style.backgroundColor = '#00a900';
          updateSummary();
        } else {
          alert('Please enter a valid 10-character M-Pesa code');
        }
      });
    }
    
    const uploadButton = $('uploadButton');
    if (uploadButton) {
      uploadButton.addEventListener('click', () => {
        const customImageInput = $('customImageInput');
        if (customImageInput) customImageInput.click();
      });
    }
    
    const customImageInput = $('customImageInput');
    if (customImageInput) {
      customImageInput.addEventListener('change', (e) => {
        if (!e.target.files.length) return;
        const file = e.target.files[0];
        if (file.size > 5 * 1024 * 1024) {
          alert('File too large. Max 5MB.');
          return;
        }
        state.uploadedImageUrl = URL.createObjectURL(file);
        const uploadedImage = $('uploadedImage');
        if (uploadedImage) uploadedImage.src = state.uploadedImageUrl;
        const uploadedFileName = $('uploadedFileName');
        if (uploadedFileName) uploadedFileName.textContent = file.name;
        const uploadedImageContainer = $('uploadedImageContainer');
        if (uploadedImageContainer) uploadedImageContainer.style.display = 'block';
        state.hasCustomDesign = true;
        const designPreview = $('designPreview');
        if (designPreview) designPreview.style.display = 'block';
        updateSummary();
      });
    }
    
    const removeImageBtn = $('removeImageBtn');
    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', () => {
        if (state.uploadedImageUrl) URL.revokeObjectURL(state.uploadedImageUrl);
        const uploadedImageContainer = $('uploadedImageContainer');
        if (uploadedImageContainer) uploadedImageContainer.style.display = 'none';
        const customImageInput = $('customImageInput');
        if (customImageInput) customImageInput.value = '';
        state.hasCustomDesign = false;
        const designPreview = $('designPreview');
        if (designPreview) designPreview.style.display = 'none';
        updateSummary();
      });
    }
    
    const clearSelectionBtn = $('clearSelectionBtn');
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', () => {
        localStorage.removeItem('selectedCakeOrder');
        location.reload();
      });
    }
    
    const orderBtn = $('orderBtn');
    if (orderBtn) {
      orderBtn.addEventListener('click', submitOrder);
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initDate();
    initAutoFill();
    initEventListeners();
    updateSummary();
    console.log('Order page initialized');
  });
})();