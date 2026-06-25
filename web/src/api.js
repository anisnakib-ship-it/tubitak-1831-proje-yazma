// Uygulama tabanı = Vite `base` (import.meta.env.BASE_URL). Yerelde '/', sunucuda
// '/proje-yazma/'. Sondaki '/' atılır → '' veya '/proje-yazma'. Böylece tüm API
// yolları her iki ortamda da elle düzenleme gerektirmeden doğru çalışır.
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
export const apiUrl = (path) => BASE + path;

// --- Yönetim (admin) parolası — paylaşılan, x-admin-key başlığında taşınır ---
const ADMIN_KEY_STORE = 'adminKey';
export const getAdminKey = () => localStorage.getItem(ADMIN_KEY_STORE) || '';
export const setAdminKey = (k) => {
  if (k) localStorage.setItem(ADMIN_KEY_STORE, k);
  else localStorage.removeItem(ADMIN_KEY_STORE);
};

async function req(url, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...headers },
    ...rest
  });
  if (!res.ok) {
    let msg = `Hata ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch { /* ignore */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// Yönetim istekleri paroleyi başlıkta taşır
function adminReq(url, options = {}) {
  return req(url, { ...options, headers: { ...(options.headers || {}), 'x-admin-key': getAdminKey() } });
}

export const api = {
  health: () => req('/api/health'),
  knowledgeHealth: () => req('/api/knowledge/health'),
  templates: () => req('/api/templates'),

  listProjects: () => req('/api/projects'),
  createProject: (body) => req('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  getProject: (id) => req(`/api/projects/${id}`),
  updateProject: (id, body) => req(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProject: (id) => req(`/api/projects/${id}`, { method: 'DELETE' }),

  uploadFiles: (id, fileList, kind = 'support') => {
    const fd = new FormData();
    for (const f of fileList) fd.append('files', f);
    fd.append('kind', kind);
    return fetch(apiUrl(`/api/projects/${id}/files`), { method: 'POST', body: fd }).then((r) => {
      if (!r.ok) throw new Error('Dosya yüklenemedi');
      return r.json();
    });
  },

  generate: (id) => req(`/api/projects/${id}/generate`, { method: 'POST' }),
  progress: (id) => req(`/api/projects/${id}/progress`),

  chatgptLogin: () => req('/api/chatgpt/login', { method: 'POST' }),

  // --- Bilgi Yönetimi (admin) ---
  adminPrograms: () => adminReq('/api/admin/programs'),
  adminProgram: (id) => adminReq(`/api/admin/programs/${id}`),
  adminUpdateProgram: (id, body) => adminReq(`/api/admin/programs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminUpdateSection: (id, body) => adminReq(`/api/admin/sections/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminGlobalRules: () => adminReq('/api/admin/global-rules'),
  adminCreateGlobalRule: (body) => adminReq('/api/admin/global-rules', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateGlobalRule: (id, body) => adminReq(`/api/admin/global-rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteGlobalRule: (id) => adminReq(`/api/admin/global-rules/${id}`, { method: 'DELETE' }),
  adminExport: () => adminReq('/api/admin/export'),
  adminImport: (data) => adminReq('/api/admin/import', { method: 'POST', body: JSON.stringify(data) })
};
