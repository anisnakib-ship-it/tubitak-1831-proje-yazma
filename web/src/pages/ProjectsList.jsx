import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

const STATUS_CLS = { draft: 'badge-draft', generating: 'badge-gen', done: 'badge-done', error: 'badge-err' };

export default function ProjectsList() {
  const { t, lang } = useI18n();
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function load() {
    api.listProjects().then(setProjects).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.templates().then((tpls) => { setTemplates(tpls); setType(tpls[0]?.id || ''); }).catch(() => {});
  }, []);

  const typeLabel = (id) => {
    const tpl = templates.find((x) => x.id === id);
    return tpl ? (lang === 'tr' ? tpl.labelTr : tpl.labelEn) : id;
  };

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const p = await api.createProject({ name: name.trim(), projectType: type });
      navigate(`/project/${p.id}`);
    } catch (err) { setError(err.message); }
  }

  async function remove(e, id) {
    e.stopPropagation();
    if (!confirm(t('projects.deleteConfirm'))) return;
    await api.deleteProject(id);
    load();
  }

  const open = (id) => navigate(`/project/${id}`);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('projects.title')}</h1>
          <p className="subtitle">{t('projects.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ {t('projects.new')}</button>
      </div>

      {creating && (
        <form className="card create-card wide" onSubmit={create}>
          <label className="field">
            <span>{t('projects.nameLabel')}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('projects.namePlaceholder')} />
          </label>

          <div className="field">
            <span>{t('projects.typePick')}</span>
            <div className="type-grid">
              {templates.map((tpl) => (
                <button
                  type="button"
                  key={tpl.id}
                  className={`type-card ${type === tpl.id ? 'active' : ''}`}
                  onClick={() => setType(tpl.id)}
                  aria-pressed={type === tpl.id}
                >
                  <strong>{lang === 'tr' ? tpl.labelTr : tpl.labelEn}</strong>
                  <small>{lang === 'tr' ? tpl.descTr : tpl.descEn}</small>
                  <em>{tpl.months} {lang === 'tr' ? 'ay' : 'mo'} · {tpl.workPackages} {lang === 'tr' ? 'iş paketi' : 'WP'}</em>
                </button>
              ))}
            </div>
          </div>

          <div className="row gap">
            <button type="submit" className="btn btn-primary">{t('projects.create')}</button>
            <button type="button" className="btn" onClick={() => setCreating(false)}>{t('projects.cancel')}</button>
          </div>
        </form>
      )}

      {error && <div className="alert alert-err">{error}</div>}

      {loading ? (
        <div className="grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="sk" key={i}><div className="sk-line short" /><div className="sk-line" /><div className="sk-line mid" /></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="grid">
          {projects.map((p, i) => (
            <div
              key={p.id}
              className="card project-card"
              style={{ '--i': i }}
              role="button"
              tabIndex={0}
              onClick={() => open(p.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p.id); } }}
            >
              <div className="row between">
                <span className={`badge ${STATUS_CLS[p.status] || 'badge-draft'}`}>{t(`status.${p.status}`)}</span>
                <button className="icon-btn" onClick={(e) => remove(e, p.id)} aria-label={t('projects.delete')} title={t('projects.delete')}>✕</button>
              </div>
              <h3 className="truncate">{p.name}</h3>
              <span className="type-chip">{typeLabel(p.project_type)}</span>
              {p.company_name && <p className="muted truncate">{p.company_name}</p>}
              <p className="tiny muted">{new Date(p.created_at + 'Z').toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB')}</p>
              {p.doc_url && (
                <a className="doc-link" href={p.doc_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  {t('projects.openDoc')} →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ t }) {
  return (
    <div className="empty">
      <svg className="graph" width="180" height="110" viewBox="0 0 180 110" fill="none" aria-hidden="true">
        <g stroke="var(--sage)" strokeWidth="1.5">
          <line x1="90" y1="55" x2="38" y2="26" /><line x1="90" y1="55" x2="146" y2="30" />
          <line x1="90" y1="55" x2="34" y2="84" /><line x1="90" y1="55" x2="142" y2="82" />
          <line x1="38" y1="26" x2="146" y2="30" /><line x1="34" y1="84" x2="142" y2="82" />
        </g>
        <g>
          <circle cx="90" cy="55" r="13" fill="var(--pine)" />
          <circle cx="38" cy="26" r="8" fill="var(--moss)" /><circle cx="146" cy="30" r="8" fill="var(--moss)" />
          <circle cx="34" cy="84" r="8" fill="var(--amber)" /><circle cx="142" cy="82" r="8" fill="var(--moss)" />
        </g>
      </svg>
      <h3>{t('projects.empty.title')}</h3>
      <p className="muted">{t('projects.empty.hint')}</p>
    </div>
  );
}
