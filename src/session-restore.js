(() => {
  const API = window.location.origin;

  async function restore() {
    const token = localStorage.getItem('vox_token');
    const profileRaw = localStorage.getItem('vox_profile');
    if (!token || !profileRaw) return;

    let profile;
    try { profile = JSON.parse(profileRaw); } catch { return; }
    if (!profile?.handle || !profile?.name) return;

    const current = await fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => null);
    if (current?.ok) return;

    const response = await fetch(`${API}/api/auth/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryToken: token, profile })
    }).catch(() => null);
    if (!response?.ok) return;

    const data = await response.json().catch(() => null);
    if (!data?.token) return;
    localStorage.setItem('vox_token', data.token);
    if (data.profile) {
      localStorage.setItem('vox_profile', JSON.stringify(data.profile));
      localStorage.setItem('vox_profile_created', '1');
    }
    window.location.reload();
  }

  restore();
})();
