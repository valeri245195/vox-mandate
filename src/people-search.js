(() => {
  const API = window.location.origin;
  const state = { lastMode: null, timer: null };

  const css = `
    .username-discovery { margin: 14px 0 18px; padding: 18px; border: 1px solid #dfe5ec; border-radius: 14px; background: #fff; }
    .username-discovery .ud-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: .12em; color: #7c8796; margin-bottom: 5px; }
    .username-discovery h3 { margin: 0 0 4px; font-size: 17px; }
    .username-discovery p { margin: 0 0 12px; color: #718096; font-size: 12px; }
    .ud-search-row { display: flex; gap: 8px; }
    .ud-search-row input { flex: 1; min-width: 0; height: 40px; border: 1px solid #d7dee7; border-radius: 10px; padding: 0 12px; font: inherit; outline: none; }
    .ud-search-row input:focus { border-color: #182330; }
    .ud-search-row button, .ud-action { border: 0; border-radius: 9px; padding: 0 14px; min-height: 40px; font-weight: 700; cursor: pointer; }
    .ud-search-row button { background: #182330; color: #fff; }
    .ud-results { display: grid; gap: 8px; margin-top: 12px; }
    .ud-person { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid #e4e8ee; border-radius: 11px; }
    .ud-avatar { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: #edf1f5; color: #17212d; font-size: 11px; font-weight: 800; flex: 0 0 auto; }
    .ud-person-main { min-width: 0; flex: 1; }
    .ud-person-main strong, .ud-person-main span { display: block; }
    .ud-person-main strong { font-size: 13px; }
    .ud-person-main span { font-size: 11px; color: #748092; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ud-actions { display: flex; gap: 6px; }
    .ud-action.primary { background: #182330; color: white; }
    .ud-action.secondary { background: #eef2f6; color: #263241; }
    .ud-status { margin-top: 9px; font-size: 11px; color: #667384; }
    .ud-modal-backdrop { position: fixed; inset: 0; background: rgba(11,18,27,.35); display: grid; place-items: center; z-index: 99999; padding: 20px; }
    .ud-modal { width: min(500px, 100%); background: white; border-radius: 16px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .ud-modal h3 { margin: 0 0 4px; }
    .ud-modal small { color: #758195; }
    .ud-modal textarea { width: 100%; box-sizing: border-box; margin: 14px 0; min-height: 120px; resize: vertical; border: 1px solid #d7dee7; border-radius: 10px; padding: 12px; font: inherit; }
    .ud-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function token() { return localStorage.getItem('vox_token') || ''; }
  function initials(name) { return (name || 'VU').split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase(); }

  async function searchUsers(q, root) {
    const status = root.querySelector('.ud-status');
    const results = root.querySelector('.ud-results');
    if (!q || q.length < 2) { results.innerHTML = ''; status.textContent = 'Enter at least 2 characters.'; return; }
    status.textContent = 'Searching…'; results.innerHTML = '';
    try {
      const r = await fetch(`${API}/api/people/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Search failed.');
      status.textContent = data.people.length ? `${data.people.length} result${data.people.length === 1 ? '' : 's'}` : 'No users found.';
      data.people.forEach(person => results.appendChild(personCard(person)));
    } catch (e) { status.textContent = e.message || 'Search failed.'; }
  }

  function personCard(person) {
    const row = document.createElement('div'); row.className = 'ud-person';
    const avatar = document.createElement('div'); avatar.className = 'ud-avatar'; avatar.textContent = initials(person.name);
    const main = document.createElement('div'); main.className = 'ud-person-main';
    const name = document.createElement('strong'); name.textContent = person.name;
    const info = document.createElement('span'); info.textContent = `@${person.handle} · ${person.type}${person.city ? ` · ${person.city}` : ''}`;
    main.append(name, info);
    const actions = document.createElement('div'); actions.className = 'ud-actions';
    const add = document.createElement('button'); add.className = 'ud-action primary'; add.textContent = 'Add friend';
    add.onclick = async () => {
      add.disabled = true; add.textContent = 'Sending…';
      try {
        const r = await fetch(`${API}/api/people/friends/request`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body:JSON.stringify({ userId: person.id }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Unable to send request.');
        add.textContent = 'Request sent';
      } catch (e) { add.disabled = false; add.textContent = 'Add friend'; alert(e.message); }
    };
    const msg = document.createElement('button'); msg.className = 'ud-action secondary'; msg.textContent = 'Write';
    msg.onclick = () => openMessageModal(person);
    actions.append(add, msg); row.append(avatar, main, actions); return row;
  }

  function openMessageModal(person) {
    const backdrop = document.createElement('div'); backdrop.className = 'ud-modal-backdrop';
    const modal = document.createElement('div'); modal.className = 'ud-modal';
    const title = document.createElement('h3'); title.textContent = `Message @${person.handle}`;
    const sub = document.createElement('small'); sub.textContent = person.name;
    const area = document.createElement('textarea'); area.placeholder = 'Write a message…';
    const actions = document.createElement('div'); actions.className = 'ud-modal-actions';
    const cancel = document.createElement('button'); cancel.className = 'ud-action secondary'; cancel.textContent = 'Cancel'; cancel.onclick = () => backdrop.remove();
    const send = document.createElement('button'); send.className = 'ud-action primary'; send.textContent = 'Send';
    send.onclick = async () => {
      const text = area.value.trim(); if (!text) return;
      send.disabled = true; send.textContent = 'Sending…';
      try {
        const r = await fetch(`${API}/api/people/message`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body:JSON.stringify({ userId: person.id, text }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Unable to send message.');
        send.textContent = 'Sent'; area.disabled = true; setTimeout(() => backdrop.remove(), 500);
      } catch (e) { send.disabled = false; send.textContent = 'Send'; alert(e.message); }
    };
    actions.append(cancel, send); modal.append(title, sub, area, actions); backdrop.appendChild(modal);
    backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };
    document.body.appendChild(backdrop); area.focus();
  }

  function install() {
    const page = document.querySelector('.contacts-page');
    if (!page) return;
    const tabs = page.querySelector('.contact-content-tabs');
    if (!tabs) return;
    const buttons = [...tabs.querySelectorAll('button')];
    const friends = buttons.find(b => b.textContent.trim() === 'Friends');
    if (!friends) return;
    const mode = friends.classList.contains('active') ? 'friends' : 'politicians';
    let box = page.querySelector('.username-discovery');
    if (mode !== 'friends') { if (box) box.remove(); state.lastMode = mode; return; }
    if (box) return;
    box = document.createElement('section'); box.className = 'username-discovery';
    box.innerHTML = `<div class="ud-eyebrow">TEMPORARY FRIEND SEARCH</div><h3>Find someone by username</h3><p>Search by @username or name. Then send a friend request or write a message.</p><div class="ud-search-row"><input placeholder="@username" autocomplete="off"><button>Search</button></div><div class="ud-status"></div><div class="ud-results"></div>`;
    const input = box.querySelector('input'); const button = box.querySelector('button');
    const run = () => searchUsers(input.value.trim().replace(/^@/, ''), box);
    button.onclick = run; input.onkeydown = e => { if (e.key === 'Enter') run(); };
    tabs.insertAdjacentElement('afterend', box);
  }

  const observer = new MutationObserver(() => { clearTimeout(state.timer); state.timer = setTimeout(install, 50); });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setTimeout(install, 1000);
})();
