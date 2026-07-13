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

  uploadFiles: (id, fileList, kind = 'support') => {
    const fd = new FormData();
    for (const f of fileList) fd.append('files', f);
    fd.append('kind', kind);
    return fetch(`/api/projects/${id}/files`, { method: 'POST', body: fd }).then((r) => {
      if (!r.ok) throw new Error('Dosya yüklenemedi');
      return r.json();
    });
  },

  transcribeAnalysis: (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`/api/projects/${id}/analysis/transcribe`, { method: 'POST', body: fd }).then(async (r) => {
      if (!r.ok) {
        let msg = `Hata ${r.status}`;
        try {
          const data = await r.json();
          msg = data.error || msg;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      return r.json();
    });
  },

  importAnalysis: (id, {
    file,
    transcript = '',
    mergeMode = 'fill-empty',
    sourceName = '',
    sourceKind = '',
    wasTranscribed = false
  }) => {
    if (!file) {
      return req(`/api/projects/${id}/analysis/import-text`, {
        method: 'POST',
        body: JSON.stringify({ transcript, mergeMode, sourceName, sourceKind, wasTranscribed })
      });
    }
    const fd = new FormData();
    if (file) fd.append('file', file);
    fd.append('transcript', transcript);
    fd.append('mergeMode', mergeMode);
    return fetch(`/api/projects/${id}/analysis/import`, { method: 'POST', body: fd }).then(async (r) => {
      if (!r.ok) {
        let msg = `Hata ${r.status}`;
        try {
          const data = await r.json();
          msg = data.error || msg;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      return r.json();
    });
  },
  getAnalysisImport: (projectId, importId) => req(`/api/projects/${projectId}/analysis/imports/${importId}`),

  generate: (id) => req(`/api/projects/${id}/generate`, { method: 'POST' }),
  progress: (id) => req(`/api/projects/${id}/progress`),

  chatgptLogin: () => req('/api/chatgpt/login', { method: 'POST' })
};
