import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { formFor } from '../forms.js';

export default function ProjectDetail() {
  const { t, lang } = useI18n();
  const { health } = useOutletContext() || {};
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [analysis, setAnalysis] = useState({});
  const [name, setName] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [openSec, setOpenSec] = useState(null);
  const pollRef = useRef(null);
  const dirtyRef = useRef(false);

  function load() {
    api.getProject(id).then((p) => {
      setProject(p);
      setName(p.name);
      // apply field defaults (e.g. mentor) without marking dirty
      const a = { ...(p.analysis || {}) };
      for (const g of formFor(p.project_type)) {
        for (const fl of g.fields) {
          if (fl.default && (a[fl.key] === undefined || a[fl.key] === '')) a[fl.key] = fl.default;
        }
      }
      setAnalysis(a);
      if (p.status === 'generating') startPolling();
    }).catch((e) => setError(e.message));
  }
  useEffect(() => { load(); api.templates().then(setTemplates).catch(() => {}); return stopPolling; }, [id]);

  useEffect(() => {
    const handler = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const st = await api.progress(id);
        setProgress(st.progress);
        if (st.status !== 'generating') { stopPolling(); load(); }
      } catch { /* ignore */ }
    }, 1800);
  }
  function stopPolling() { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; }

  function markDirty() { dirtyRef.current = true; setSaveState('dirty'); }
  const setField = (key, val) => { setAnalysis((a) => ({ ...a, [key]: val })); markDirty(); };
  const toggleCheck = (key, option) => {
    setAnalysis((a) => {
      const cur = Array.isArray(a[key]) ? a[key] : [];
      const next = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option];
      return { ...a, [key]: next };
    });
    markDirty();
  };

  async function saveNow() {
    setSaveState('saving'); setError('');
    try {
      const updated = await api.updateProject(id, { name, companyName: analysis.companyName || '', analysis });
      setProject((p) => ({ ...p, ...updated }));
      dirtyRef.current = false;
      setSaveState('saved');
    } catch (e) { setError(e.message); setSaveState('dirty'); }
  }
  const onBlurCapture = () => { if (dirtyRef.current) saveNow(); };

  async function onUpload(e, kind = 'support') {
    const files = e.target.files;
    if (!files?.length) return;
    await api.uploadFiles(id, files, kind);
    e.target.value = '';
    load();
  }

  const canGenerate = !!(health?.chatgptProfile && health?.googleConfigured);

  async function generate() {
    setError('');
    if (!analysis.companyName?.trim()) { setError(t('detail.needCompany')); return; }
    if (dirtyRef.current) await saveNow();
    try {
      await api.generate(id);
      setProject((p) => ({ ...p, status: 'generating' }));
      setProgress({ step: 'start' });
      startPolling();
    } catch (e) { setError(e.message); }
  }

  // Sadece dokümanı yeniden oluştur (ChatGPT'yi tekrar çalıştırmadan) — kayıtlı yanıtları kullanır
  async function rebuildDoc() {
    setError('');
    try {
      await api.rebuildDoc(id);
      setProject((p) => ({ ...p, status: 'generating' }));
      setProgress({ step: 'document' });
      startPolling();
    } catch (e) { setError(e.message); }
  }

  if (!project) return <div className="page"><p className="muted">{t('projects.loading')}</p></div>;

  const ptype = project.project_type;
  const tpl = templates.find((x) => x.id === ptype);
  const typeLabel = tpl ? (lang === 'tr' ? tpl.labelTr : tpl.labelEn) : ptype;
  const questionCount = tpl?.questionCount || 13;
  const groups = formFor(ptype);

  const allFields = groups.flatMap((g) => g.fields);
  const isFilled = (fl) => {
    const v = analysis[fl.key];
    if (Array.isArray(v)) return v.length > 0;
    return (v || '').toString().trim().length > 0;
  };
  const filled = allFields.filter(isFilled).length;
  const pct = Math.round((filled / allFields.length) * 100);
  const generating = project.status === 'generating';

  return (
    <div className="page">
      <div className="page-head">
        <div className="detail-head">
          <Link to="/" className="back">← {t('detail.back')}</Link>
          <input className="title-input truncate" value={name}
            onChange={(e) => { setName(e.target.value); markDirty(); }}
            onBlur={() => { if (dirtyRef.current) saveNow(); }} />
          <span className="type-chip lg">{typeLabel}</span>
        </div>
        <div className="row gap">
          {saveState === 'saved' && <span className="save-state saved">✓ {t('detail.saved')}</span>}
          {saveState === 'dirty' && <span className="save-state dirty">● {t('detail.unsaved')}</span>}
          <button className="btn btn-primary" onClick={generate} disabled={generating || !canGenerate}
            title={!canGenerate ? t('detail.genDisabledTip') : ''}>
            {generating ? t('detail.generating') : '⚡ ' + t('detail.generate')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-err">{error}</div>}
      {generating && <GenerationProgress progress={progress} t={t} count={questionCount} />}

      {project.status === 'done' && project.doc_url && (
        <div className="alert alert-ok">
          ✓ {t('gen.ready')} <a href={project.doc_url} target="_blank" rel="noreferrer">{t('gen.openGoogleDoc')} →</a>
        </div>
      )}
      {project.status === 'error' && (
        <div className="alert alert-err">
          <span>{t('gen.error')}: {project.error_message}</span>
          {project.sections?.length > 0 && (
            <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={rebuildDoc} disabled={generating}>
              Dokümanı yeniden oluştur (kayıtlı yanıtlardan)
            </button>
          )}
        </div>
      )}

      <div className="columns">
        <section className="card" onBlurCapture={onBlurCapture}>
          <h2>{t('detail.form.title')}</h2>
          <p className="muted">{t('detail.form.desc')}</p>

          <div className="completeness">
            <div className="meter"><span style={{ width: `${pct}%` }} /></div>
            <span>{t('detail.completeness', { done: filled, total: allFields.length })}</span>
          </div>

          <div className="form">
            {groups.map((g, gi) => (
              <div key={gi}>
                <p className="group-label">{lang === 'tr' ? g.labelTr : g.labelEn}</p>
                {g.fields.map((fl) => (
                  <Field key={fl.key} fl={fl} lang={lang} value={analysis[fl.key]} onChange={setField} onToggle={toggleCheck} />
                ))}
              </div>
            ))}
          </div>
        </section>

        <aside className="side">
          <section className="card">
            <h2>{t('detail.files.wpTitle')}</h2>
            <p className="muted">{t('detail.files.wpDesc')}</p>
            <label className="upload upload-wp">
              <input type="file" multiple accept=".docx,.doc,.txt,.md" onChange={(e) => onUpload(e, 'workpackages')} hidden />
              <span>+ {t('detail.files.wpUpload')}</span>
            </label>
            <ul className="files">
              {(project.files || []).filter((fl) => fl.kind === 'workpackages').map((fl) => <li key={fl.id}>📋 {fl.original_name}</li>)}
              {!(project.files || []).some((fl) => fl.kind === 'workpackages') && <li className="muted tiny">{t('detail.files.wpEmpty')}</li>}
            </ul>
          </section>

          <section className="card">
            <h2>{t('detail.files.title')}</h2>
            <p className="muted">{t('detail.files.desc')}</p>
            <label className="upload">
              <input type="file" multiple onChange={(e) => onUpload(e, 'support')} hidden />
              <span>+ {t('detail.files.upload')}</span>
            </label>
            <ul className="files">
              {(project.files || []).filter((fl) => fl.kind !== 'workpackages').map((fl) => <li key={fl.id}>📎 {fl.original_name}</li>)}
              {!(project.files || []).some((fl) => fl.kind !== 'workpackages') && <li className="muted tiny">{t('detail.files.empty')}</li>}
            </ul>
          </section>

          {project.sections?.length > 0 && (
            <section className="card">
              <h2>{t('detail.sections.title')}</h2>
              <ul className="sections">
                {project.sections.map((s) => {
                  const isOpen = openSec === s.number;
                  return (
                    <li key={s.id} className="sec-item">
                      <button className="sec-row" aria-expanded={isOpen} onClick={() => setOpenSec(isOpen ? null : s.number)}>
                        <span className="label truncate">{s.title}</span>
                        <span className="meta">{(s.content || '').length} {t('detail.sections.charsSuffix')} · {isOpen ? t('detail.preview.hide') : t('detail.preview.show')}</span>
                      </button>
                      {isOpen && <div className="sec-preview">{s.content}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ fl, lang, value, onChange, onToggle }) {
  const label = lang === 'tr' ? fl.tr : fl.en;
  if (fl.type === 'checklist') {
    const sel = Array.isArray(value) ? value : [];
    return (
      <div className="field">
        <span>{label} <em className="muted tiny">({sel.length})</em></span>
        <div className="checklist">
          {fl.options.map((opt) => (
            <label key={opt} className={`check-item ${sel.includes(opt) ? 'on' : ''}`}>
              <input type="checkbox" checked={sel.includes(opt)} onChange={() => onToggle(fl.key, opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="field">
      <span>{label}</span>
      {fl.type === 'textarea'
        ? <textarea rows={3} value={value || ''} placeholder={fl.ph || ''} onChange={(e) => onChange(fl.key, e.target.value)} />
        : <input value={value || ''} placeholder={fl.ph || ''} onChange={(e) => onChange(fl.key, e.target.value)} />}
    </label>
  );
}

function GenerationProgress({ progress, t, count }) {
  const step = progress?.step || 'start';
  const current = progress?.number || 0;

  let header = t('gen.start');
  if (step === 'context') header = t('gen.context');
  else if (step === 'section') header = t('gen.sectionN', { n: current, total: count });
  else if (step === 'document') header = t('gen.document');
  else if (step === 'share') header = t('gen.share');
  else if (step === 'email') header = t('gen.email');
  else if (step === 'done') header = t('gen.done');

  const afterSections = ['document', 'share', 'email', 'done'].includes(step);

  return (
    <div className="card progress-card">
      <div className="progress-head">
        <div className="spinner" />
        <div>
          <strong>{t('gen.title')}</strong>
          <p className="muted" style={{ margin: '2px 0 0' }}>{header} · <span className="est">{t('gen.estTime')}</span></p>
        </div>
      </div>
      <div className="steps-grid">
        {Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          const done = afterSections || n < current;
          const active = step === 'section' && n === current;
          return (
            <div key={n} className={`step${done ? ' done' : ''}${active ? ' active' : ''}`}>
              <span className="mark">{done ? '✓' : n}</span>
              <span className="txt">{t('gen.sectionShort')} {n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
