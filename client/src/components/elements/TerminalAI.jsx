import { useState, useCallback, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { FiCpu, FiChevronDown, FiChevronRight } from 'react-icons/fi';

const TerminalAI = memo(({ settings, onInjectCommand }) => {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleGenerate = useCallback(async () => {
    if (!query.trim() || !settings?.terminalAI?.enabled) return;
    setLoading(true);
    setError(null);
    setCommand('');
    try {
      const { generateCommand } = await import('../../services/terminalAI');
      const result = await generateCommand(query, settings.terminalAI);
      if (result) {
        setCommand(result);
      } else {
        setError('No command generated');
      }
    } catch (err) {
      setError(err.message || 'Failed to generate command');
    } finally {
      setLoading(false);
    }
  }, [query, settings]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate]);

  const handleInject = useCallback((cmd) => {
    onInjectCommand?.(cmd);
    setCommand('');
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onInjectCommand]);

  const handleToggle = useCallback(() => {
    setExpanded(v => {
      if (!v) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return !v;
    });
  }, []);

  if (!settings?.terminalAI?.enabled) return null;

  return (
    <div className="terminal-ai-bar" onClick={e => e.stopPropagation()}>
      <button
        className="terminal-ai-toggle"
        onClick={handleToggle}
        title="AI Command Assistant"
        aria-label="Toggle AI Command Assistant"
        aria-expanded={expanded}
      >
        <FiCpu size={13} />
        {expanded ? <FiChevronDown size={10} /> : <FiChevronRight size={10} />}
      </button>
      {expanded && (
        <div className="terminal-ai-body">
          <div className="terminal-ai-input-row">
            <input
              ref={inputRef}
              className="terminal-ai-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to do? (e.g. find large files)"
              disabled={loading}
            />
            <button
              className="terminal-ai-send-btn"
              onClick={handleGenerate}
              disabled={loading || !query.trim()}
            >
              {loading ? '...' : 'Ask'}
            </button>
          </div>
          {error && <div className="terminal-ai-error">{error}</div>}
          {command && (
            <div className="terminal-ai-result">
              <code className="terminal-ai-command">{command}</code>
              <button
                className="terminal-ai-run-btn"
                onClick={() => handleInject(command)}
                title="Run in terminal"
              >
                Run
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

TerminalAI.displayName = 'TerminalAI';

TerminalAI.propTypes = {
  settings: PropTypes.object,
  onInjectCommand: PropTypes.func,
};

export default TerminalAI;
