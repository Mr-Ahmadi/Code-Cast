import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  FiRefreshCw, FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiLoader, FiChevronDown, FiChevronRight,
  FiCopy, FiCheck, FiEye, FiEyeOff, FiRadio, FiZap, FiInfo,
} from 'react-icons/fi';
import {
  PROVIDERS, PROVIDER_IDS, OPENAI_COMPATIBLE_PRESETS,
  resolveProvider, normalizeBaseUrl, modelAvailable, suggestModel, discoverServers,
} from '../../services/llm';
import { hasNativeTransport } from '../../services/aiTransport';
import { fetchModels, providerCacheKey as cacheKey } from '../../services/modelCache';
import { AI_FEATURES, SUGGESTED_MODELS } from '../../constants/settings';

/** Live model list and connection state for a provider. */
function useProviderStatus(provider, { debounceMs = 0 } = {}) {
  const [state, setState] = useState({ loading: true, ok: false, models: [], error: null, ms: 0 });
  const [nonce, setNonce] = useState(0);
  const forceRef = useRef(false);
  const key = cacheKey(provider);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(() => {
      const force = forceRef.current;
      forceRef.current = false;
      fetchModels(provider, { force })
        .then((result) => { if (alive) setState({ loading: false, ...result }); })
        .catch(() => { /* aborted */ });
    }, debounceMs);
    return () => { alive = false; clearTimeout(timer); };
    // provider is re-created every render; `key` captures what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, debounceMs]);

  const refresh = useCallback(() => {
    forceRef.current = true;
    setNonce((n) => n + 1);
  }, []);

  return { ...state, refresh };
}

/* ------------------------------------------------------------- small bits */

export function CopyCode({ children }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <span className="ai-code">
      <code>{children}</code>
      <button type="button" onClick={copy} title="Copy command" aria-label="Copy command">
        {copied ? <FiCheck size={11} /> : <FiCopy size={11} />}
      </button>
    </span>
  );
}

CopyCode.propTypes = { children: PropTypes.string.isRequired };

function StatusPill({ status, configured }) {
  if (!configured) return <span className="ai-pill">Not set up</span>;
  if (status.loading) return <span className="ai-pill"><FiLoader size={10} className="ai-spin" /> Checking</span>;
  if (!status.ok) return <span className="ai-pill ai-pill-bad"><FiAlertCircle size={10} /> Offline</span>;
  if (!status.models.length) return <span className="ai-pill ai-pill-warn"><FiAlertTriangle size={10} /> No models</span>;
  return (
    <span className="ai-pill ai-pill-ok">
      <FiCheckCircle size={10} /> {status.models.length} model{status.models.length === 1 ? '' : 's'}
    </span>
  );
}

StatusPill.propTypes = {
  status: PropTypes.object.isRequired,
  configured: PropTypes.bool,
};

const link = (href, text) => <a href={href} target="_blank" rel="noreferrer">{text}</a>;

const PROVIDER_UI = {
  ollama: {
    mono: 'OL',
    tagline: 'Runs open models on this computer. The easiest way to start.',
    steps: () => [
      <>Install Ollama from {link('https://ollama.com/download', 'ollama.com')} and open it.</>,
      <>Download a small code model for autocomplete: <CopyCode>ollama pull qwen2.5-coder:1.5b</CopyCode></>,
      <>For chat and inline edit, a larger one: <CopyCode>ollama pull qwen2.5-coder:7b</CopyCode></>,
    ],
  },
  lmstudio: {
    mono: 'LM',
    tagline: 'Desktop app for downloading and serving models, with a built-in local server.',
    steps: () => [
      <>Install {link('https://lmstudio.ai', 'LM Studio')} and download a model from its Discover tab.</>,
      <>Open the <b>Developer</b> tab and switch the server <b>on</b> (port 1234).</>,
      <>Turn on <b>Just-in-Time model loading</b> so Code Cast can switch models by itself.</>,
      ...(hasNativeTransport() ? [] : [<>Browser only: enable <b>CORS</b> in the server settings.</>]),
    ],
  },
  openai: {
    mono: 'API',
    tagline: 'Any OpenAI-compatible server: llama.cpp, Jan, vLLM, LocalAI — or OpenAI, OpenRouter, Groq.',
    steps: () => [
      <>Start your server, e.g. <CopyCode>llama-server -m model.gguf --port 8080</CopyCode></>,
      <>Pick a preset below or paste its URL (it usually ends in <code>/v1</code>).</>,
      <>Hosted services also need an API key.</>,
    ],
  },
};

/* -------------------------------------------------------- provider cards */

function ProviderCard({ id, localSettings, updateLocal, onOpenModels, expanded, onToggle }) {
  const meta = PROVIDERS[id];
  const ui = PROVIDER_UI[id];
  const conf = localSettings.aiProviders?.[id] || {};
  const provider = resolveProvider(localSettings, id);
  const configured = !!provider.baseUrl;
  const status = useProviderStatus(provider, { debounceMs: 600 });
  const [showKey, setShowKey] = useState(false);
  const [flash, setFlash] = useState('');

  const usedBy = AI_FEATURES.filter((f) => (localSettings[f.section]?.provider || 'ollama') === id);
  const poweringAll = usedBy.length === AI_FEATURES.length;
  const connected = configured && !status.loading && status.ok;
  const tone = !configured || status.loading ? 'idle' : !status.ok ? 'bad' : status.models.length ? 'ok' : 'warn';

  const setField = (key, value) => {
    setFlash('');
    updateLocal('aiProviders', id, { ...conf, [key]: value });
  };

  const useForAll = () => {
    for (const feature of AI_FEATURES) {
      const current = localSettings[feature.section] || {};
      const keep = current.provider === id && modelAvailable(status.models, current.model);
      updateLocal(feature.section, {
        provider: id,
        model: keep ? current.model : suggestModel(status.models, feature.role),
      });
    }
    setFlash(`Every AI feature now uses ${meta.label}. Click Apply to save.`);
  };

  const steps = ui.steps();

  let callout;
  if (!configured) {
    callout = (
      <div className="ai-callout">
        <FiInfo size={15} />
        <div className="ai-callout-body">
          <span className="ai-callout-title">Set up {meta.label}</span>
          <ol>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      </div>
    );
  } else if (status.loading) {
    callout = (
      <div className="ai-callout">
        <FiLoader size={15} className="ai-spin" />
        <div className="ai-callout-body"><span>Connecting to {provider.baseUrl}…</span></div>
      </div>
    );
  } else if (!status.ok) {
    callout = (
      <div className="ai-callout bad">
        <FiAlertCircle size={15} />
        <div className="ai-callout-body">
          <span className="ai-callout-title">Can&apos;t connect to {meta.label}</span>
          <span>{(status.error || '').split(/\.\s/)[0].replace(/\.$/, '')}.</span>
          <span className="ai-callout-subtitle">To fix it</span>
          <ol>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <div>
            <button type="button" className="btn aip-btn" onClick={status.refresh}>
              <FiRefreshCw size={12} /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  } else if (!status.models.length) {
    callout = (
      <div className="ai-callout warn">
        <FiAlertTriangle size={15} />
        <div className="ai-callout-body">
          <span className="ai-callout-title">Connected, but there are no models yet</span>
          <ol>{steps.slice(1).map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      </div>
    );
  } else {
    callout = (
      <div className="ai-callout ok">
        <FiCheckCircle size={15} />
        <div className="ai-callout-body">
          <span className="ai-callout-title">
            Connected in {status.ms} ms · {status.models.length} model{status.models.length === 1 ? '' : 's'} available
          </span>
          <div className="aip-model-chips">
            {status.models.slice(0, 8).map((m) => <span key={m} className="aip-model-chip">{m}</span>)}
            {status.models.length > 8 && (
              <button type="button" className="aip-link" onClick={onOpenModels}>+{status.models.length - 8} more</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={`aip-card aip-${tone}${expanded ? ' open' : ''}`}>
      <div
        className="aip-head"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
      >
        <span className={`aip-logo aip-logo-${id}`}>{ui.mono}</span>
        <span className="aip-title">
          <span className="aip-name">{meta.label}</span>
          <span className="aip-sub">{configured ? provider.baseUrl : 'Not set up yet'}</span>
        </span>
        {usedBy.length > 0 && (
          <span className="aip-usage">
            {poweringAll ? 'All features' : `${usedBy.length} feature${usedBy.length === 1 ? '' : 's'}`}
          </span>
        )}
        <StatusPill status={status} configured={configured} />
        <button
          type="button"
          className="ai-icon-btn"
          onClick={(e) => { e.stopPropagation(); status.refresh(); }}
          disabled={!configured || status.loading}
          title="Test connection"
          aria-label={`Test ${meta.label} connection`}
        >
          <FiRefreshCw size={12} className={configured && status.loading ? 'ai-spin' : ''} />
        </button>
        <span className="aip-chevron">{expanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}</span>
      </div>

      {expanded && (
        <div className="aip-body">
          <p className="aip-tagline">{ui.tagline}</p>

          {callout}

          <div className="aip-fields">
            {id === 'openai' && (
              <div className="settings-field">
                <span className="settings-field-label">Presets</span>
                <div className="aip-presets">
                  {OPENAI_COMPATIBLE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`ai-chip-btn${provider.baseUrl === normalizeBaseUrl(p.url, 'openai') ? ' active' : ''}`}
                      onClick={() => setField('baseUrl', p.url)}
                      title={p.url}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="settings-field">
              <div className="aip-label-row">
                <span className="settings-field-label">Server URL</span>
                {meta.defaultUrl && (conf.baseUrl ?? meta.defaultUrl) !== meta.defaultUrl && (
                  <button type="button" className="aip-link" onClick={() => setField('baseUrl', meta.defaultUrl)}>
                    Reset to {meta.defaultUrl}
                  </button>
                )}
              </div>
              <input
                type="text"
                className="settings-input"
                value={conf.baseUrl ?? ''}
                onChange={(e) => setField('baseUrl', e.target.value)}
                placeholder={meta.defaultUrl || 'http://localhost:8080/v1'}
                aria-label={`${meta.label} server URL`}
                spellCheck={false}
              />
            </div>

            {id === 'openai' && (
              <div className="settings-field">
                <span className="settings-field-label">
                  API key <span className="aip-optional">optional for local servers · stored only on this device</span>
                </span>
                <div className="ai-model-row">
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="settings-input"
                    value={conf.apiKey ?? ''}
                    onChange={(e) => setField('apiKey', e.target.value)}
                    placeholder="sk-…"
                    aria-label="API key"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="ai-icon-btn"
                    onClick={() => setShowKey((v) => !v)}
                    title={showKey ? 'Hide key' : 'Show key'}
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showKey ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {connected && (
            <div className="aip-actions">
              {status.models.length > 0 && (poweringAll ? (
                <span className="ai-pill ai-pill-ok"><FiCheckCircle size={10} /> Powers every AI feature</span>
              ) : (
                <button type="button" className="btn btn-primary aip-btn" onClick={useForAll}>
                  <FiZap size={12} /> Use for all AI features
                </button>
              ))}
              {onOpenModels && (
                <button type="button" className="btn aip-btn" onClick={onOpenModels}>Choose models per feature</button>
              )}
              {flash && <span className="ai-field-note ok">{flash}</span>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

ProviderCard.propTypes = {
  id: PropTypes.string.isRequired,
  localSettings: PropTypes.object.isRequired,
  updateLocal: PropTypes.func.isRequired,
  onOpenModels: PropTypes.func,
  expanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
};

export function AiProvidersSection({ localSettings, updateLocal, onOpenModels }) {
  const [open, setOpen] = useState(() => Object.fromEntries(PROVIDER_IDS.map((id) => [
    id,
    AI_FEATURES.some((f) => (localSettings[f.section]?.provider || 'ollama') === id),
  ])));
  const [scan, setScan] = useState(null);

  const runScan = async () => {
    setScan({ running: true, results: [] });
    try {
      setScan({ running: false, results: await discoverServers() });
    } catch {
      setScan({ running: false, results: [] });
    }
  };

  const connect = (target) => {
    updateLocal('aiProviders', target.providerId, {
      ...(localSettings.aiProviders?.[target.providerId] || {}),
      baseUrl: target.url,
    });
    setOpen((o) => ({ ...o, [target.providerId]: true }));
  };

  const found = scan?.results?.filter((t) => t.ok) || [];
  const missing = scan?.results?.filter((t) => !t.ok) || [];

  return (
    <div className="settings-section">
      <div className="aip-hero">
        <div>
          <h4 className="settings-section-title">AI Providers</h4>
          <p className="settings-section-desc">
            Connect the servers that run your models, then choose a model for each feature
            in{' '}
            {onOpenModels
              ? <button type="button" className="aip-link aip-link-inline" onClick={onOpenModels}>Models</button>
              : 'Models'}.
          </p>
        </div>
        <button type="button" className="btn aip-btn" onClick={runScan} disabled={scan?.running}>
          <FiRadio size={12} className={scan?.running ? 'ai-spin' : ''} />
          {scan?.running ? 'Searching…' : 'Find servers'}
        </button>
      </div>

      {scan && !scan.running && (
        <div className="aip-scan">
          <div className="aip-label-row">
            <span className="settings-field-label">Servers running on this computer</span>
            <button type="button" className="aip-link" onClick={() => setScan(null)}>Dismiss</button>
          </div>
          {found.length === 0 && (
            <div className="aip-scan-row">
              <FiAlertCircle size={13} className="ai-bad-icon" />
              <span>No model server answered on the usual ports. Start Ollama or the LM Studio server and search again.</span>
            </div>
          )}
          {found.map((t) => {
            const inUse = resolveProvider(localSettings, t.providerId).baseUrl === t.url;
            return (
              <div key={`${t.label}|${t.url}`} className="aip-scan-row">
                <FiCheckCircle size={13} className="ai-ok-icon" />
                <span className="aip-scan-name">{t.label}</span>
                <span className="aip-sub">{t.url} · {t.models.length} model{t.models.length === 1 ? '' : 's'}</span>
                {inUse ? (
                  <span className="ai-pill ai-pill-ok">Connected</span>
                ) : (
                  <button type="button" className="btn aip-btn" onClick={() => connect(t)}>Connect</button>
                )}
              </div>
            );
          })}
          {missing.length > 0 && (
            <span className="ai-field-note">Not running: {missing.map((t) => t.label).join(', ')}</span>
          )}
        </div>
      )}

      <div className="aip-list">
        {PROVIDER_IDS.map((id) => (
          <ProviderCard
            key={id}
            id={id}
            localSettings={localSettings}
            updateLocal={updateLocal}
            onOpenModels={onOpenModels}
            expanded={!!open[id]}
            onToggle={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
          />
        ))}
      </div>

      <p className="ai-field-note">
        {hasNativeTransport()
          ? 'The desktop app sends these requests itself, so no server needs CORS configured.'
          : 'Running in a browser: each server must allow this page’s origin (CORS). The desktop app has no such limit.'}
      </p>
    </div>
  );
}

AiProvidersSection.propTypes = {
  localSettings: PropTypes.object.isRequired,
  updateLocal: PropTypes.func.isRequired,
  onOpenModels: PropTypes.func,
};

/* ------------------------------------------------------ per-feature field */

export function FeatureModelFields({ section, localSettings, updateLocal, disabled, onOpenProviders }) {
  const conf = localSettings[section] || {};
  const role = AI_FEATURES.find((f) => f.section === section)?.role || 'chat';
  const provider = resolveProvider(localSettings, conf.provider);
  const status = useProviderStatus(provider);
  const listId = `ai-models-${section}`;

  const suggestions = status.models.length
    ? status.models
    : provider.id === 'ollama' ? SUGGESTED_MODELS : [];

  const changeProvider = async (id) => {
    updateLocal(section, 'provider', id);
    const result = await fetchModels(resolveProvider(localSettings, id));
    if (result.ok && result.models.length && !modelAvailable(result.models, conf.model)) {
      updateLocal(section, 'model', suggestModel(result.models, role));
    }
  };

  let note = null;
  if (!provider.baseUrl) {
    note = { tone: 'warn', text: `${provider.label} has no server URL yet.`, link: true };
  } else if (status.loading) {
    note = { tone: '', text: `Loading models from ${provider.label}…` };
  } else if (!status.ok) {
    note = { tone: 'bad', text: status.error, link: true };
  } else if (!status.models.length) {
    note = {
      tone: 'warn',
      text: provider.id === 'ollama'
        ? `No models installed. Run \`ollama pull ${conf.model || 'qwen2.5-coder:1.5b'}\`.`
        : `${provider.label} lists no models. Download or load one first.`,
    };
  } else if (!conf.model) {
    note = { tone: 'warn', text: 'Pick a model.' };
  } else if (!modelAvailable(status.models, conf.model)) {
    note = {
      tone: 'warn',
      text: provider.id === 'ollama'
        ? `"${conf.model}" is not installed. Run \`ollama pull ${conf.model}\` or pick one from the list.`
        : `"${conf.model}" is not available on ${provider.label}. Pick one from the list.`,
    };
  } else {
    note = { tone: 'ok', text: `Ready on ${provider.label}.` };
  }

  return (
    <>
      <label className="settings-field">
        <span className="settings-field-label">Provider</span>
        <select
          className="settings-select"
          value={provider.id}
          onChange={(e) => changeProvider(e.target.value)}
          disabled={disabled}
        >
          {PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>{PROVIDERS[id].label}</option>
          ))}
        </select>
      </label>

      <div className="settings-field">
        <span className="settings-field-label">Model</span>
        <div className="ai-model-row">
          <input
            type="text"
            className="settings-input"
            list={listId}
            value={conf.model || ''}
            onChange={(e) => updateLocal(section, 'model', e.target.value)}
            placeholder={suggestions[0] || 'model name'}
            disabled={disabled}
            spellCheck={false}
          />
          <datalist id={listId}>
            {suggestions.map((m) => <option key={m} value={m} />)}
          </datalist>
          <button
            type="button"
            className="ai-icon-btn"
            onClick={status.refresh}
            disabled={disabled || status.loading}
            title="Reload model list"
            aria-label="Reload model list"
          >
            <FiRefreshCw size={12} className={status.loading ? 'ai-spin' : ''} />
          </button>
        </div>
        {note && !disabled && (
          <span className={`ai-field-note ${note.tone}`}>
            {note.text}
            {note.link && onOpenProviders && (
              <> <a href="#" onClick={(e) => { e.preventDefault(); onOpenProviders(); }}>Open Providers</a></>
            )}
            {!note.link && window.__openSettings && (
              <> <a href="#" onClick={(e) => { e.preventDefault(); window.__openSettings('aiModels'); }}>Browse all models</a></>
            )}
          </span>
        )}
      </div>
    </>
  );
}

FeatureModelFields.propTypes = {
  section: PropTypes.string.isRequired,
  localSettings: PropTypes.object.isRequired,
  updateLocal: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  onOpenProviders: PropTypes.func,
};
