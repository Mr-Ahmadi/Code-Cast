import { useState, useCallback, useEffect, memo } from 'react';
import PropTypes from 'prop-types';

const ExplainPanel = memo(({ code, language, settings, onExplain, explainTrigger }) => {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExplain = useCallback(async () => {
    if (!code || !code.trim() || !settings?.playbackExplanation?.enabled) return;
    setLoading(true);
    setError(null);
    setExplanation('');
    try {
      const { explainCode } = await import('../../services/explain');
      const result = await explainCode(
        code,
        language || 'plaintext',
        settings.playbackExplanation
      );
      setExplanation(result || '(no explanation generated)');
    } catch (err) {
      setError(err.message || 'Failed to get explanation');
    } finally {
      setLoading(false);
    }
  }, [code, language, settings]);

  useEffect(() => {
    if (explainTrigger > 0) handleExplain();
  }, [explainTrigger, handleExplain]);

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
        {explanation && !loading && (
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
  onExplain: PropTypes.func,
  explainTrigger: PropTypes.number,
};

export default ExplainPanel;
