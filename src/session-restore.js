(() => {
  const API = window.location.origin;
  const token = localStorage.getItem('vox_token');
  const profileRaw = localStorage.getItem('vox_profile');
  const hadLocalIdentity = Boolean(token && profileRaw);
  window.__voxRestoreActive = hadLocalIdentity;

  if (hadLocalIdentity) {
    const originalRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) {
      if (window.__voxRestoreActive && ['vox_token','vox_profile','vox_profile_created'].includes(key)) return;
      return originalRemove.call(this, key);
    };
    setTimeout(() => { window.__voxRestoreActive = false; Storage.prototype.removeItem = originalRemove; }, 10000);
  }

  async function restore() {
    if (!token || !profileRaw) { window.__voxRestoreActive = false; return; }

    let profile;
    try { profile = JSON.parse(profileRaw); } catch { window.__voxRestoreActive = false; return; }
    if (!profile?.handle || !profile?.name) { window.__voxRestoreActive = false; return; }

    const current = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (current?.ok) { window.__voxRestoreActive = false; return; }

    const response = await fetch(`${API}/api/auth/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryToken: token, profile })
    }).catch(() => null);
    if (!response?.ok) { window.__voxRestoreActive = false; return; }

    const data = await response.json().catch(() => null);
    if (!data?.token) { window.__voxRestoreActive = false; return; }
    localStorage.setItem('vox_token', data.token);
    if (data.profile) {
      localStorage.setItem('vox_profile', JSON.stringify(data.profile));
      localStorage.setItem('vox_profile_created', '1');
    }
    window.__voxRestoreActive = false;
    window.location.reload();
  }

  restore();
})();
