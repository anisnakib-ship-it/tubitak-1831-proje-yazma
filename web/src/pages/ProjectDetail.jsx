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
  const [importText, setImportText] = useState('');
  const [importTextLength, setImportTextLength] = useState(0);
  const [importFile, setImportFile] = useState(null);
  const [transcriptSource, setTranscriptSource] = useState(null);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importDetails, setImportDetails] = useState({});
  const [importError, setImportError] = useState('');
  const [importTextFocused, setImportTextFocused] = useState(false);
  const importTextRef = useRef(null);
  const importFileRef = useRef(null);
  const pollRef = useRef(null);
  const dirtyRef = useRef(false);

  function applyFieldDefaults(projectType, source = {}) {
    const a = { ...source };
    for (const g of formFor(projectType)) {
      for (const fl of g.fields) {
        if (fl.default && (a[fl.key] === undefined || a[fl.key] === '')) a[fl.key] = fl.default;
      }
    }
    return a;
  }

  function load() {
    api.getProject(id).then((p) => {
      setProject(p);
      setName(p.name);
      // apply field defaults (e.g. mentor) without marking dirty
      setAnalysis(applyFieldDefaults(p.project_type, p.analysis || {}));
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

  async function importAnalysisFromCall() {
    setImportError('');
    setImportResult(null);
    if (!importText.trim()) {
      setImportError(t('detail.import.needInput'));
      return;
    }
    if (dirtyRef.current) await saveNow();
    setImporting(true);
    try {
      const updated = await api.importAnalysis(id, {
        transcript: importText,
        mergeMode: importOverwrite ? 'overwrite' : 'fill-empty',
        sourceName: transcriptSource?.fileName || '',
        sourceKind: transcriptSource?.sourceKind || 'text',
        wasTranscribed: !!transcriptSource?.transcribed
      });
      setProject((p) => ({ ...p, ...updated }));
      setAnalysis(applyFieldDefaults(updated.project_type || project.project_type, updated.analysis || {}));
      if (updated.name) setName(updated.name);
      dirtyRef.current = false;
      setSaveState('saved');
      setImportResult(updated.import);
      load();
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  }

  async function transcribeImportFile() {
    setImportError('');
    setImportResult(null);
    if (!importFile) {
      setImportError(t('detail.import.needFile'));
      return;
    }
    setTranscribing(true);
    try {
      const result = await api.transcribeAnalysis(id, importFile);
      setImportText(result.transcript || '');
      setImportTextLength(result.transcript?.length || 0);
      setTranscriptSource({
        fileName: result.fileName || importFile.name,
        sourceKind: result.transcribed ? 'audio' : 'file',
        transcribed: !!result.transcribed
      });
    } catch (e) {
      setImportError(e.message);
    } finally {
      setTranscribing(false);
    }
  }

  async function loadImportDetail(importId) {
    if (importDetails[importId]) return;
    try {
      const detail = await api.getAnalysisImport(id, importId);
      setImportDetails((current) => ({ ...current, [importId]: detail }));
    } catch (e) {
      setImportDetails((current) => ({ ...current, [importId]: { error_message: e.message } }));
    }
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
      {project.status === 'error' && <div className="alert alert-err">{t('gen.error')}: {project.error_message}</div>}

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
          <section className="card import-card">
            <h2>{t('detail.import.title')}</h2>
            <p className="muted">{t('detail.import.desc')}</p>
            <label className="upload">
              <input
                ref={importFileRef}
                type="file"
                accept=".flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm,.txt,.md,.csv,.json,.docx,.pdf,audio/*,text/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImportFile(file);
                  setTranscriptSource(null);
                  setImportText('');
                  setImportTextLength(0);
                  setImportResult(null);
                }}
                hidden
                disabled={importing || transcribing}
              />
              <span>{importFile ? importFile.name : '+ ' + t('detail.import.fileUpload')}</span>
            </label>
            <button
              className="btn import-btn"
              onClick={transcribeImportFile}
              disabled={!importFile || transcribing || importing || generating}
            >
              {transcribing ? t('detail.import.transcribing') : t('detail.import.transcribe')}
            </button>
            {transcriptSource && (
              <div className="mini-alert mini-alert-ok">
                {t('detail.import.transcriptReady', { n: importTextLength })}
              </div>
            )}
            <label className="field">
              <span>{t('detail.import.transcriptLabel')}</span>
              <textarea
                ref={importTextRef}
                className="import-transcript"
                rows={importTextFocused || importTextLength ? 10 : 5}
                value={importText}
                placeholder={t('detail.import.transcriptPh')}
                onChange={(e) => {
                  setImportText(e.currentTarget.value);
                  setImportTextLength(e.currentTarget.value.length);
                }}
                onFocus={() => setImportTextFocused(true)}
                onBlur={() => setImportTextFocused(false)}
                spellCheck={false}
                disabled={importing || transcribing}
              />
              <em className="muted tiny">{t('detail.import.charCount', { n: importTextLength })}</em>
            </label>
            <label className="check-item import-overwrite">
              <input
                type="checkbox"
                checked={importOverwrite}
                onChange={(e) => setImportOverwrite(e.target.checked)}
                disabled={importing}
              />
              <span>{t('detail.import.overwrite')}</span>
            </label>
            <button
              className="btn btn-primary import-btn"
              onClick={importAnalysisFromCall}
              disabled={importing || transcribing || generating || !importText.trim() || !health?.importConfigured}
              title={!health?.importConfigured ? t('detail.import.disabledTip') : ''}
            >
              {importing ? t('detail.import.importing') : t('detail.import.fillAutomatically')}
            </button>
            {!health?.importConfigured && (
              <p className="muted tiny">
                {health?.extractionProvider === 'ollama' && health?.ollamaReachable === false
                  ? t('detail.import.needOllama')
                  : t('detail.import.needConfig')}
              </p>
            )}
            {importError && <div className="mini-alert mini-alert-err">{importError}</div>}
            {importResult && (
              <div className="mini-alert mini-alert-ok">
                {t('detail.import.done', { n: importResult.filledKeys?.length || 0 })}
                {importResult.transcribed && <span> {t('detail.import.transcribed')}</span>}
                {importResult.skippedKeys?.length > 0 && (
                  <span> {t('detail.import.skipped', { n: importResult.skippedKeys.length })}</span>
                )}
              </div>
            )}
            {importResult?.filledKeys?.length > 0 && (
              <details className="import-review">
                <summary>{t('detail.import.review')}</summary>
                <ul>
                  {importResult.filledKeys.slice(0, 12).map((key) => (
                    <li key={key}>
                      <strong>{key}</strong>
                      {importResult.evidence?.[key] && <span>{importResult.evidence[key]}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {importResult?.notes?.length > 0 && (
              <details className="import-review">
                <summary>{t('detail.import.notes')}</summary>
                <ul>
                  {importResult.notes.slice(0, 8).map((note, i) => <li key={i}><span>{note}</span></li>)}
                </ul>
              </details>
            )}
            {project.analysisImports?.length > 0 && (
              <div className="import-history">
                <h3>{t('detail.import.history')}</h3>
                {project.analysisImports.map((run) => {
                  const detail = importDetails[run.id];
                  const importedCount = run.filled_keys?.length || 0;
                  return (
                    <details
                      className="import-review"
                      key={run.id}
                      onToggle={(e) => { if (e.currentTarget.open) loadImportDetail(run.id); }}
                    >
                      <summary>
                        {new Date(`${run.created_at}Z`).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB')}
                        {' · '}{run.status === 'completed'
                          ? t('detail.import.historyFields', { n: importedCount })
                          : t('detail.import.historyError')}
                      </summary>
                      {detail?.error_message && <p className="import-error-text">{detail.error_message}</p>}
                      {!detail && <p className="muted tiny">{t('projects.loading')}</p>}
                      {detail?.transcript && (
                        <>
                          <strong className="import-subhead">{t('detail.import.savedTranscript')}</strong>
                          <pre className="import-transcript-preview">{detail.transcript}</pre>
                        </>
                      )}
                      {detail?.rejected?.length > 0 && (
                        <>
                          <strong className="import-subhead">{t('detail.import.rejected')}</strong>
                          <ul>{detail.rejected.map((reason, index) => <li key={index}><span>{reason}</span></li>)}</ul>
                        </>
                      )}
                    </details>
                  );
                })}
              </div>
            )}
          </section>

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
