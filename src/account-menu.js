(() => {
  const style = document.createElement('style');
  style.textContent = `
    .settings-trigger { display: none !important; }
    .vox-account-menu { position: fixed; z-index: 20000; min-width: 150px; padding: 6px; background: #fff; border: 1px solid #dfe5ec; border-radius: 12px; box-shadow: 0 12px 30px rgba(18, 29, 42, .14); }
    .vox-account-menu button { display: block; width: 100%; border: 0; border-radius: 8px; background: transparent; padding: 10px 12px; text-align: left; font: inherit; font-weight: 700; color: #a53232; cursor: pointer; }
    .vox-account-menu button:hover { background: #fff1f1; }
  `;
  document.head.appendChild(style);

  function clearSession() {
    ['vox_token', 'vox_session', 'vox_profile', 'vox_profile_created'].forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
  }

  async function logout() {
    const token = localStorage.getItem('vox_token');
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (_) {}
    clearSession();
    window.location.reload();
  }

  let menu = null;

  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
  }

  function openMenu(button) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'vox-account-menu';
    menu.innerHTML = '<button type="button">Log out</button>';
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${Math.max(8, rect.right - 150)}px`;
    menu.querySelector('button').addEventListener('click', async () => {
      closeMenu();
      await logout();
    });
    document.body.appendChild(menu);
  }

  function install() {
    document.querySelectorAll('.settings-trigger').forEach(button => {
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });

    document.querySelectorAll('.topbar .header-actions .icon-btn').forEach(button => {
      if (button.dataset.voxAccountMenuInstalled === '1') return;
      if (button.textContent.trim() !== '⋯' && button.textContent.trim() !== '...') return;
      button.dataset.voxAccountMenuInstalled = '1';
      button.setAttribute('aria-label', 'Account menu');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (menu) closeMenu(); else openMenu(button);
      }, true);
    });

    document.querySelectorAll('.settings-modal').forEach(modal => {
      const backdrop = modal.closest('.modal-backdrop');
      if (backdrop) backdrop.remove();
    });
  }

  document.addEventListener('click', event => {
    if (menu && !menu.contains(event.target)) closeMenu();
  });

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(install, 250);
})();
