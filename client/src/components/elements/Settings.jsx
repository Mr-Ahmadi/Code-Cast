import { useContext, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { GlobalContext } from '../../contexts/GlobalStates';
import { useMode, MODES } from '../../contexts/ModeContext';
import { saveSettings as persistSettings, cloneDefaults } from '../../constants/settings';
import { getAvailableFormatters } from '../../services/formatter';
import { FiX, FiEdit3, FiCode, FiTerminal, FiSave, FiGitCommit, FiCpu, FiMessageSquare, FiZap, FiServer } from 'react-icons/fi';
import ServerSettings from './ServerSettings';
import axios from 'axios';

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    className={"settings-switch" + (checked ? " on" : "") + (disabled ? " disabled" : "")}
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
  >
    <span className="settings-switch-knob" />
  </button>
);

Toggle.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

function ModelSelect({ value, onChange, disabled }) {
  const models = [
    'qwen2.5-coder:1.5b', 'qwen2.5-coder:3b', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b',
    'codellama:7b', 'codellama:13b', 'codellama:34b',
    'stable-code:3b', 'deepseek-coder:6.7b', 'starcoder2:3b', 'starcoder2:7b', 'codegemma:7b',
  ];
  return (
    <select className="settings-select" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
      {models.map(m => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
}

ModelSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

export default function Settings() {
  const { settings, setSettings, settingsOpen, setSettingsOpen, setTheme, setFontSize, setShowMinimap, setAutoSave } = useContext(GlobalContext);
  const { mode } = useMode();
  const [activeSection, setActiveSection] = useState('editor');
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (mode === MODES.ONLINE) {
      axios.get('index/settings', { withCredentials: true })
        .then(res => {
          if (res.data?.settings) {
            setSettings(prev => {
              const merged = { ...prev, ...res.data.settings };
              setLocalSettings(merged);
              return merged;
            });
          }
        })
        .catch(() => {});
    }
  }, [mode, setSettings]);

  const updateLocal = useCallback((section, key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...(typeof key === 'object' ? key : { [key]: value }),
      },
    }));
    setDirty(true);
  }, []);

  const updateFormatterLanguage = useCallback((lang, formatterId) => {
    setLocalSettings(prev => ({
      ...prev,
      formatter: {
        ...prev.formatter,
        defaultFormatters: {
          ...prev.formatter.defaultFormatters,
          [lang]: formatterId,
        },
      },
    }));
    setDirty(true);
  }, []);

  const handleApply = useCallback(async () => {
    setSaving(true);
    setSettings(localSettings);

    if (mode === MODES.LOCAL) {
      persistSettings(localSettings);
    } else {
      try {
        await axios.post('index/settings', localSettings, { withCredentials: true });
      } catch (err) {
        console.warn('Failed to save settings to server:', err);
      }
    }

    setFontSize(localSettings.editor.fontSize);
    setShowMinimap(localSettings.editor.showMinimap);
    setAutoSave(localSettings.editor.autoSave);
    setTheme(localSettings.editor.theme);

    setDirty(false);
    setSaving(false);
  }, [localSettings, mode, setSettings, setFontSize, setShowMinimap, setAutoSave, setTheme]);

  const handleReset = useCallback(() => {
    // cloneDefaults deep-copies every section, so newly added ones reset too
    // instead of being missed by a hand-maintained list.
    setLocalSettings(cloneDefaults());
    setDirty(true);
  }, []);

  if (!settingsOpen) return null;

  const formatters = getAvailableFormatters();

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (dirty) {
        if (!window.confirm('Discard unsaved settings?')) return;
      }
      setSettingsOpen(false);
    }
  };

  const sections = [
    { id: 'editor', label: 'Editor', icon: FiEdit3, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">Editor</h4>

        <label className="settings-field">
          <span className="settings-field-label">Theme</span>
          <select
            className="settings-select"
            value={localSettings.editor.theme}
            onChange={e => updateLocal('editor', 'theme', e.target.value)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Font Size</span>
          <div className="settings-field-row">
            <input
              type="range"
              min="10"
              max="28"
              step="1"
              value={localSettings.editor.fontSize}
              onChange={e => updateLocal('editor', 'fontSize', Number(e.target.value))}
              className="settings-range"
            />
            <span className="settings-range-value">{localSettings.editor.fontSize}px</span>
          </div>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Tab Size</span>
          <select
            className="settings-select"
            value={localSettings.editor.tabSize}
            onChange={e => updateLocal('editor', 'tabSize', Number(e.target.value))}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Font Family</span>
          <select
            className="settings-select"
            value={localSettings.editor.fontFamily}
            onChange={e => updateLocal('editor', 'fontFamily', e.target.value)}
          >
            <option value="default">Default</option>
            <option value="cascadia">Cascadia Code</option>
            <option value="fira">Fira Code</option>
            <option value="jetbrains">JetBrains Mono</option>
            <option value="menlo">Menlo</option>
            <option value="monaco">Monaco</option>
            <option value="consolas">Consolas</option>
            <option value="courier">Courier New</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Line Numbers</span>
          <select
            className="settings-select"
            value={localSettings.editor.lineNumbers}
            onChange={e => updateLocal('editor', 'lineNumbers', e.target.value)}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
            <option value="relative">Relative</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Word Wrap</span>
          <select
            className="settings-select"
            value={localSettings.editor.wordWrap}
            onChange={e => updateLocal('editor', 'wordWrap', e.target.value)}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
            <option value="wordWrapColumn">Word Wrap Column</option>
            <option value="bounded">Bounded</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Word Wrap Column</span>
          <div className="settings-field-row">
            <input
              type="range"
              min="40"
              max="200"
              step="10"
              value={localSettings.editor.wordWrapColumn ?? 80}
              onChange={e => updateLocal('editor', 'wordWrapColumn', Number(e.target.value))}
              className="settings-range"
            />
            <span className="settings-range-value">{localSettings.editor.wordWrapColumn ?? 80}</span>
          </div>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Render Whitespace</span>
          <select
            className="settings-select"
            value={localSettings.editor.renderWhitespace}
            onChange={e => updateLocal('editor', 'renderWhitespace', e.target.value)}
          >
            <option value="none">None</option>
            <option value="selection">Selection</option>
            <option value="boundary">Boundary</option>
            <option value="trailing">Trailing</option>
            <option value="all">All</option>
          </select>
        </label>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.editor.showMinimap}
            onChange={v => updateLocal('editor', 'showMinimap', v)}
          />
          <span className="settings-field-label">Show Minimap</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.editor.autoSave}
            onChange={v => updateLocal('editor', 'autoSave', v)}
          />
          <span className="settings-field-label">Auto Save</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Cursor Style</span>
          <select
            className="settings-select"
            value={localSettings.editor.cursorStyle}
            onChange={e => updateLocal('editor', 'cursorStyle', e.target.value)}
          >
            <option value="line">Line</option>
            <option value="block">Block</option>
            <option value="underline">Underline</option>
            <option value="line-thin">Line Thin</option>
            <option value="block-outline">Block Outline</option>
            <option value="underline-thin">Underline Thin</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Cursor Blinking</span>
          <select
            className="settings-select"
            value={localSettings.editor.cursorBlinking}
            onChange={e => updateLocal('editor', 'cursorBlinking', e.target.value)}
          >
            <option value="blink">Blink</option>
            <option value="smooth">Smooth</option>
            <option value="phase">Phase</option>
            <option value="expand">Expand</option>
            <option value="solid">Solid</option>
          </select>
        </label>

        <div className="settings-subsection">
          <h5 className="settings-subsection-title">Enhancements</h5>

          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={localSettings.editor.bracketPairColorization !== false}
              onChange={v => updateLocal('editor', 'bracketPairColorization', v)}
            />
            <span className="settings-field-label">Bracket Pair Colorization</span>
          </label>

          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={localSettings.editor.stickyScroll !== false}
              onChange={v => updateLocal('editor', 'stickyScroll', v)}
            />
            <span className="settings-field-label">Sticky Scroll</span>
          </label>

          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={localSettings.editor.smoothScrolling !== false}
              onChange={v => updateLocal('editor', 'smoothScrolling', v)}
            />
            <span className="settings-field-label">Smooth Scrolling</span>
          </label>

          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={localSettings.editor.mouseWheelZoom !== false}
              onChange={v => updateLocal('editor', 'mouseWheelZoom', v)}
            />
            <span className="settings-field-label">Mouse Wheel Zoom</span>
          </label>

          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={!!localSettings.editor.linkedEditing}
              onChange={v => updateLocal('editor', 'linkedEditing', v)}
            />
            <span className="settings-field-label">Linked Editing</span>
          </label>

          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={!!localSettings.editor.formatOnPaste}
              onChange={v => updateLocal('editor', 'formatOnPaste', v)}
            />
            <span className="settings-field-label">Format On Paste</span>
          </label>

          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={!!localSettings.editor.formatOnType}
              onChange={v => updateLocal('editor', 'formatOnType', v)}
            />
            <span className="settings-field-label">Format On Type</span>
          </label>

          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={localSettings.editor.indentGuides !== false}
              onChange={v => updateLocal('editor', 'indentGuides', v)}
            />
            <span className="settings-field-label">Indent Guides</span>
          </label>
        </div>
      </div>
    )},
    { id: 'formatter', label: 'Formatter', icon: FiCode, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">Formatter</h4>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.formatter.formatOnSave}
            onChange={v => updateLocal('formatter', 'formatOnSave', v)}
          />
          <span className="settings-field-label">Format On Save</span>
        </label>

        <div className="settings-subsection">
          <h5 className="settings-subsection-title">Default Formatters</h5>
          <p className="settings-subsection-desc">
            Choose which formatter to use for each language.
          </p>
          {formatters.map(f => (
            <div key={f.id} className="settings-formatter-group">
              <span className="settings-formatter-name">{f.name}</span>
              <div className="settings-formatter-langs">
                {f.languages.map(lang => (
                  <label key={lang} className="settings-formatter-lang">
                    <span>{lang}</span>
                    <select
                      className="settings-select settings-select-sm"
                      value={localSettings.formatter.defaultFormatters[lang] || ''}
                      onChange={e => updateFormatterLanguage(lang, e.target.value)}
                    >
                      <option value="">None</option>
                      {formatters.filter(f2 => f2.languages.includes(lang)).map(f2 => (
                        <option key={f2.id} value={f2.id}>{f2.name}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )},
    { id: 'lsp', label: 'Language Server', icon: FiTerminal, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">Language Server</h4>
        <p className="settings-section-desc">
          Monaco Editor provides built-in language features for JavaScript and TypeScript.
        </p>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.lsp.enabled}
            onChange={v => updateLocal('lsp', 'enabled', v)}
          />
          <span className="settings-field-label">Enable LSP Features</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.lsp.diagnostics}
            onChange={v => updateLocal('lsp', 'diagnostics', v)}
            disabled={!localSettings.lsp.enabled}
          />
          <span className="settings-field-label">Diagnostics (errors & warnings)</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.lsp.autocomplete}
            onChange={v => updateLocal('lsp', 'autocomplete', v)}
            disabled={!localSettings.lsp.enabled}
          />
          <span className="settings-field-label">Autocomplete (IntelliSense)</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.lsp.refactoring}
            onChange={v => updateLocal('lsp', 'refactoring', v)}
            disabled={!localSettings.lsp.enabled}
          />
          <span className="settings-field-label">Refactoring (rename, extract)</span>
        </label>
      </div>
    )},
    { id: 'commit', label: 'Commit', icon: FiGitCommit, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">Commit Messages</h4>
        <p className="settings-section-desc">
          Generate commit messages from staged changes using a local Ollama model (e.g. Qwen2.5-Coder).
        </p>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.commitMessage.enabled}
            onChange={v => updateLocal('commitMessage', 'enabled', v)}
          />
          <span className="settings-field-label">Enable AI Commit Messages</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Ollama URL</span>
          <input
            type="text"
            className="settings-input"
            value={localSettings.commitMessage.ollamaUrl}
            onChange={e => updateLocal('commitMessage', 'ollamaUrl', e.target.value)}
            disabled={!localSettings.commitMessage.enabled}
            placeholder="http://localhost:11434"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <ModelSelect
            value={localSettings.commitMessage.model}
            onChange={v => updateLocal('commitMessage', 'model', v)}
            disabled={!localSettings.commitMessage.enabled}
          />
        </label>
      </div>
    )},
    { id: 'aiAutocomplete', label: 'AI Autocomplete', icon: FiCpu, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">AI Autocomplete</h4>
        <p className="settings-section-desc">
          Use local Ollama models for AI-powered inline code completion (e.g. Qwen2.5-Coder).
        </p>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.aiAutocomplete.enabled}
            onChange={v => updateLocal('aiAutocomplete', 'enabled', v)}
          />
          <span className="settings-field-label">Enable AI Autocomplete</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Ollama URL</span>
          <input
            type="text"
            className="settings-input"
            value={localSettings.aiAutocomplete.ollamaUrl}
            onChange={e => updateLocal('aiAutocomplete', 'ollamaUrl', e.target.value)}
            disabled={!localSettings.aiAutocomplete.enabled}
            placeholder="http://localhost:11434"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <ModelSelect
            value={localSettings.aiAutocomplete.model}
            onChange={v => updateLocal('aiAutocomplete', 'model', v)}
            disabled={!localSettings.aiAutocomplete.enabled}
          />
        </label>

        <div className="settings-subsection">
          <h5 className="settings-subsection-title">Behavior</h5>
          <label className="settings-field">
            <span className="settings-field-label">Trigger</span>
            <select
              className="settings-input"
              value={localSettings.aiAutocomplete.triggerMode || 'auto'}
              onChange={e => updateLocal('aiAutocomplete', 'triggerMode', e.target.value)}
              disabled={!localSettings.aiAutocomplete.enabled}
            >
              <option value="auto">Automatic (as you type)</option>
              <option value="manual">Manual (Ctrl/Cmd+Shift+Space)</option>
            </select>
          </label>
          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={localSettings.aiAutocomplete.multiline}
              onChange={v => updateLocal('aiAutocomplete', 'multiline', v)}
              disabled={!localSettings.aiAutocomplete.enabled}
            />
            <span className="settings-field-label">Multiline Suggestions</span>
          </label>
          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={localSettings.aiAutocomplete.useOpenFileContext}
              onChange={v => updateLocal('aiAutocomplete', 'useOpenFileContext', v)}
              disabled={!localSettings.aiAutocomplete.enabled}
            />
            <span className="settings-field-label">Use Open Files As Context</span>
          </label>
          <label className="settings-field settings-checkbox-field">
            <Toggle
              checked={localSettings.aiAutocomplete.skipInComments}
              onChange={v => updateLocal('aiAutocomplete', 'skipInComments', v)}
              disabled={!localSettings.aiAutocomplete.enabled}
            />
            <span className="settings-field-label">Skip Suggestions In Comments</span>
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Debounce (ms)</span>
            <input
              type="number"
              className="settings-input"
              min="100"
              max="3000"
              value={localSettings.aiAutocomplete.debounceMs ?? 350}
              onChange={e => updateLocal('aiAutocomplete', 'debounceMs', Number(e.target.value))}
              disabled={!localSettings.aiAutocomplete.enabled}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Max Tokens</span>
            <input
              type="number"
              className="settings-input"
              min="16"
              max="1024"
              value={localSettings.aiAutocomplete.maxTokens ?? 128}
              onChange={e => updateLocal('aiAutocomplete', 'maxTokens', Number(e.target.value))}
              disabled={!localSettings.aiAutocomplete.enabled}
            />
          </label>
        </div>
      </div>
    )},
    { id: 'aiChat', label: 'AI Chat', icon: FiMessageSquare, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">AI Chat & Code Assistant</h4>
        <p className="settings-section-desc">
          Conversational assistant that can explain, edit, and generate code with local Ollama models.
        </p>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.aiChat.enabled}
            onChange={v => updateLocal('aiChat', 'enabled', v)}
          />
          <span className="settings-field-label">Enable AI Chat</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Ollama URL</span>
          <input
            type="text"
            className="settings-input"
            value={localSettings.aiChat.ollamaUrl}
            onChange={e => updateLocal('aiChat', 'ollamaUrl', e.target.value)}
            disabled={!localSettings.aiChat.enabled}
            placeholder="http://localhost:11434"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <ModelSelect
            value={localSettings.aiChat.model}
            onChange={v => updateLocal('aiChat', 'model', v)}
            disabled={!localSettings.aiChat.enabled}
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Temperature</span>
          <div className="settings-field-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={localSettings.aiChat.temperature ?? 0.3}
              onChange={e => updateLocal('aiChat', 'temperature', Number(e.target.value))}
              className="settings-range"
              disabled={!localSettings.aiChat.enabled}
            />
            <span className="settings-range-value">{localSettings.aiChat.temperature ?? 0.3}</span>
          </div>
        </label>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.aiChat.includeActiveFile}
            onChange={v => updateLocal('aiChat', 'includeActiveFile', v)}
            disabled={!localSettings.aiChat.enabled}
          />
          <span className="settings-field-label">Include Active File As Context</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Max History (messages)</span>
          <input
            type="number"
            className="settings-input"
            min="2"
            max="40"
            value={localSettings.aiChat.maxHistory ?? 12}
            onChange={e => updateLocal('aiChat', 'maxHistory', Number(e.target.value))}
            disabled={!localSettings.aiChat.enabled}
          />
        </label>
      </div>
    )},
    { id: 'aiEdit', label: 'AI Edit', icon: FiZap, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">Inline AI Edit</h4>
        <p className="settings-section-desc">
          Rewrite the selected code from a plain-language instruction with Ctrl/Cmd+K,
          then review the diff before applying it.
        </p>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.aiEdit.enabled}
            onChange={v => updateLocal('aiEdit', 'enabled', v)}
          />
          <span className="settings-field-label">Enable Inline AI Edit</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Ollama URL</span>
          <input
            type="text"
            className="settings-input"
            value={localSettings.aiEdit.ollamaUrl}
            onChange={e => updateLocal('aiEdit', 'ollamaUrl', e.target.value)}
            disabled={!localSettings.aiEdit.enabled}
            placeholder="http://localhost:11434"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <ModelSelect
            value={localSettings.aiEdit.model}
            onChange={v => updateLocal('aiEdit', 'model', v)}
            disabled={!localSettings.aiEdit.enabled}
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Temperature</span>
          <div className="settings-field-row">
            <input
              type="range"
              className="settings-range"
              min="0"
              max="1"
              step="0.05"
              value={localSettings.aiEdit.temperature ?? 0.1}
              onChange={e => updateLocal('aiEdit', 'temperature', Number(e.target.value))}
              disabled={!localSettings.aiEdit.enabled}
            />
            <span className="settings-range-value">{localSettings.aiEdit.temperature ?? 0.1}</span>
          </div>
        </label>
      </div>
    )},
    { id: 'playbackExplanation', label: 'Explain', icon: FiCpu, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">Playback Explanation</h4>
        <p className="settings-section-desc">
          Explain code at the current playback position using local AI models.
        </p>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.playbackExplanation.enabled}
            onChange={v => updateLocal('playbackExplanation', 'enabled', v)}
          />
          <span className="settings-field-label">Enable Playback Explanation</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.playbackExplanation.autoExplain}
            onChange={v => updateLocal('playbackExplanation', 'autoExplain', v)}
            disabled={!localSettings.playbackExplanation.enabled}
          />
          <span className="settings-field-label">Auto-explain on seek</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Ollama URL</span>
          <input
            type="text"
            className="settings-input"
            value={localSettings.playbackExplanation.ollamaUrl}
            onChange={e => updateLocal('playbackExplanation', 'ollamaUrl', e.target.value)}
            disabled={!localSettings.playbackExplanation.enabled}
            placeholder="http://localhost:11434"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <ModelSelect
            value={localSettings.playbackExplanation.model}
            onChange={v => updateLocal('playbackExplanation', 'model', v)}
            disabled={!localSettings.playbackExplanation.enabled}
          />
        </label>
      </div>
    )},
    { id: 'terminalAI', label: 'Terminal AI', icon: FiTerminal, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">Terminal AI Assistant</h4>
        <p className="settings-section-desc">
          Convert natural language to shell commands and explain terminal errors using local AI.
        </p>

        <label className="settings-field settings-checkbox-field">
          <Toggle
            checked={localSettings.terminalAI.enabled}
            onChange={v => updateLocal('terminalAI', 'enabled', v)}
          />
          <span className="settings-field-label">Enable Terminal AI</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Ollama URL</span>
          <input
            type="text"
            className="settings-input"
            value={localSettings.terminalAI.ollamaUrl}
            onChange={e => updateLocal('terminalAI', 'ollamaUrl', e.target.value)}
            disabled={!localSettings.terminalAI.enabled}
            placeholder="http://localhost:11434"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <ModelSelect
            value={localSettings.terminalAI.model}
            onChange={v => updateLocal('terminalAI', 'model', v)}
            disabled={!localSettings.terminalAI.enabled}
          />
        </label>
      </div>
    )},
    { id: 'server', label: 'Server', icon: FiServer, content: (
      <div className="settings-section">
        <ServerSettings />
      </div>
    )},
  ];

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h3 className="settings-title">Settings</h3>
          <button
            className="settings-close-btn"
            onClick={() => {
              if (dirty) {
                if (!window.confirm('Discard unsaved settings?')) return;
              }
              setSettingsOpen(false);
            }}
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="settings-tabs">
          {sections.map(s => (
            <button
              key={s.id}
              className={`settings-tab${activeSection === s.id ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              <s.icon size={14} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-scroll">
          {sections.find(s => s.id === activeSection)?.content}
        </div>

        <div className="settings-footer">
          <button className="btn" onClick={handleReset} disabled={!dirty}>
            Reset to Defaults
          </button>
          <div className="settings-footer-right">
            <button className="btn" onClick={() => setSettingsOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={!dirty || saving}
            >
              <FiSave size={13} />
              {saving ? 'Saving...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
