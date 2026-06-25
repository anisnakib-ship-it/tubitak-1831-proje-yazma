import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, setAdminKey } from '../api.js';

/**
 * Bilgi Yönetimi — programlar, bölüm prompt'ları, kapsam, iş paketleri, ortak
 * kurallar ve bölüm uzunlukları platform içinden düzenlenir. (En son kazanır.)
 * Değişiklikler bir sonraki üretimde geçerli olur. Paylaşılan parola ile
 * korunur (sunucuda ADMIN_PASSWORD; yerelde ayarlanmazsa kapalı).
 */
export default function Admin() {
  const [auth, setAuth] = useState('checking');    // 'checking' | 'locked' | 'ok'
  const [pw, setPw] = useState('');
  const [programs, setPrograms] = useState([]);
  const [program, setProgram] = useState(null);   // seçili programın detayı (+sections)
  const [rules, setRules] = useState([]);
  const [tab, setTab] = useState('programs');      // 'programs' | 'rules'
  const [msg, setMsg] = useState(null);            // { kind, text }
  const importRef = useRef(null);

  function flash(kind, text) { setMsg({ kind, text }); setTimeout(() => setMsg(null), 3500); }

  function loadPrograms() {
    api.adminPrograms().then((list) => {
      setAuth('ok');
      setPrograms(list);
      if (list[0]) selectProgram(list[0].id);
    }).catch((e) => {
      if (e.status === 401) setAuth('locked');
      else flash('bad', e.message);
    });
  }
  useEffect(loadPrograms, []);

  function submitPassword(e) {
    e.preventDefault();
    setAdminKey(pw.trim());
    setAuth('checking');
    loadPrograms();
  }
  function lock() {
    setAdminKey('');
    setPrograms([]); setProgram(null); setRules([]); setPw('');
    setAuth('locked');
  }

  function selectProgram(id) {
    api.adminProgram(id).then(setProgram).catch((e) => flash('bad', e.message));
  }

  function loadRules() {
    api.adminGlobalRules().then(setRules).catch((e) => flash('bad', e.message));
  }
  useEffect(() => { if (tab === 'rules') loadRules(); }, [tab]);

  // --- program alanı düzenleme ---
  function patchProgram(field, value) {
    setProgram((p) => ({ ...p, [field]: value }));
  }
  async function saveProgram() {
    try {
      const { id, label_tr, label_en, desc_tr, months, work_packages, scope_text, wp_body, active } = program;
      const saved = await api.adminUpdateProgram(id, {
        label_tr, label_en, desc_tr, months: Number(months), work_packages: Number(work_packages),
        scope_text, wp_body, active: active ? 1 : 0
      });
      setProgram((p) => ({ ...saved, sections: p.sections }));
      flash('ok', 'Program kaydedildi.');
    } catch (e) { flash('bad', e.message); }
  }

  // --- bölüm kaydı (kayıt durumu/dirty takibi SectionCard içinde) ---
  async function saveSection(draft) {
    await api.adminUpdateSection(draft.id, {
      title: draft.title,
      prompt_body: draft.prompt_body,
      max_chars: draft.max_chars === '' || draft.max_chars == null ? null : Number(draft.max_chars),
      target_words: draft.target_words === '' || draft.target_words == null ? null : Number(draft.target_words)
    });
  }

  // --- ortak kurallar ---
  async function addRule() {
    try { await api.adminCreateGlobalRule({ title: 'Yeni Kural', body: '', sort: rules.length }); loadRules(); }
    catch (e) { flash('bad', e.message); }
  }
  function patchRule(id, field, value) {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  async function saveRule(r) {
    try { await api.adminUpdateGlobalRule(r.id, { title: r.title, body: r.body, sort: r.sort }); flash('ok', 'Kural kaydedildi.'); }
    catch (e) { flash('bad', e.message); }
  }
  async function deleteRule(id) {
    if (!confirm('Bu ortak kural silinsin mi?')) return;
    try { await api.adminDeleteGlobalRule(id); loadRules(); } catch (e) { flash('bad', e.message); }
  }

  // --- dışa aktar (parolayı başlıkta taşır, BASE'e duyarlı; tarayıcıda indirir) ---
  async function doExport() {
    try {
      const data = await api.adminExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bilgi-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { flash('bad', `Dışa aktarma başarısız: ${e.message}`); }
  }

  // --- içe aktar ---
  async function onImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('İçe aktarma TÜM mevcut bilgiyi değiştirir. Devam edilsin mi?')) { e.target.value = ''; return; }
    try {
      const data = JSON.parse(await file.text());
      await api.adminImport(data);
      flash('ok', 'Bilgi içe aktarıldı.');
      loadPrograms();
      if (tab === 'rules') loadRules();
    } catch (err) { flash('bad', `İçe aktarma başarısız: ${err.message}`); }
    finally { e.target.value = ''; }
  }

  // --- parola kapısı ---
  if (auth !== 'ok') {
    return (
      <div className="admin admin-gate">
        <div className="card gate-card">
          <h2>Bilgi Yönetimi</h2>
          <p className="muted">Bu alan paroleyle korunmaktadır.</p>
          {auth === 'checking' ? (
            <p className="muted">Kontrol ediliyor…</p>
          ) : (
            <form onSubmit={submitPassword}>
              <label className="field"><span>Yönetim Parolası</span>
                <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" /></label>
              {msg && msg.kind === 'bad' && <p className="save-hint err">{msg.text}</p>}
              <div className="admin-actions" style={{ marginTop: 14 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!pw.trim()}>Giriş</button>
                <Link to="/" className="btn btn-sm">← Projeler</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="page-head">
        <div>
          <h1>Bilgi Yönetimi</h1>
          <p className="muted">Programlar, bölüm prompt'ları, kapsam, iş paketleri ve ortak kurallar — değişiklikler bir sonraki üretimde geçerli olur.</p>
        </div>
        <div className="admin-actions">
          <Link to="/" className="btn btn-sm">← Projeler</Link>
          <button className="btn btn-sm" onClick={doExport}>Dışa Aktar (JSON)</button>
          <button className="btn btn-sm" onClick={() => importRef.current?.click()}>İçe Aktar</button>
          <button className="btn btn-sm" onClick={lock} title="Oturumu kilitle">Kilitle</button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
        </div>
      </div>

      {msg && <div className={`admin-flash ${msg.kind === 'ok' ? 'flash-ok' : 'flash-bad'}`}>{msg.text}</div>}

      <div className="admin-tabs">
        <button className={tab === 'programs' ? 'active' : ''} onClick={() => setTab('programs')}>Programlar</button>
        <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>Ortak Kurallar</button>
      </div>

      {tab === 'programs' && (
        <div className="admin-grid">
          <aside className="admin-side">
            {programs.map((p) => (
              <button
                key={p.id}
                className={`admin-side-item ${program?.id === p.id ? 'active' : ''}`}
                onClick={() => selectProgram(p.id)}
              >
                <strong>{p.label_tr}</strong>
                <small>{p.months} ay · {p.work_packages} İP · {p.slug}</small>
              </button>
            ))}
          </aside>

          {program && (
            <div className="admin-main">
              <div className="card">
                <h2>Program Bilgileri</h2>
                <div className="admin-row">
                  <label className="field"><span>Ad (TR)</span>
                    <input value={program.label_tr || ''} onChange={(e) => patchProgram('label_tr', e.target.value)} /></label>
                  <label className="field" style={{ maxWidth: 120 }}><span>Süre (ay)</span>
                    <input type="number" value={program.months ?? ''} onChange={(e) => patchProgram('months', e.target.value)} /></label>
                  <label className="field" style={{ maxWidth: 120 }}><span>İş Paketi</span>
                    <input type="number" value={program.work_packages ?? ''} onChange={(e) => patchProgram('work_packages', e.target.value)} /></label>
                </div>
                <label className="field"><span>Kapsam ve Kurallar (intro'ya eklenir)</span>
                  <textarea rows={8} value={program.scope_text || ''} onChange={(e) => patchProgram('scope_text', e.target.value)} /></label>
                <label className="field"><span>Varsayılan İş Paketleri (Soru 7)</span>
                  <textarea rows={8} value={program.wp_body || ''} onChange={(e) => patchProgram('wp_body', e.target.value)} /></label>
                <div><button className="btn btn-primary btn-sm" onClick={saveProgram}>Programı Kaydet</button></div>
              </div>

              <h2 className="admin-sec-title">Bölümler ({program.sections?.length || 0})</h2>
              {(program.sections || []).map((s) => (
                <SectionCard key={s.id} section={s} onSave={saveSection} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'rules' && (
        <div className="admin-main">
          <div className="admin-actions" style={{ marginBottom: 16 }}>
            <button className="btn btn-sm" onClick={addRule}>+ Yeni Kural</button>
          </div>
          {rules.map((r) => (
            <div className="card admin-section" key={r.id}>
              <div className="admin-row">
                <label className="field"><span>Başlık</span>
                  <input value={r.title || ''} onChange={(e) => patchRule(r.id, 'title', e.target.value)} /></label>
                <label className="field" style={{ maxWidth: 110 }}><span>Sıra</span>
                  <input type="number" value={r.sort ?? 0} onChange={(e) => patchRule(r.id, 'sort', Number(e.target.value))} /></label>
              </div>
              <label className="field"><span>İçerik</span>
                <textarea rows={6} value={r.body || ''} onChange={(e) => patchRule(r.id, 'body', e.target.value)} /></label>
              <div className="admin-actions">
                <button className="btn btn-sm" onClick={() => saveRule(r)}>Kaydet</button>
                <button className="btn btn-sm" onClick={() => deleteRule(r.id)}>Sil</button>
              </div>
            </div>
          ))}
          {rules.length === 0 && <p className="muted">Henüz ortak kural yok.</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Tek bir bölümün düzenleyicisi — kendi taslağını (draft) ve kayıt durumunu
 * yönetir: boşta / değişti / kaydediliyor / kaydedildi / hata. Kaydet düğmesi
 * yalnızca kaydedilmemiş değişiklik varken etkinleşir; prompt için canlı
 * karakter sayacı uzunluk sınırını gösterir.
 */
function SectionCard({ section, onSave }) {
  const [draft, setDraft] = useState(section);
  const [status, setStatus] = useState('clean'); // clean | dirty | saving | saved | error
  const savedTimer = useRef(null);

  // Program/bölüm değişince taslağı sıfırla
  useEffect(() => { setDraft(section); setStatus('clean'); }, [section.id]);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  function patch(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
    setStatus((st) => (st === 'saving' ? st : 'dirty'));
  }

  async function save() {
    setStatus('saving');
    try {
      await onSave(draft);
      setStatus('saved');
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setStatus((st) => (st === 'saved' ? 'clean' : st)), 2200);
    } catch {
      setStatus('error');
    }
  }

  const len = (draft.prompt_body || '').length;
  const cap = draft.max_chars ? Number(draft.max_chars) : null;
  const over = cap != null && len > cap;
  const dirty = status === 'dirty';
  const saving = status === 'saving';
  const fmt = (n) => n.toLocaleString('tr-TR');

  const label = saving ? 'Kaydediliyor…'
    : status === 'saved' ? '✓ Kaydedildi'
    : status === 'error' ? 'Tekrar Dene'
    : dirty ? `Bölüm ${draft.number} Kaydet`
    : 'Kaydet';

  return (
    <div className={`card admin-section ${dirty ? 'is-dirty' : ''}`}>
      <div className="admin-row">
        <label className="field" style={{ maxWidth: 70 }}><span>Soru</span>
          <input value={draft.number} disabled /></label>
        <label className="field"><span>Başlık</span>
          <input value={draft.title || ''} onChange={(e) => patch('title', e.target.value)} /></label>
        <label className="field" style={{ maxWidth: 130 }}><span>Maks. karakter</span>
          <input type="number" placeholder="—" value={draft.max_chars ?? ''} onChange={(e) => patch('max_chars', e.target.value)} /></label>
        <label className="field" style={{ maxWidth: 130 }}><span>Hedef kelime</span>
          <input type="number" placeholder="—" value={draft.target_words ?? ''} onChange={(e) => patch('target_words', e.target.value)} /></label>
      </div>
      <label className="field">
        <span className="field-head">Prompt
          <small className={`char-count ${over ? 'over' : ''}`}>
            {fmt(len)}{cap != null ? ` / ${fmt(cap)}` : ''} karakter{over ? ' · sınır aşıldı' : ''}
          </small>
        </span>
        <textarea rows={10} value={draft.prompt_body || ''} onChange={(e) => patch('prompt_body', e.target.value)} />
      </label>
      <div className="admin-save-row">
        <button
          className={`btn btn-sm save-btn ${dirty || status === 'error' ? 'btn-primary' : ''} ${status === 'saved' ? 'is-saved' : ''}`}
          onClick={save}
          disabled={saving || status === 'clean' || status === 'saved'}
        >
          {saving && <span className="spinner" aria-hidden="true" />}{label}
        </button>
        {dirty && <span className="save-hint">Kaydedilmemiş değişiklik</span>}
        {status === 'clean' && <span className="save-hint muted-hint">Güncel</span>}
        {status === 'error' && <span className="save-hint err">Kaydedilemedi — tekrar deneyin</span>}
      </div>
    </div>
  );
}
