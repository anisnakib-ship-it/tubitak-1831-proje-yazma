async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let msg = `Hata ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
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

  uploadFiles: (id, fileList) => {
    const fd = new FormData();
    for (const f of fileList) fd.append('files', f);
    return fetch(`/api/projects/${id}/files`, { method: 'POST', body: fd }).then((r) => {
      if (!r.ok) throw new Error('Dosya yüklenemedi');
      return r.json();
    });
  },

  generate: (id) => req(`/api/projects/${id}/generate`, { method: 'POST' }),
  progress: (id) => req(`/api/projects/${id}/progress`),

  chatgptLogin: () => req('/api/chatgpt/login', { method: 'POST' })
};
