import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n, SECTION_TITLES } from '../i18n.jsx';

// field: [key, type, group, types?]  — types omitted = all project types
const FIELDS = [
  ['companyName', 'input', 'profile'],
  ['sector', 'input', 'profile'],
  ['nace', 'input', 'profile'],
  ['employees', 'input', 'profile'],
  ['products', 'textarea', 'profile'],

  ['waterRegulationStatus', 'input', 'project', ['water-blue', 'water-carbon']],
  ['currentWaterUse', 'textarea', 'project', ['water-blue', 'water-carbon']],
  ['selectedProduct', 'textarea', 'project', ['product-carbon']],
  ['carbonActivityData', 'textarea', 'project', ['corporate-carbon', 'water-carbon']],
  ['projectScope', 'textarea', 'project'],
  ['projectNeed', 'textarea', 'project'],
  ['workToBeDone', 'textarea', 'project'],
  ['workPackages', 'textarea', 'project'],

  ['collaborations', 'textarea', 'capacity'],
  ['pastProjects', 'textarea', 'capacity'],
  ['infrastructure', 'textarea', 'capacity'],
  ['notes', 'textarea', 'capacity']
];
const GROUPS = ['profile', 'project', 'capacity'];

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
      setAnalysis(p.analysis || {});
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

  async function onUpload(e) {
    const files = e.target.files;
    if (!files?.length) return;
    await api.uploadFiles(id, files);
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

  if (!project) return <div className="page"><p className="muted">{t('projects.loading')}</p></div>;

  const ptype = project.project_type;
  const tpl = templates.find((x) => x.id === ptype);
  const typeLabel = tpl ? (lang === 'tr' ? tpl.labelTr : tpl.labelEn) : ptype;

  const visible = FIELDS.filter(([, , , types]) => !types || types.includes(ptype));
  const generating = project.status === 'generating';
  const filled = visible.filter(([k]) => (analysis[k] || '').toString().trim()).length;
  const pct = Math.round((filled / visible.length) * 100);

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
      {generating && <GenerationProgress progress={progress} t={t} lang={lang} />}

      {project.status === 'done' && project.doc_url && (
        <div className="alert alert-ok">
          ✓ {t('gen.ready')} <a href={project.doc_url} target="_blank" rel="noreferrer">{t('gen.openGoogleDoc')} →</a>
        </div>
      )}
      {project.status === 'error' && <div className="alert alert-err">{t('gen.error')}: {project.error_message}</div>}

      <div className="columns">
        <section className="card" onBlurCapture={onBlurCapture}>
          <h2>{t('detail.form.title')}</h2>
          <p className="muted">{t('detail.form.desc')}</p>

          <div className="completeness">
            <div className="meter"><span style={{ width: `${pct}%` }} /></div>
            <span>{t('detail.completeness', { done: filled, total: visible.length })}</span>
          </div>

          <div className="form">
            {GROUPS.map((group) => {
              const groupFields = visible.filter(([, , g]) => g === group);
              if (groupFields.length === 0) return null;
              return (
                <div key={group}>
                  <p className="group-label">{t(`detail.group.${group}`)}</p>
                  {groupFields.map(([key, ftype]) => (
                    <Field key={key} k={key} type={ftype} t={t} value={analysis[key]} onChange={setField} />
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="side">
          <section className="card">
            <h2>{t('detail.files.title')}</h2>
            <p className="muted">{t('detail.files.desc')}</p>
            <label className="upload">
              <input type="file" multiple onChange={onUpload} hidden />
              <span>+ {t('detail.files.upload')}</span>
            </label>
            <ul className="files">
              {(project.files || []).map((f) => <li key={f.id}>📎 {f.original_name}</li>)}
              {(!project.files || project.files.length === 0) && <li className="muted tiny">{t('detail.files.empty')}</li>}
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

function Field({ k, type, t, value, onChange }) {
  return (
    <label className="field">
      <span>{t(`field.${k}.label`)}</span>
      {type === 'textarea'
        ? <textarea rows={3} value={value || ''} placeholder={t(`field.${k}.ph`)} onChange={(e) => onChange(k, e.target.value)} />
        : <input value={value || ''} placeholder={t(`field.${k}.ph`)} onChange={(e) => onChange(k, e.target.value)} />}
    </label>
  );
}

function GenerationProgress({ progress, t, lang }) {
  const step = progress?.step || 'start';
  const current = progress?.number || 0;
  const titles = SECTION_TITLES[lang] || SECTION_TITLES.tr;

  let header = t('gen.start');
  if (step === 'context') header = t('gen.context');
  else if (step === 'section') header = t('gen.section', { n: current });
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
        {titles.map((title, i) => {
          const n = i + 1;
          const done = afterSections || n < current;
          const active = step === 'section' && n === current;
          return (
            <div key={n} className={`step${done ? ' done' : ''}${active ? ' active' : ''}`}>
              <span className="mark">{done ? '✓' : n}</span>
              <span className="txt">{title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
