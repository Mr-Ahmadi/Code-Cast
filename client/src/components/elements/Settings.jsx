import { useContext, useState, useCallback, useEffect } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import { useMode, MODES } from '../../contexts/ModeContext';
import { saveSettings as persistSettings, DEFAULT_SETTINGS } from '../../constants/settings';
import { getAvailableFormatters } from '../../services/formatter';
import { FiX, FiEdit3, FiCode, FiTerminal, FiSave, FiGitCommit } from 'react-icons/fi';
import axios from 'axios';

export default function Settings() {
  const { settings, setSettings, settingsOpen, setSettingsOpen, theme, setTheme, fontSize, setFontSize, showMinimap, setShowMinimap, autoSave, setAutoSave } = useContext(GlobalContext);
  const { mode } = useMode();
  const [activeSection, setActiveSection] = useState('editor');
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (mode === MODES.ONLINE) {
      axios.get('/index/settings', { withCredentials: true })
        .then(res => {
          if (res.data?.settings) {
            const merged = { ...localSettings, ...res.data.settings };
            setSettings(merged);
            setLocalSettings(merged);
          }
        })
        .catch(() => {});
    }
  }, [mode]);

  useEffect(() => {
    if (window.electronAPI?.opencode?.listModels) {
      window.electronAPI.opencode.listModels().then(res => {
        if (res.models?.length) {
          setAvailableModels(res.models);
        }
      });
    }
  }, []);

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
        await axios.post('/index/settings', localSettings, { withCredentials: true });
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
    setLocalSettings({ ...DEFAULT_SETTINGS, editor: { ...DEFAULT_SETTINGS.editor }, formatter: { ...DEFAULT_SETTINGS.formatter, defaultFormatters: { ...DEFAULT_SETTINGS.formatter.defaultFormatters } }, lsp: { ...DEFAULT_SETTINGS.lsp } });
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

        <label className="settings-field settings-checkbox-field">
          <input
            type="checkbox"
            checked={localSettings.editor.showMinimap}
            onChange={e => updateLocal('editor', 'showMinimap', e.target.checked)}
          />
          <span className="settings-field-label">Show Minimap</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <input
            type="checkbox"
            checked={localSettings.editor.autoSave}
            onChange={e => updateLocal('editor', 'autoSave', e.target.checked)}
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
      </div>
    )},
    { id: 'formatter', label: 'Formatter', icon: FiCode, content: (
      <div className="settings-section">
        <h4 className="settings-section-title">Formatter</h4>

        <label className="settings-field settings-checkbox-field">
          <input
            type="checkbox"
            checked={localSettings.formatter.formatOnSave}
            onChange={e => updateLocal('formatter', 'formatOnSave', e.target.checked)}
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
          <input
            type="checkbox"
            checked={localSettings.lsp.enabled}
            onChange={e => updateLocal('lsp', 'enabled', e.target.checked)}
          />
          <span className="settings-field-label">Enable LSP Features</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <input
            type="checkbox"
            checked={localSettings.lsp.diagnostics}
            onChange={e => updateLocal('lsp', 'diagnostics', e.target.checked)}
            disabled={!localSettings.lsp.enabled}
          />
          <span className="settings-field-label">Diagnostics (errors & warnings)</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <input
            type="checkbox"
            checked={localSettings.lsp.autocomplete}
            onChange={e => updateLocal('lsp', 'autocomplete', e.target.checked)}
            disabled={!localSettings.lsp.enabled}
          />
          <span className="settings-field-label">Autocomplete (IntelliSense)</span>
        </label>

        <label className="settings-field settings-checkbox-field">
          <input
            type="checkbox"
            checked={localSettings.lsp.refactoring}
            onChange={e => updateLocal('lsp', 'refactoring', e.target.checked)}
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
          Generate commit messages from staged changes using opencode AI.
        </p>

        <label className="settings-field settings-checkbox-field">
          <input
            type="checkbox"
            checked={localSettings.commitMessage.enabled}
            onChange={e => updateLocal('commitMessage', 'enabled', e.target.checked)}
          />
          <span className="settings-field-label">Enable AI Commit Messages</span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <select
            className="settings-select"
            value={localSettings.commitMessage.model}
            onChange={e => updateLocal('commitMessage', 'model', e.target.value)}
            disabled={!localSettings.commitMessage.enabled}
          >
            {availableModels.length === 0 && (
              <option value="opencode/claude-sonnet-4">opencode/claude-sonnet-4</option>
            )}
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
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
