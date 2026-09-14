import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  FiRefreshCw, FiDownload, FiLoader, FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiSearch, FiX,
  FiCpu, FiMessageSquare, FiZap, FiGitCommit, FiBookOpen, FiTerminal, FiCloud, FiTool,
} from 'react-icons/fi';
import {
  PROVIDERS, PROVIDER_IDS, resolveProvider, listModelDetails, pullOllamaModel,
  modelAvailable, suggestModel, isAbortError,
} from '../../services/llm';
import { AI_FEATURES } from '../../constants/settings';
import { invalidateModelCache } from '../../services/modelCache';

const CAPABILITY_LABELS = {
  fim: 'Autocomplete',
  code: 'Code',
  chat: 'Chat',
  thinking: 'Thinking',
  vision: 'Vision',
  tools: 'Tools',
  embedding: 'Embedding',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'code', label: 'Code' },
  { id: 'fim', label: 'Autocomplete' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'vision', label: 'Vision' },
];

const FEATURE_UI = {
  aiAutocomplete: { icon: FiCpu, hint: 'Small FIM code model, fastest' },
  aiChat: { icon: FiMessageSquare, hint: 'Biggest code model that runs well' },
  aiEdit: { icon: FiZap, hint: 'Code model, same as chat is fine' },
  commitMessage: { icon: FiGitCommit, hint: 'Any small, fast model' },
  playbackExplanation: { icon: FiBookOpen, hint: 'Any small, fast model' },
  terminalAI: { icon: FiTerminal, hint: 'Any small, fast model' },
};

const RECOMMENDED_OLLAMA = [
  { name: 'qwen2.5-coder:1.5b-base', why: 'autocomplete' },
  { name: 'qwen2.5-coder:7b', why: 'chat & edit' },
  { name: 'qwen2.5-coder:3b', why: 'chat, low memory' },
];

const usable = (models) => models.filter((m) => !m.capabilities.includes('embedding'));

function formatBytes(bytes) {
  if (!bytes) return '';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

export default function AiModelsSection({ localSettings, updateLocal, onOpenProviders }) {
  const [results, setResults] = useState({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [pullName, setPullName] = useState('');
  const [pull, setPull] = useState(null);
  const pullAbort = useRef(null);
  const loadSeq = useRef({});

  const providers = useMemo(
    () => PROVIDER_IDS.map((id) => resolveProvider(localSettings, id)),
    // Only the provider block decides where models come from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localSettings.aiProviders],
  );
  const providersKey = providers.map((p) => `${p.id}|${p.baseUrl}|${p.apiKey ? 'key' : ''}`).join(',');

  const load = useCallback((id) => {
    const provider = providers.find((p) => p.id === id);
    const seq = (loadSeq.current[id] || 0) + 1;
    loadSeq.current[id] = seq;
    const current = () => loadSeq.current[id] === seq;

    if (!provider?.baseUrl) {
      setResults((r) => ({ ...r, [id]: { loading: false, ok: false, configured: false, models: [], error: null } }));
      return;
    }
    setResults((r) => ({ ...r, [id]: { ...(r[id] || { models: [] }), configured: true, loading: true } }));
    listModelDetails(provider)
      .then((models) => {
        if (current()) setResults((r) => ({ ...r, [id]: { loading: false, ok: true, configured: true, models, error: null } }));
      })
      .catch((err) => {
        if (current()) setResults((r) => ({ ...r, [id]: { loading: false, ok: false, configured: true, models: [], error: err?.message || 'Failed to list models' } }));
      });
  }, [providers]);

  const refreshAll = useCallback(() => {
    invalidateModelCache();
    PROVIDER_IDS.forEach(load);
  }, [load]);

  // Debounced so editing a server URL does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => PROVIDER_IDS.forEach(load), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providersKey]);

  useEffect(() => () => pullAbort.current?.abort(), []);

  const connectedIds = PROVIDER_IDS.filter((id) => results[id]?.ok && usable(results[id].models).length);
  const anyLoading = PROVIDER_IDS.some((id) => results[id]?.loading || !results[id]);

  /* ------------------------------------------------------ assignments */

  const featureState = (feature) => {
    const conf = localSettings[feature.section] || {};
    const pid = conf.provider || 'ollama';
    const res = results[pid];
    if (!res || res.loading) return { pid, state: 'loading', match: conf.model || '' };
    if (!res.ok) return { pid, state: 'bad', match: conf.model || '' };
    const match = res.models.find((m) => modelAvailable([m.id], conf.model))?.id;
    return { pid, state: match ? 'ok' : 'warn', match: match || conf.model || '' };
  };

  const needsFix = AI_FEATURES.filter((f) => ['warn', 'bad'].includes(featureState(f).state));

  const fixMissing = () => {
    for (const feature of needsFix) {
      const { pid } = featureState(feature);
      const target = connectedIds.includes(pid) ? pid : connectedIds[0];
      if (!target) continue;
      const pick = suggestModel(usable(results[target].models).map((m) => m.id), feature.role);
      if (pick) updateLocal(feature.section, { provider: target, model: pick });
    }
  };

  const usedBy = (providerId, modelId) => AI_FEATURES
    .filter((f) => {
      const conf = localSettings[f.section] || {};
      return (conf.provider || 'ollama') === providerId && modelAvailable([modelId], conf.model);
    })
    .map((f) => f.label);

  const assign = (target, providerId, modelId) => {
    const sections = target === '__all' ? AI_FEATURES.map((f) => f.section) : [target];
    for (const section of sections) updateLocal(section, { provider: providerId, model: modelId });
  };

  /* ------------------------------------------------------------- pull */

  const startPull = async (nameArg) => {
    const name = (nameArg ?? pullName).trim();
    if (!name || pull?.running) return;
    const controller = new AbortController();
    pullAbort.current = controller;
    setPullName(name);
    setPull({ name, status: 'Starting…', pct: 0, running: true, error: null });
    try {
      await pullOllamaModel(resolveProvider(localSettings, 'ollama'), name, {
        signal: controller.signal,
        onProgress: ({ status, total, completed }) => setPull((p) => ({
          ...p,
          status,
          pct: total ? Math.round((completed / total) * 100) : p.pct,
        })),
      });
      setPull({ name, status: 'done', pct: 100, running: false, error: null });
      setPullName('');
      invalidateModelCache();
      load('ollama');
    } catch (err) {
      setPull((p) => ({ ...p, running: false, error: isAbortError(err) ? 'Download cancelled.' : err?.message }));
    } finally {
      pullAbort.current = null;
    }
  };

  /* ----------------------------------------------------------- render */

  const q = query.trim().toLowerCase();
  const matchesQuery = (m) => !q || m.id.toLowerCase().includes(q);
  const filterCount = (fid) => connectedIds.reduce((n, id) => n + results[id].models
    .filter((m) => matchesQuery(m) && (fid === 'all' || m.capabilities.includes(fid))).length, 0);

  const renderAssignments = () => (
    <section className="aim-card">
      <div className="aim-card-head">
        <div className="aim-card-heading">
          <span className="aim-card-title">Feature models</span>
          <span className="aim-card-sub">Choose which model runs each AI feature.</span>
        </div>
        {needsFix.length > 0 && connectedIds.length > 0 && (
          <button type="button" className="btn btn-primary aip-btn" onClick={fixMissing}>
            <FiTool size={12} /> Fix {needsFix.length} missing
          </button>
        )}
      </div>
      <div className="aim-features">
        {AI_FEATURES.map((feature) => {
          const conf = localSettings[feature.section] || {};
          const { pid, state, match } = featureState(feature);
          const Icon = FEATURE_UI[feature.section]?.icon || FiCpu;
          const value = `${pid}::${match}`;
          const listed = connectedIds.includes(pid) && results[pid].models.some((m) => m.id === match);
          const stateUi = {
            ok: { icon: <FiCheckCircle size={12} />, text: 'Ready' },
            warn: { icon: <FiAlertTriangle size={12} />, text: match ? 'Not installed' : 'No model' },
            bad: { icon: <FiAlertCircle size={12} />, text: `${PROVIDERS[pid].label} offline` },
            loading: { icon: <FiLoader size={12} className="ai-spin" />, text: 'Checking' },
          }[state];

          return (
            <div key={feature.section} className={`aim-feature${conf.enabled === false ? ' is-off' : ''}`}>
              <span className="aim-feature-icon"><Icon size={14} /></span>
              <span className="aim-feature-text">
                <span className="aim-feature-name">
                  {feature.label}
                  {conf.enabled === false && <span className="ai-pill">Off</span>}
                </span>
                <span className="aim-feature-hint">{FEATURE_UI[feature.section]?.hint}</span>
              </span>
              <select
                className="settings-select aim-feature-select"
                value={value}
                onChange={(e) => {
                  const [provider, ...rest] = e.target.value.split('::');
                  updateLocal(feature.section, { provider, model: rest.join('::') });
                }}
                aria-label={`Model for ${feature.label}`}
              >
                {!listed && (
                  <option value={value}>
                    {PROVIDERS[pid].label} · {match || 'no model'}
                    {state === 'bad' ? ' (offline)' : state === 'warn' ? ' (not installed)' : ''}
                  </option>
                )}
                {connectedIds.map((id) => (
                  <optgroup key={id} label={PROVIDERS[id].label}>
                    {usable(results[id].models).map((m) => (
                      <option key={m.id} value={`${id}::${m.id}`}>
                        {m.id}{m.parameters ? ` — ${m.parameters}` : ''}
                        {feature.role === 'completion' && m.capabilities.includes('fim') ? ' · FIM' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className={`aim-state aim-state-${state}`}>{stateUi.icon}{stateUi.text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderRow = (id, m) => {
    const used = usedBy(id, m.id);
    const details = [
      m.parameters,
      m.quantization,
      formatBytes(m.bytes),
      m.contextLength ? `${Math.round(m.contextLength / 1000)}k context` : '',
    ].filter(Boolean).join(' · ');

    return (
      <div key={m.id} className="aim-row">
        <div className="aim-row-main">
          <div className="aim-row-title">
            <span className="aim-name" title={m.id}>{m.id}</span>
            {m.location === 'cloud' && <span className="ai-pill ai-pill-accent"><FiCloud size={10} /> Cloud</span>}
            {m.loaded && <span className="ai-pill ai-pill-ok">{id === 'ollama' ? 'In memory' : 'Loaded'}</span>}
          </div>
          <div className="aim-row-meta">
            {details && <span>{details}</span>}
            <span className="aim-caps">
              {m.capabilities.map((c) => (
                <span key={c} className={`aim-cap aim-cap-${c}`}>{CAPABILITY_LABELS[c] || c}</span>
              ))}
            </span>
          </div>
        </div>
        <div className="aim-row-side">
          {used.length > 0 && (
            <span className="aim-used" title={`Used by ${used.join(', ')}`}>
              {used.length === AI_FEATURES.length
                ? <span className="aim-used-chip">All features</span>
                : used.map((u) => <span key={u} className="aim-used-chip">{u}</span>)}
            </span>
          )}
          {!m.capabilities.includes('embedding') && (
            <select
              className="settings-select aim-use"
              value=""
              onChange={(e) => { if (e.target.value) assign(e.target.value, id, m.id); }}
              aria-label={`Use ${m.id} for a feature`}
            >
              <option value="">Use for…</option>
              <option value="__all">All features</option>
              {AI_FEATURES.map((f) => <option key={f.section} value={f.section}>{f.label}</option>)}
            </select>
          )}
        </div>
      </div>
    );
  };

  const renderPull = (installed) => {
    const ids = installed.map((m) => m.id);
    const recommended = RECOMMENDED_OLLAMA.filter((r) => !modelAvailable(ids, r.name));
    return (
      <div className="aim-pull">
        <span className="settings-field-label">Download a model</span>
        <div className="aim-pull-row">
          <input
            className="settings-input"
            value={pullName}
            onChange={(e) => setPullName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') startPull(); }}
            placeholder="Model name, e.g. qwen2.5-coder:7b"
            aria-label="Model to download"
            disabled={pull?.running}
            spellCheck={false}
          />
          {pull?.running ? (
            <button type="button" className="btn aip-btn" onClick={() => pullAbort.current?.abort()}>
              <FiX size={12} /> Cancel
            </button>
          ) : (
            <button type="button" className="btn btn-primary aip-btn" onClick={() => startPull()} disabled={!pullName.trim()}>
              <FiDownload size={12} /> Download
            </button>
          )}
        </div>
        {pull && (
          <div className="aim-pull-status">
            {pull.running && <div className="ai-progress"><span style={{ width: `${pull.pct}%` }} /></div>}
            <span className={`ai-field-note ${pull.error ? 'bad' : pull.running ? '' : 'ok'}`}>
              {pull.error
                ? `${pull.name}: ${pull.error}`
                : pull.running
                  ? `${pull.name} — ${pull.status}${pull.pct ? ` (${pull.pct}%)` : ''}`
                  : `${pull.name} is ready to use.`}
            </span>
          </div>
        )}
        {!pull?.running && (
          <div className="aim-pull-suggest">
            {recommended.length > 0 && <span className="ai-field-note">Suggested:</span>}
            {recommended.map((r) => (
              <button key={r.name} type="button" className="ai-chip-btn" onClick={() => startPull(r.name)} title={`Download ${r.name}`}>
                <FiDownload size={10} /> {r.name} <span className="aim-chip-why">{r.why}</span>
              </button>
            ))}
            <a className="aim-browse" href="https://ollama.com/search?c=code" target="_blank" rel="noreferrer">Browse ollama.com</a>
          </div>
        )}
      </div>
    );
  };

  const renderProvider = (id) => {
    const provider = providers.find((p) => p.id === id);
    const res = results[id];
    if (!provider.baseUrl) return null;

    if (res && !res.loading && !res.ok) {
      return (
        <div key={id} className="aim-card aim-offline">
          <span className={`aip-logo aip-logo-${id} aip-logo-sm`}>{id === 'openai' ? 'API' : id === 'ollama' ? 'OL' : 'LM'}</span>
          <span className="aim-offline-text">
            <span className="aim-card-title">{PROVIDERS[id].label}</span>
            <span className="aim-card-sub">Not running at {provider.baseUrl}</span>
          </span>
          <button type="button" className="ai-icon-btn" onClick={() => load(id)} title="Try again" aria-label={`Retry ${PROVIDERS[id].label}`}>
            <FiRefreshCw size={12} />
          </button>
          {onOpenProviders && <button type="button" className="btn aip-btn" onClick={onOpenProviders}>How to start it</button>}
        </div>
      );
    }

    const models = [...(res?.models || [])]
      .filter((m) => matchesQuery(m) && (filter === 'all' || m.capabilities.includes(filter)))
      // Models in use first, then alphabetical; embeddings sink to the bottom.
      .sort((a, b) => (usedBy(id, b.id).length > 0) - (usedBy(id, a.id).length > 0)
        || a.capabilities.includes('embedding') - b.capabilities.includes('embedding')
        || a.id.localeCompare(b.id));
    const loaded = (res?.models || []).filter((m) => m.loaded).length;

    return (
      <section key={id} className="aim-card">
        <div className="aim-card-head">
          <span className={`aip-logo aip-logo-${id} aip-logo-sm`}>{id === 'openai' ? 'API' : id === 'ollama' ? 'OL' : 'LM'}</span>
          <div className="aim-card-heading">
            <span className="aim-card-title">{PROVIDERS[id].label}</span>
            <span className="aim-card-sub">
              {!res || res.loading
                ? 'Loading models…'
                : `${res.models.length} model${res.models.length === 1 ? '' : 's'}${loaded ? ` · ${loaded} ${id === 'ollama' ? 'in memory' : 'loaded'}` : ''} · ${provider.baseUrl}`}
            </span>
          </div>
          <button
            type="button"
            className="ai-icon-btn"
            onClick={() => { invalidateModelCache(); load(id); }}
            disabled={res?.loading}
            title="Reload models"
            aria-label={`Reload ${PROVIDERS[id].label} models`}
          >
            <FiRefreshCw size={12} className={res?.loading ? 'ai-spin' : ''} />
          </button>
        </div>

        {(!res || res.loading) && !res?.models?.length && (
          <div className="aim-placeholder"><FiLoader size={13} className="ai-spin" /> Loading models…</div>
        )}
        {res?.ok && res.models.length === 0 && (
          <div className="aim-placeholder">
            <FiAlertTriangle size={13} />
            {id === 'ollama' ? 'No models installed yet — download one below.' : 'This server lists no models. Download or load one first.'}
          </div>
        )}
        {res?.ok && res.models.length > 0 && models.length === 0 && (
          <div className="aim-placeholder">No {PROVIDERS[id].label} models match your search.</div>
        )}
        {models.length > 0 && <div className="aim-rows">{models.map((m) => renderRow(id, m))}</div>}

        {id === 'ollama' && res?.ok && renderPull(res.models)}
      </section>
    );
  };

  const nothingConnected = !anyLoading && connectedIds.length === 0;
  const unconfigured = providers.filter((p) => !p.baseUrl);

  return (
    <div className="settings-section">
      <div className="aip-hero">
        <div>
          <h4 className="settings-section-title">AI Models</h4>
          <p className="settings-section-desc">
            See what each provider can run and choose a model for every feature. Changes apply when you click Apply.
          </p>
        </div>
        <button type="button" className="btn aip-btn" onClick={refreshAll} disabled={anyLoading}>
          <FiRefreshCw size={12} className={anyLoading ? 'ai-spin' : ''} /> Refresh
        </button>
      </div>

      {nothingConnected ? (
        <div className="aim-card aim-empty">
          <FiAlertCircle size={22} />
          <span className="aim-card-title">No model server is connected</span>
          <span>Start Ollama or LM Studio, or connect another OpenAI-compatible server.</span>
          {onOpenProviders && (
            <button type="button" className="btn btn-primary aip-btn" onClick={onOpenProviders}>Set up a provider</button>
          )}
        </div>
      ) : renderAssignments()}

      <div className="aim-toolbar">
        <div className="aim-search">
          <FiSearch size={13} />
          <input
            type="text"
            className="settings-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models"
            aria-label="Search models"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="aim-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <FiX size={12} />
            </button>
          )}
        </div>
        <div className="aim-chips" role="group" aria-label="Filter models">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`aim-chip${filter === f.id ? ' active' : ''}`}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
            >
              {f.label} <span className="aim-chip-count">{filterCount(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {PROVIDER_IDS.map(renderProvider)}

      {unconfigured.length > 0 && onOpenProviders && (
        <p className="ai-field-note">
          Not set up: {unconfigured.map((p) => p.label).join(', ')}.{' '}
          <button type="button" className="aip-link aip-link-inline" onClick={onOpenProviders}>Add a provider</button>
        </p>
      )}
    </div>
  );
}

AiModelsSection.propTypes = {
  localSettings: PropTypes.object.isRequired,
  updateLocal: PropTypes.func.isRequired,
  onOpenProviders: PropTypes.func,
};
