import { Link, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useI18n } from './i18n.jsx';

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [health, setHealth] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [setupDismissed, setSetupDismissed] = useState(() => localStorage.getItem('setupDismissed') === '1');
  const [loggingIn, setLoggingIn] = useState(false);

  function refreshHealth() {
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }
  useEffect(refreshHealth, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  function dismissSetup() {
    setSetupDismissed(true);
    localStorage.setItem('setupDismissed', '1');
  }

  async function chatgptLogin() {
    setLoggingIn(true);
    try {
      await api.chatgptLogin();
    } catch { /* ignore */ } finally {
      setLoggingIn(false);
      refreshHealth();
    }
  }

  const needsSetup = health && (!health.chatgptProfile || !health.googleConfigured);
  const missing = health
    ? [!health.chatgptProfile && 'ChatGPT', !health.googleConfigured && 'Google'].filter(Boolean).join(lang === 'tr' ? ' ve ' : ' & ')
    : '';

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">1831</span>
          <span className="brand-text">
            <strong>{t('brand.title')}</strong>
            <small>{t('brand.subtitle')}</small>
          </span>
        </Link>

        <div className="topbar-right">
          <Link to="/admin" className="btn btn-sm" title="Bilgi Yönetimi">Bilgi Yönetimi</Link>
          {health && (
            <div className="status-pills">
              <Pill ok={health.chatgptProfile} label="ChatGPT" t={t} />
              <Pill ok={health.googleConfigured} label="Google" t={t} />
            </div>
          )}
          {health && !health.chatgptProfile && (
            <button className="btn btn-sm" onClick={chatgptLogin} disabled={loggingIn}>
              {loggingIn ? t('chatgpt.loggingIn') : t('chatgpt.login')}
            </button>
          )}
          <div className="lang-toggle" role="group" aria-label="Language">
            <button className={lang === 'tr' ? 'active' : ''} aria-pressed={lang === 'tr'} onClick={() => setLang('tr')}>TR</button>
            <button className={lang === 'en' ? 'active' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
          </div>
          <button
            className="theme-toggle"
            aria-label={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}
            title={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}
            onClick={() => setTheme((x) => (x === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </header>

      {needsSetup && !setupDismissed && (
        <div className="setup-banner" role="status">
          <span>
            <strong>{t('setup.title')}.</strong> {t('setup.body', { what: missing })}
          </span>
          {!health.chatgptProfile && (
            <button onClick={chatgptLogin} disabled={loggingIn}>
              {loggingIn ? t('chatgpt.loggingIn') : t('chatgpt.login')}
            </button>
          )}
          <button onClick={dismissSetup}>{t('setup.dismiss')}</button>
        </div>
      )}

      <main className="content">
        <Outlet context={{ health }} />
      </main>
    </div>
  );
}

function Pill({ ok, label, t }) {
  return (
    <span className={`pill ${ok ? 'pill-ok' : 'pill-bad'}`} title={`${label}: ${ok ? t('pill.ready') : t('pill.notReady')}`}>
      <span className="dot" /> {label}
    </span>
  );
}
