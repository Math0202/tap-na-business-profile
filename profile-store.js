/**
 * Shared profile store (localStorage).
 * Used by index.html, profile.html, and cards.html.
 */
(function (global) {
  const STORAGE_KEY = 'tapna_profile';

  const DEFAULT_PROFILE = {
    name: 'Tangeni Matheus',
    title: 'Software Developer',
    company: 'AUCKMUND',
    phone: '',
    email: '',
    linkedin: '',
    youtube: '',
    x: '',
    instagram: '',
    tiktok: '',
    website: '',
    avatar: 'personal.jpeg',
    disabled: false,
    deleted: false,
    loginEmail: '',
    loginPhone: '',
    passwordHash: ''
  };

  function hashPassword(password) {
    // Lightweight client-side hash for local demo auth (not for production servers).
    var str = 'tapna|' + String(password || '');
    var hash = 2166136261;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULT_PROFILE);
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_PROFILE, parsed);
    } catch (e) {
      return Object.assign({}, DEFAULT_PROFILE);
    }
  }

  function saveProfile(data) {
    const current = loadProfile();
    const next = Object.assign({}, current, data, { deleted: false });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function setDisabled(disabled) {
    return saveProfile({ disabled: !!disabled });
  }

  function updateLoginCredentials(payload) {
    const current = loadProfile();
    const updates = {};

    if (typeof payload.loginEmail === 'string') {
      updates.loginEmail = payload.loginEmail.trim();
    }
    if (typeof payload.loginPhone === 'string') {
      updates.loginPhone = payload.loginPhone.trim();
    }

    if (payload.newPassword) {
      if (current.passwordHash) {
        if (!payload.currentPassword || hashPassword(payload.currentPassword) !== current.passwordHash) {
          return { ok: false, error: 'Current password is incorrect.' };
        }
      }
      if (String(payload.newPassword).length < 6) {
        return { ok: false, error: 'New password must be at least 6 characters.' };
      }
      if (payload.newPassword !== payload.confirmPassword) {
        return { ok: false, error: 'New passwords do not match.' };
      }
      updates.passwordHash = hashPassword(payload.newPassword);
    }

    saveProfile(updates);
    return { ok: true };
  }

  function verifyPassword(password) {
    const current = loadProfile();
    if (!current.passwordHash) return true;
    return hashPassword(password) === current.passwordHash;
  }

  function deleteProfile() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: '',
      title: '',
      company: '',
      phone: '',
      email: '',
      linkedin: '',
      youtube: '',
      x: '',
      instagram: '',
      tiktok: '',
      website: '',
      avatar: '',
      disabled: false,
      deleted: true,
      loginEmail: '',
      loginPhone: '',
      passwordHash: ''
    }));
  }

  function resetProfile() {
    localStorage.removeItem(STORAGE_KEY);
    return Object.assign({}, DEFAULT_PROFILE);
  }

  function isProfileDeleted(profile) {
    return !!(profile && profile.deleted);
  }

  function isProfileDisabled(profile) {
    return !!(profile && profile.disabled && !profile.deleted);
  }

  function displayName(profile) {
    if (isProfileDeleted(profile) || !profile.name) return 'No profile';
    return profile.name;
  }

  function avatarUrl(profile) {
    if (isProfileDeleted(profile) || !profile.avatar) {
      return 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#2a2a2a" width="100" height="100"/><circle cx="50" cy="38" r="18" fill="#555"/><ellipse cx="50" cy="78" rx="28" ry="20" fill="#555"/></svg>'
      );
    }
    return profile.avatar;
  }

  function cleanHandle(value) {
    return String(value || '')
      .trim()
      .replace(/^@+/, '')
      .replace(/^\/+/, '')
      .replace(/\s+/g, '');
  }

  function looksLikeUrl(value) {
    return /^(https?:\/\/|www\.)/i.test(String(value || '').trim());
  }

  /**
   * Accept full URL or handle and return a usable https URL.
   * network: linkedin | youtube | x | instagram | tiktok | website
   */
  function resolveSocialUrl(network, value) {
    var raw = String(value || '').trim();
    if (!raw) return '';

    if (looksLikeUrl(raw)) {
      if (/^www\./i.test(raw)) return 'https://' + raw;
      return raw;
    }

    var handle = cleanHandle(raw);
    if (!handle) return '';

    switch (network) {
      case 'linkedin':
        if (/^in\//i.test(handle) || /^company\//i.test(handle)) {
          return 'https://www.linkedin.com/' + handle.replace(/^\/+/, '');
        }
        return 'https://www.linkedin.com/in/' + handle;
      case 'youtube':
        if (/^(c\/|channel\/|user\/|@)/i.test(handle)) {
          return 'https://www.youtube.com/' + handle.replace(/^\/+/, '');
        }
        return 'https://www.youtube.com/@' + handle.replace(/^@/, '');
      case 'x':
        return 'https://x.com/' + handle;
      case 'instagram':
        return 'https://www.instagram.com/' + handle;
      case 'tiktok':
        return 'https://www.tiktok.com/@' + handle.replace(/^@/, '');
      case 'website':
        return 'https://' + handle.replace(/^https?:\/\//i, '');
      default:
        return raw;
    }
  }

  function normalizeSocialFields(data) {
    var networks = ['linkedin', 'youtube', 'x', 'instagram', 'tiktok', 'website'];
    var out = Object.assign({}, data);
    networks.forEach(function (key) {
      if (typeof out[key] === 'string') {
        out[key] = resolveSocialUrl(key, out[key]);
      }
    });
    return out;
  }

  global.ProfileStore = {
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    load: loadProfile,
    save: saveProfile,
    setDisabled: setDisabled,
    updateLoginCredentials: updateLoginCredentials,
    verifyPassword: verifyPassword,
    delete: deleteProfile,
    reset: resetProfile,
    isDeleted: isProfileDeleted,
    isDisabled: isProfileDisabled,
    displayName: displayName,
    avatarUrl: avatarUrl,
    resolveSocialUrl: resolveSocialUrl,
    normalizeSocialFields: normalizeSocialFields
  };
})(window);
