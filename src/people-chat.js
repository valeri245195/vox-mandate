(() => {
  const API = window.location.origin;
  const injectedStyle = document.createElement('style');
  injectedStyle.textContent = `
    .people-chat-overlay { position: fixed; left: 272px; top: 0; right: 0; bottom: 0; z-index: 100000; background: #fff; display: flex; flex-direction: column; }
    .people-chat-head { height: 76px; flex: 0 0 76px; border-bottom: 1px solid #e4e9ef; display:flex; align-items:center; justify-content:space-between; padding: 0 28px; box-sizing:border-box; background:#fff; }
    .people-chat-person { display:flex; align-items:center; gap:12px; min-width:0; }
    .people-chat-avatar { width:42px; height:42px; border-radius:50%; background:#edf1f5; display:grid; place-items:center; font-size:12px; font-weight:800; color:#17212d; }
    .people-chat-person strong, .people-chat-person span { display:block; }
    .people-chat-person span { font-size:12px; color:#7a8594; margin-top:2px; }
    .people-chat-close { border:1px solid #d7dee7; background:#fff; border-radius:10px; min-height:38px; padding:0 14px; font-weight:700; cursor:pointer; }
    .people-chat-body { flex:1; min-height:0; display:flex; justify-content:center; background:#f8fafc; }
    .people-chat-scroll { width:min(920px, 100%); overflow:auto; padding:28px 24px 120px; box-sizing:border-box; }
    .people-chat-note { max-width:680px; margin:0 auto 24px; background:#fff; border:1px solid #e1e7ee; border-radius:14px; padding:14px 16px; color:#617084; font-size:12px; }
    .people-chat-message { max-width:680px; margin:0 auto 12px; display:flex; }
    .people-chat-message.mine { justify-content:flex-end; }
    .people-chat-bubble { max-width:75%; padding:12px 14px; border-radius:14px; background:#eef2f6; color:#152231; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.45; }
    .people-chat-message.mine .people-chat-bubble { background:#182330; color:#fff; }
    .people-chat-time { margin-top:5px; font-size:10px; opacity:.65; text-align:right; }
    .people-chat-compose { border-top:1px solid #e3e8ee; background:#fff; padding:12px 18px; display:flex; gap:10px; align-items:flex-end; }
    .people-chat-compose textarea { flex:1; min-height:44px; max-height:150px; resize:none; border:1px solid #d7dee7; border-radius:12px; padding:11px 13px; box-sizing:border-box; font:inherit; outline:none; overflow-wrap:anywhere; }
    .people-chat-compose textarea:focus { border-color:#182330; }
    .people-chat-send { width:52px; height:44px; border:0; border-radius:11px; background:#182330; color:#fff; font-size:18px; cursor:pointer; }
    .people-chat-send:disabled { opacity:.55; cursor:default; }
    .people-chat-status { max-width:680px; margin:0 auto 12px; font-size:12px; color:#778393; }
    @media (max-width: 700px) {
      .people-chat-overlay { left: 0; }
      .people-chat-head { padding:0 14px; }
      .people-chat-scroll { padding-left:12px; padding-right:12px; }
      .people-chat-bubble { max-width:86%; }
    }
  `;
  document.head.appendChild(injectedStyle);

  const token = () => localStorage.getItem('vox_token') || '';
  const initials = (name) => (name || 'VU').split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();
  const escape = (value) => String(value ?? '').replace(/[&<>\"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));

  function now() {
    return new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  }

  async function sendRemote(person, text) {
    const response = await fetch(`${API}/api/people/message`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
      body: JSON.stringify({ handle: person.handle, text })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to send message.');
    return data;
  }

  function openChat(person) {
    if (!person.handle || document.querySelector('.people-chat-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'people-chat-overlay';
    const header = document.createElement('div');
    header.className = 'people-chat-head';
    header.innerHTML = `<div class="people-chat-person"><div class="people-chat-avatar">${escape(initials(person.name))}</div><div><strong>${escape(person.name)}</strong><span>@${escape(person.handle)} · ${escape(person.type || 'Vox Mandate user')}</span></div></div><button class="people-chat-close" type="button">Back to People</button>`;

    const body = document.createElement('div'); body.className = 'people-chat-body';
    const scroll = document.createElement('div'); scroll.className = 'people-chat-scroll';
    const note = document.createElement('div'); note.className = 'people-chat-note'; note.textContent = 'Direct conversation. Messages sent here are delivered to this user through Vox Mandate.';
    const status = document.createElement('div'); status.className = 'people-chat-status'; status.textContent = '';
    const messageList = document.createElement('div');
    const storedKey = `vox_dm_${person.handle}`;
    let localMessages = [];
    try { localMessages = JSON.parse(localStorage.getItem(storedKey) || '[]'); } catch { localMessages = []; }

    function renderMessages() {
      messageList.innerHTML = '';
      localMessages.forEach(m => {
        const row = document.createElement('div'); row.className = `people-chat-message ${m.mine ? 'mine' : ''}`;
        const bubble = document.createElement('div'); bubble.className = 'people-chat-bubble';
        bubble.innerHTML = `${escape(m.text)}<div class="people-chat-time">${escape(m.time)}</div>`;
        row.appendChild(bubble); messageList.appendChild(row);
      });
      requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
    }

    const compose = document.createElement('form'); compose.className = 'people-chat-compose';
    compose.innerHTML = `<textarea rows="1" placeholder="Write a message…"></textarea><button class="people-chat-send" type="submit">➤</button>`;
    const textarea = compose.querySelector('textarea');
    const send = compose.querySelector('.people-chat-send');

    compose.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = textarea.value.trim();
      if (!text || send.disabled) return;
      send.disabled = true; status.textContent = 'Sending…';
      try {
        await sendRemote(person, text);
        localMessages.push({ text, mine:true, time:now() });
        localStorage.setItem(storedKey, JSON.stringify(localMessages));
        textarea.value = '';
        textarea.style.height = '44px';
        status.textContent = 'Sent';
        renderMessages();
        setTimeout(() => { if (status) status.textContent = ''; }, 1000);
      } catch (error) {
        status.textContent = error.message || 'Unable to send message.';
      } finally { send.disabled = false; textarea.focus(); }
    });

    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); compose.requestSubmit(); }
    });
    textarea.addEventListener('input', () => { textarea.style.height = '44px'; textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px'; });

    scroll.append(note, status, messageList);
    body.appendChild(scroll);
    overlay.append(header, body, compose);
    document.body.appendChild(overlay);
    renderMessages();
    textarea.focus();

    header.querySelector('.people-chat-close').addEventListener('click', () => overlay.remove());
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.ud-action.secondary');
    if (!button || button.textContent.trim() !== 'Write') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const row = button.closest('.ud-person');
    if (!row) return;
    const info = row.querySelector('.ud-person-main span')?.textContent || '';
    const name = row.querySelector('.ud-person-main strong')?.textContent || 'Vox user';
    const handleMatch = info.match(/@([a-z0-9_]+)/i);
    const typeMatch = info.match(/·\s*([^·]+)(?:·|$)/);
    const handle = handleMatch ? handleMatch[1] : '';
    openChat({ name, handle, type: typeMatch ? typeMatch[1].trim() : 'Vox Mandate user' });
  }, true);
})();
