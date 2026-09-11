(() => {
  const style = document.createElement('style');
  style.textContent = `
    .vox-logout-wrap { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e6eaf0; }
    .vox-logout-btn { width: 100%; min-height: 42px; border: 1px solid #e2b5b5; border-radius: 10px; background: #fff6f6; color: #a53232; font: inherit; font-weight: 800; cursor: pointer; }
    .vox-logout-btn:hover { background: #ffeaea; }
    .vox-logout-btn:disabled { opacity: .65; cursor: default; }
  `;
  document.head.appendChild(style);

  function clearSession() {
    ['vox_token', 'vox_session', 'vox_profile', 'vox_profile_created'].forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
  }

  async function logout(button) {
    button.disabled = true;
    button.textContent = 'Logging out…';
    try {
      const token = localStorage.getItem('vox_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (_) {
      // Clear the local session even if the server is temporarily unavailable.
    }
    clearSession();
    window.location.reload();
  }

  function install() {
    const modal = document.querySelector('.settings-modal');
    if (!modal || modal.querySelector('.vox-logout-wrap')) return;

    const wrap = document.createElement('div');
    wrap.className = 'vox-logout-wrap';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vox-logout-btn';
    button.textContent = 'Log out';
    button.addEventListener('click', () => logout(button));
    wrap.appendChild(button);
    modal.appendChild(wrap);
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(install, 300);
})();
