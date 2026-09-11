(() => {
  const style = document.createElement('style');
  style.textContent = `
    .vox-logout-wrap { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e6eaf0; }
    .vox-logout-btn { width: 100%; min-height: 42px; border: 1px solid #e2b5b5; border-radius: 10px; background: #fff6f6; color: #a53232; font: inherit; font-weight: 800; cursor: pointer; }
    .vox-logout-btn:hover { background: #ffeaea; }
    .vox-logout-btn:disabled { opacity: .65; cursor: default; }

    .vox-profile-menu { position: absolute; right: 0; top: calc(100% + 8px); min-width: 150px; padding: 6px; background: #fff; border: 1px solid #dfe5ec; border-radius: 12px; box-shadow: 0 14px 35px rgba(16,24,40,.14); z-index: 10000; }
    .vox-profile-menu button { width: 100%; min-height: 38px; border: 0; border-radius: 8px; background: transparent; color: #233142; text-align: left; padding: 0 11px; font: inherit; font-weight: 700; cursor: pointer; }
    .vox-profile-menu button:hover { background: #f2f5f8; }
    .vox-profile-menu .danger { color: #b13a3a; }
    .vox-menu-anchor { position: relative; }
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

  function addLogoutToSettings() {
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

  function findProfileMenuAnchor() {
    const headers = [...document.querySelectorAll('.header-actions')];
    return headers.find(header => {
      const buttons = [...header.querySelectorAll('button')];
      return buttons.some(btn => btn.textContent.trim() === 'View profile') && buttons.some(btn => btn.textContent.trim() === '…' || btn.textContent.trim() === '...');
    }) || null;
  }

  function installProfileMenu() {
    const header = findProfileMenuAnchor();
    if (!header) return;
    const ellipsis = [...header.querySelectorAll('button')].find(btn => btn.textContent.trim() === '…' || btn.textContent.trim() === '...');
    if (!ellipsis || ellipsis.dataset.voxLogoutBound === '1') return;

    ellipsis.dataset.voxLogoutBound = '1';
    header.classList.add('vox-menu-anchor');
    ellipsis.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      const existing = header.querySelector('.vox-profile-menu');
      if (existing) {
        existing.remove();
        return;
      }

      const menu = document.createElement('div');
      menu.className = 'vox-profile-menu';
      const logoutButton = document.createElement('button');
      logoutButton.type = 'button';
      logoutButton.className = 'danger';
      logoutButton.textContent = 'Log out';
      logoutButton.addEventListener('click', () => logout(logoutButton));
      menu.appendChild(logoutButton);
      header.appendChild(menu);
    });
  }

  document.addEventListener('click', event => {
    document.querySelectorAll('.vox-profile-menu').forEach(menu => {
      if (!menu.contains(event.target) && !menu.parentElement?.contains(event.target)) menu.remove();
    });
  });

  const observer = new MutationObserver(() => {
    addLogoutToSettings();
    installProfileMenu();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setTimeout(() => {
    addLogoutToSettings();
    installProfileMenu();
  }, 300);
})();
