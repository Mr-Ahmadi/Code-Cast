import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiServer, FiCheckCircle, FiAlertCircle, FiLoader, FiRotateCcw } from 'react-icons/fi';
import {
  PRESET_ENDPOINTS,
  getServerUrl,
  getDefaultServerUrl,
  hasCustomServerUrl,
  setServerUrl,
  resetServerUrl,
  normalizeServerUrl,
  validateServerUrl,
  testServerConnection,
} from '../../services/serverConfig';

/**
 * Editor for the online-mode backend address.
 *
 * The endpoint lives outside the settings object — it decides where settings
 * are loaded from — so this applies its own changes immediately rather than
 * riding the Settings dialog's Apply button.
 */
export default function ServerSettings({ compact = false, onApplied }) {
  const [draft, setDraft] = useState(getServerUrl);
  const [status, setStatus] = useState(null); // { ok, message, detail }
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);

  // Re-arm on mount: StrictMode runs the cleanup on its simulated unmount, and
  // without restoring the flag every later result would be discarded.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const current = getServerUrl();
  const validationError = validateServerUrl(draft);
  const normalizedDraft = normalizeServerUrl(draft);
  const changed = normalizedDraft !== current;

  const runTest = useCallback(async (url) => {
    setTesting(true);
    setStatus(null);
    const result = await testServerConnection(url);
    if (!alive.current) return result;
    setTesting(false);
    setStatus(result);
    return result;
  }, []);

  const handleTest = useCallback(() => {
    if (validationError) {
      setStatus({ ok: false, message: 'Invalid endpoint', detail: validationError });
      return;
    }
    runTest(draft);
  }, [draft, runTest, validationError]);

  const handleSave = useCallback(() => {
    if (validationError) {
      setStatus({ ok: false, message: 'Invalid endpoint', detail: validationError });
      return;
    }
    const applied = setServerUrl(draft);
    setDraft(applied);
    setSaved(true);
    setTimeout(() => alive.current && setSaved(false), 2000);
    onApplied?.(applied);
    runTest(applied);
  }, [draft, onApplied, runTest, validationError]);

  const handleReset = useCallback(() => {
    const applied = resetServerUrl();
    setDraft(applied);
    setStatus(null);
    onApplied?.(applied);
  }, [onApplied]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const effective = normalizedDraft || `${window.location.origin} (same origin)`;

  return (
    <div className={'server-settings' + (compact ? ' compact' : '')}>
      {!compact && (
        <>
          <h4 className="settings-section-title">Server</h4>
          <p className="settings-section-desc">
            Where online mode reads and writes your projects and recordings.
            Leave it empty to use the origin this app is served from.
          </p>
        </>
      )}

      <label className="settings-field server-settings-field">
        <span className="settings-field-label">
          <FiServer size={13} className="server-settings-label-icon" />
          Endpoint
        </span>
        <input
          type="text"
          className={'settings-input server-settings-input' + (validationError ? ' invalid' : '')}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setStatus(null); }}
          onKeyDown={handleKeyDown}
          placeholder={getDefaultServerUrl() || 'Leave empty for same origin'}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={!!validationError}
          aria-describedby="server-settings-status"
        />
      </label>

      <div className="server-settings-presets">
        {PRESET_ENDPOINTS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={'server-preset-btn' + (normalizedDraft === preset.url ? ' active' : '')}
            onClick={() => { setDraft(preset.url); setStatus(null); }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className="server-settings-effective">
        Requests go to <code>{effective}</code>
      </p>

      <div className="server-settings-actions">
        <button
          type="button"
          className="btn btn-sm"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? <FiLoader size={13} className="spin" /> : <FiCheckCircle size={13} />}
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleSave}
          disabled={testing || (!changed && !saved)}
        >
          {saved && !changed ? 'Saved' : 'Save endpoint'}
        </button>
        {hasCustomServerUrl() && (
          <button
            type="button"
            className="btn btn-sm server-settings-reset"
            onClick={handleReset}
            title="Go back to the built-in default"
          >
            <FiRotateCcw size={13} />
            Reset
          </button>
        )}
      </div>

      <div
        id="server-settings-status"
        className="server-settings-status"
        role="status"
        aria-live="polite"
      >
        {validationError && !status && (
          <span className="server-status server-status--error">
            <FiAlertCircle size={13} />
            {validationError}
          </span>
        )}
        {status && (
          <span className={'server-status ' + (status.ok ? 'server-status--ok' : 'server-status--error')}>
            {status.ok ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />}
            <span>
              <strong>{status.message}</strong>
              {status.detail && <span className="server-status-detail">{status.detail}</span>}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

ServerSettings.propTypes = {
  compact: PropTypes.bool,
  onApplied: PropTypes.func,
};
