import { useState, useCallback, useEffect, useRef, memo } from 'react';
import PropTypes from 'prop-types';

const ExplainPanel = memo(({ code, language, settings, explainTrigger }) => {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const handleExplain = useCallback(async () => {
    if (!code || !code.trim() || !settings?.playbackExplanation?.enabled) return;
    // A new request (e.g. auto-explain on seek) supersedes the running one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setExplanation('');
    try {
      const { explainCode } = await import('../../services/explain');
      const result = await explainCode(code, language || 'plaintext', settings, {
        signal: controller.signal,
        onProgress: (partial) => {
          if (abortRef.current !== controller) return;
          setExplanation(partial);
          if (partial) setLoading(false);
        },
      });
      if (abortRef.current === controller) setExplanation(result || '(no explanation generated)');
    } catch (err) {
      if (err?.name !== 'AbortError' && abortRef.current === controller) {
        setError(err.message || 'Failed to get explanation');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, [code, language, settings]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (explainTrigger > 0) handleExplain();
    // Only a new trigger should start a request, not every code change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explainTrigger]);

  const isEmpty = !explanation && !loading && !error;

  return (
    <div className="explain-panel">
      <div className="explain-panel-header">
        <span className="explain-panel-title">
          {language && <span className="explain-lang-badge">{language}</span>}
          Code Explanation
        </span>
        <button
          className="explain-btn"
          onClick={handleExplain}
          disabled={loading || !code || !code.trim() || !settings?.playbackExplanation?.enabled}
          title="Explain current code"
          aria-label="Explain current code"
        >
          {loading ? 'Explaining...' : 'Explain'}
        </button>
      </div>
      <div className="explain-panel-body">
        {loading && (
          <div className="explain-loading">
            <span className="explain-loading-dot" />
            <span>Analyzing code...</span>
          </div>
        )}
        {error && <div className="explain-error">{error}</div>}
        {isEmpty && !loading && (
          <div className="explain-empty">
            {code && code.trim()
              ? 'Click "Explain" for an AI explanation of this code.'
              : 'No code to explain.'}
          </div>
        )}
        {explanation && (
          <div className="explain-content">{explanation}</div>
        )}
      </div>
    </div>
  );
});

ExplainPanel.displayName = 'ExplainPanel';

ExplainPanel.propTypes = {
  code: PropTypes.string,
  language: PropTypes.string,
  settings: PropTypes.object,
  explainTrigger: PropTypes.number,
};

export default ExplainPanel;
