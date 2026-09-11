import { io } from 'socket.io-client';

(() => {
  const API = window.location.origin;
  const style = document.createElement('style');
  style.textContent = `
    .people-chat-overlay { position: fixed; left: 318px; top: 0; right: 0; bottom: 0; z-index: 100000; background: #fff; display:flex; flex-direction:column; }
    .people-chat-head { height:76px; flex:0 0 76px; border-bottom:1px solid #e4e9ef; display:flex; align-items:center; justify-content:space-between; padding:0 28px; background:#fff; }
    .people-chat-person { display:flex; align-items:center; gap:12px; min-width:0; }
    .people-chat-avatar { width:42px; height:42px; border-radius:50%; background:#edf1f5; display:grid; place-items:center; font-size:12px; font-weight:800; color:#17212d; }
    .people-chat-person strong,.people-chat-person span { display:block; }
    .people-chat-person span { font-size:12px; color:#7a8594; margin-top:2px; }
    .people-chat-close { border:1px solid #d7dee7; background:#fff; border-radius:10px; min-height:38px; padding:0 14px; font-weight:700; cursor:pointer; }
    .people-chat-body { flex:1; min-height:0; display:flex; justify-content:center; background:#f8fafc; }
    .people-chat-scroll { width:min(920px,100%); overflow:auto; padding:28px 24px 120px; box-sizing:border-box; }
    .people-chat-note { max-width:680px; margin:0 auto 24px; background:#fff; border:1px solid #e1e7ee; border-radius:14px; padding:14px 16px; color:#617084; font-size:12px; }
    .people-chat-message { max-width:680px; margin:0 auto 12px; display:flex; }
    .people-chat-message.mine { justify-content:flex-end; }
    .people-chat-bubble { max-width:75%; padding:12px 14px; border-radius:14px; background:#eef2f6; color:#152231; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.45; }
    .people-chat-message.mine .people-chat-bubble { background:#182330; color:#fff; }
    .people-chat-time { margin-top:5px; font-size:10px; opacity:.65; text-align:right; }
    .people-chat-compose { border-top:1px solid #e3e8ee; background:#fff; padding:12px 18px; display:flex; gap:10px; align-items:flex-end; }
    .people-chat-compose textarea { flex:1; min-height:44px; max-height:150px; resize:none; border:1px solid #d7dee7; border-radius:12px; padding:11px 13px; box-sizing:border-box; font:inherit; outline:none; overflow-wrap:anywhere; }
    .people-chat-send { width:52px; height:44px; border:0; border-radius:11px; background:#182330; color:#fff; font-size:18px; cursor:pointer; }
    .people-chat-send:disabled { opacity:.55; cursor:default; }
    .people-chat-status { max-width:680px; margin:0 auto 12px; font-size:12px; color:#778393; }
    .people-incoming-toast { position:fixed; right:22px; bottom:22px; z-index:100001; width:min(360px,calc(100vw - 32px)); background:#182330; color:#fff; border-radius:14px; box-shadow:0 12px 34px rgba(0,0,0,.22); padding:14px 16px; }
    .people-incoming-toast strong,.people-incoming-toast span { display:block; }
    .people-incoming-toast span { margin-top:4px; color:#d6dee7; font-size:12px; line-height:1.35; }
    .people-incoming-toast button { margin-top:10px; border:1px solid #44515f; background:#fff; color:#182330; border-radius:9px; padding:7px 10px; font-weight:700; cursor:pointer; }
    @media (max-width:700px) { .people-chat-overlay { left:0; } .people-chat-head{padding:0 14px;} .people-chat-scroll{padding-left:12px;padding-right:12px;} .people-chat-bubble{max-width:86%;} }
  `;
  document.head.appendChild(style);

  const token = () => localStorage.getItem('vox_token') || '';
  const profile = () => { try { return JSON.parse(localStorage.getItem('vox_profile') || '{}'); } catch { return {}; } };
  const initials = name => (name || 'VU').split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();
  const escape = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[ch]));
  const formatTime = iso => new Date(iso || Date.now()).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });

  const socket = io(API, { transports:['websocket','polling'] });
  const me = profile();
  if (me.id) socket.emit('identify', { userId: me.id });

  function showToast(message) {
    document.querySelector('.people-incoming-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'people-incoming-toast';
    const title = document.createElement('strong'); title.textContent = `New message from ${message.from?.name || 'Vox Mandate user'}`;
    const preview = document.createElement('span'); preview.textContent = message.text || '';
    const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open message';
    open.addEventListener('click', () => { toast.remove(); openChat(message.from); });
    toast.append(title, preview, open);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 9000);
  }

  async function getHistory(handle) {
    const r = await fetch(`${API}/api/people/messages/${encodeURIComponent(handle)}`, { headers:{ Authorization:`Bearer ${token()}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not load conversation.');
    return data.messages || [];
  }

  async function sendRemote(handle, text) {
    const r = await fetch(`${API}/api/people/message`, {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
      body:JSON.stringify({ handle, text })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Unable to send message.');
    return data.item;
  }

  async function openChat(person) {
    if (!person?.handle) return;
    document.querySelector('.people-chat-overlay')?.remove();

    const overlay = document.createElement('div'); overlay.className='people-chat-overlay';
    const header = document.createElement('div'); header.className='people-chat-head';
    header.innerHTML = `<div class="people-chat-person"><div class="people-chat-avatar">${escape(initials(person.name))}</div><div><strong>${escape(person.name || person.handle)}</strong><span>@${escape(person.handle)} · ${escape(person.type || 'Vox Mandate user')}</span></div></div><button class="people-chat-close" type="button">Back to People</button>`;
    const body = document.createElement('div'); body.className='people-chat-body';
    const scroll = document.createElement('div'); scroll.className='people-chat-scroll';
    const note = document.createElement('div'); note.className='people-chat-note'; note.textContent='Direct conversation. Messages are delivered live to the other account through Vox Mandate.';
    const status = document.createElement('div'); status.className='people-chat-status';
    const list = document.createElement('div');
    const form = document.createElement('form'); form.className='people-chat-compose';
    form.innerHTML='<textarea rows="1" placeholder="Write a message…"></textarea><button class="people-chat-send" type="submit">➤</button>';
    const textarea=form.querySelector('textarea'); const send=form.querySelector('.people-chat-send');
    let history=[];

    function render(){
      list.innerHTML='';
      history.forEach(m=>{
        const row=document.createElement('div'); row.className=`people-chat-message ${m.mine?'mine':''}`;
        const bubble=document.createElement('div'); bubble.className='people-chat-bubble';
        bubble.innerHTML=`${escape(m.text)}<div class="people-chat-time">${escape(formatTime(m.createdAt))}</div>`;
        row.appendChild(bubble); list.appendChild(row);
      });
      requestAnimationFrame(()=>scroll.scrollTop=scroll.scrollHeight);
    }

    scroll.append(note,status,list); body.appendChild(scroll); overlay.append(header,body,form); document.body.appendChild(overlay);
    header.querySelector('.people-chat-close').addEventListener('click',()=>overlay.remove());

    try { history=await getHistory(person.handle); render(); }
    catch(error){ status.textContent=error.message; }
    textarea.focus();

    form.addEventListener('submit', async event=>{
      event.preventDefault();
      const text=textarea.value.trim(); if(!text||send.disabled)return;
      send.disabled=true; status.textContent='Sending…';
      try {
        const item=await sendRemote(person.handle,text);
        history.push({ ...item, mine:true });
        textarea.value=''; textarea.style.height='44px'; status.textContent=''; render();
      } catch(error) { status.textContent=error.message || 'Unable to send message.'; }
      finally { send.disabled=false; textarea.focus(); }
    });
    textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
    textarea.addEventListener('input',()=>{textarea.style.height='44px';textarea.style.height=Math.min(textarea.scrollHeight,150)+'px';});
  }

  socket.on('people:message', message => {
    const openHandle = document.querySelector('.people-chat-person span')?.textContent?.match(/@([a-z0-9_]+)/i)?.[1];
    if (openHandle && message.from?.handle === openHandle) {
      const overlay = document.querySelector('.people-chat-overlay');
      if (overlay) openChat(message.from);
      return;
    }
    const key = message.from?.handle ? `vox_dm_${message.from.handle}` : '';
    if (key) {
      let existing=[]; try { existing=JSON.parse(localStorage.getItem(key)||'[]'); } catch {}
      existing.push({ text:message.text, mine:false, time:formatTime(message.createdAt), createdAt:message.createdAt });
      localStorage.setItem(key,JSON.stringify(existing));
    }
    showToast(message);
  });

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.ud-action.secondary');
    if(!button || button.textContent.trim()!=='Write') return;
    event.preventDefault(); event.stopImmediatePropagation();
    const row=button.closest('.ud-person'); if(!row)return;
    const info=row.querySelector('.ud-person-main span')?.textContent||'';
    const name=row.querySelector('.ud-person-main strong')?.textContent||'Vox user';
    const handle=info.match(/@([a-z0-9_]+)/i)?.[1]||'';
    const type=info.match(/·\s*([^·]+)(?:·|$)/)?.[1]?.trim()||'Vox Mandate user';
    openChat({name,handle,type});
  },true);
})();
