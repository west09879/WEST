document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('item');
  let item = null;
  if (id) {
    try {
      const res = await fetch('/api/gallery/' + id);
      if (res.ok) item = await res.json();
    } catch (e) { console.error(e); }
  }
  if (!item && localStorage.getItem('selectedCake')) item = JSON.parse(localStorage.getItem('selectedCake'));
  if (item) showQuickOrder(item);

  function showQuickOrder(item) {
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.right = '20px';
    panel.style.bottom = '20px';
    panel.style.background = 'white';
    panel.style.padding = '15px';
    panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    panel.style.borderRadius = '8px';
    panel.style.zIndex = 9999;
    panel.innerHTML = `
      <strong>Quick Order: ${item.title}</strong>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input id="qoName" placeholder="Your name" style="padding:8px;flex:1" />
        <input id="qoEmail" placeholder="Email" style="padding:8px;flex:1" />
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input id="qoQty" type="number" value="1" min="1" style="width:80px;padding:8px" />
        <button id="qoSubmit" style="padding:8px 12px">Place Order</button>
        <button id="qoClose" style="padding:8px 12px">Close</button>
      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('qoClose').addEventListener('click', () => panel.remove());
    document.getElementById('qoSubmit').addEventListener('click', async () => {
      const name = document.getElementById('qoName').value.trim();
      const email = document.getElementById('qoEmail').value.trim();
      const qty = Number(document.getElementById('qoQty').value) || 1;
      if (!name || !email) return alert('Please provide name and email');
      const items = [{ id: item.id, title: item.title, price: item.price || 0, qty }];
      const total = (item.price || 0) * qty;
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName: name, email, items, total })
        });
        if (res.status === 201) {
          alert('Order placed — thank you!');
          panel.remove();
        } else {
          const err = await res.json();
          alert('Failed: ' + (err.error || res.statusText));
        }
      } catch (e) { alert('Error: ' + e.message); }
    });
  }
});