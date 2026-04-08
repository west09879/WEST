async function loadGallery() {
  try {
    const res = await fetch('/api/gallery');
    if (!res.ok) return;
    const items = await res.json();
    const maps = { wedding: 'weddingGrid', birthday: 'birthdayGrid', cultural: 'culturalGrid', other: 'otherGrid' };
    items.forEach(it => {
      const cat = (it.category || 'other').toLowerCase();
      const targetId = maps[cat] || 'otherGrid';
      const grid = document.getElementById(targetId);
      if (!grid) return;
      const card = document.createElement('div');
      card.className = 'cake-card';
      card.innerHTML = `
        <div class="cake-image"><img src="${it.imageUrl}" alt="${it.title}"></div>
        <div class="cake-details">
          <div class="cake-title">${it.title}</div>
          <p class="cake-description">${it.description || ''}</p>
          <div class="cake-price">KES ${it.price || 0}</div>
          <div class="cake-actions"><a class="btn btn-primary" href="order.html?item=${it.id}">Order Now</a></div>
        </div>`;
      grid.appendChild(card);
    });
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', loadGallery);
