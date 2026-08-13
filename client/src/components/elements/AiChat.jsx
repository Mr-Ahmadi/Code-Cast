import { useState, useCallback, useRef, useEffect, memo, useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import { ollamaChatStream, ollamaListModels } from '../../services/ollama';
import {
  FiSend, FiTrash2, FiSquare, FiCopy, FiCornerDownLeft, FiCpu, FiCheck,
} from 'react-icons/fi';

const QUICK_ACTIONS = [
  { id: 'explain', label: 'Explain', icon: FiCpu },
  { id: 'improve', label: 'Improve', icon: FiCpu },
  { id: 'bugs', label: 'Find Bugs', icon: FiCpu },
  { id: 'comments', label: 'Add Comments', icon: FiCpu },
  { id: 'tests', label: 'Write Tests', icon: FiCpu },
  { id: 'refactor', label: 'Refactor', icon: FiCpu },
];

function extractCodeBlocks(text) {
  const blocks = [];
  const re = /```([\w-]*)\n?([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text))) {
    blocks.push({ language: m[1] || '', code: m[2].replace(/\n$/, '') });
  }
  if (!blocks.length && /\n/.test(text)) {
    blocks.push({ language: '', code: text.trim() });
  }
  return blocks;
}

function buildQuickPrompt(kind, code, language) {
  const prompts = {
    explain: `Explain the following ${language} code clearly. Describe what it does, its structure, and any notable patterns:\n\n${code}`,
    improve: `Improve the following ${language} code focusing on readability, performance, and best practices. Return the improved version inside a fenced code block:\n\n${code}`,
    bugs: `Carefully review the following ${language} code for bugs and issues. Point out each problem and show the corrected code in a fenced code block:\n\n${code}`,
    comments: `Add clear, concise comments to the following ${language} code. Return the fully annotated code in a fenced code block:\n\n${code}`,
    tests: `Write unit tests for the following ${language} code. Return the tests inside a fenced code block:\n\n${code}`,
    refactor: `Refactor the following ${language} code to be cleaner and more maintainable. Keep behavior identical. Return the refactored version in a fenced code block:\n\n${code}`,
  };
  return prompts[kind] || prompts.explain;
}

const AiChat = memo(() => {
  const { activeFile, settings } = useContext(GlobalContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const messagesRef = useRef(messages);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  messagesRef.current = messages;

  const conf = settings?.aiChat;
  const chatEnabled = conf?.enabled;

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!conf?.ollamaUrl) return;
      const result = await ollamaListModels(conf.ollamaUrl);
      if (!mounted) return;
      if (result.length) {
        setStatus({ ok: true, text: `Ollama · ${result.length} model${result.length === 1 ? '' : 's'}` });
      } else {
        setStatus({ ok: true, text: 'Ollama connected · no models' });
      }
    };
    setStatus(null);
    check();
    return () => { mounted = false; };
  }, [conf?.ollamaUrl]);

  const getEditorContext = useCallback(() => {
    const editor = window.__getEditor?.();
    const model = editor?.getModel?.();
    let code = model?.getValue?.() || '';
    let language = model?.getLanguageId?.() || 'plaintext';
    const sel = editor?.getSelection?.();
    const hasSelection = !!sel && !sel.isEmpty();
    if (hasSelection) code = model.getValueInRange(sel);
    return { code, language, hasSelection };
  }, []);

  const send = useCallback(async (rawPrompt) => {
    if (!chatEnabled) {
      setError('AI chat is disabled. Enable it in Settings.');
      return;
    }
    const userText = rawPrompt?.trim();
    if (!userText || streaming) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: userText };
    const nextMessages = [...messagesRef.current, userMsg];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const { code, language } = getEditorContext();
    const systemParts = [
      'You are CodeCast AI, a knowledgeable coding assistant inside a code editor.',
      'Be concise and precise. Wrap any code you provide in fenced code blocks with a language tag.',
    ];
    if (conf?.includeActiveFile && activeFile && code && code.trim()) {
      systemParts.push(`Current file (${activeFile}, ${language}):\n\`\`\`\n${code.slice(0, 8000)}\n\`\`\``);
    }

    const history = nextMessages
      .slice(-(conf?.maxHistory || 12))
      .map(({ role, content }) => ({ role, content }));

    try {
      const full = await ollamaChatStream({
        model: conf?.model,
        messages: [{ role: 'system', content: systemParts.join('\n\n') }, ...history],
        ollamaUrl: conf?.ollamaUrl,
        temperature: conf?.temperature ?? 0.3,
        signal: controller.signal,
        onToken: (_delta, acc) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = { ...last, content: acc };
            } else {
              copy.push({ id: `a-${Date.now()}`, role: 'assistant', content: acc });
            }
            return copy;
          });
        },
      });
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') {
          copy[copy.length - 1] = { ...last, content: full };
        } else {
          copy.push({ id: `a-${Date.now()}`, role: 'assistant', content: full });
        }
        return copy;
      });
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Failed to reach the AI model.');
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [chatEnabled, streaming, conf, activeFile, getEditorContext]);

  const handleSend = useCallback((e) => {
    e.preventDefault();
    send(input);
  }, [send, input]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }, [send, input]);

  const handleQuickAction = useCallback((kind) => {
    const { code, language } = getEditorContext();
    if (!code || !code.trim()) return;
    send(buildQuickPrompt(kind, code, language));
  }, [send, getEditorContext]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const insertAtCursor = useCallback((code) => {
    const editor = window.__getEditor?.();
    const model = editor?.getModel?.();
    if (!editor || !model) return false;
    const pos = editor.getPosition();
    if (!pos) return false;
    editor.executeEdits('ai-chat-insert', [{
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text: `${code}\n`,
    }]);
    editor.focus();
    return true;
  }, []);

  const replaceSelection = useCallback((code) => {
    const editor = window.__getEditor?.();
    const model = editor?.getModel?.();
    if (!editor || !model) return false;
    const sel = editor.getSelection();
    if (!sel || sel.isEmpty()) return false;
    editor.executeEdits('ai-chat-replace', [{ range: sel, text: code }]);
    editor.focus();
    return true;
  }, []);

  const handleCopy = useCallback(async (id, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* clipboard unavailable */ }
  }, []);

  useEffect(() => {
    window.__aiChatSend = (opts = {}) => {
      const editor = window.__getEditor?.();
      const model = editor?.getModel?.();
      const sel = editor?.getSelection?.();
      const useSelection = opts.useSelection && sel && !sel.isEmpty();
      const code = useSelection && model ? model.getValueInRange(sel) : (model?.getValue?.() || '');
      const language = model?.getLanguageId?.() || 'plaintext';
      const label = opts.label || 'ask';
      const prompt = opts.prompt
        || buildQuickPrompt(label, code || 'No code available.', language);
      setTimeout(() => inputRef.current?.focus(), 60);
      send(prompt);
    };
    return () => { window.__aiChatSend = undefined; };
  }, [send]);

  const assistantMessage = (msg) => {
    const blocks = extractCodeBlocks(msg.content);
    const blocksText = blocks.map(b => b.code).join('\n\n');
    return (
      <div className="ai-chat-msg ai-chat-assistant" key={msg.id}>
        <div className="ai-chat-msg-body">
          <div className="ai-chat-msg-text">{msg.content}</div>
          {blocks.length > 0 && (
            <div className="ai-chat-msg-actions">
              <button
                className="ai-chat-action-btn"
                onClick={() => insertAtCursor(blocksText)}
                title="Insert code at cursor"
              >
                <FiCornerDownLeft size={11} /> Insert at Cursor
              </button>
              <button
                className="ai-chat-action-btn"
                onClick={() => {
                  if (!replaceSelection(blocksText)) {
                    insertAtCursor(blocksText);
                  }
                }}
                title="Replace the current selection (or insert at cursor)"
              >
                <FiCornerDownLeft size={11} /> Apply to Selection
              </button>
              <button
                className="ai-chat-action-btn"
                onClick={() => handleCopy(msg.id, blocksText)}
                title="Copy code"
              >
                {copiedId === msg.id ? <FiCheck size={11} /> : <FiCopy size={11} />} Copy
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat-statusbar">
        <span className="ai-chat-title">
          <FiCpu size={12} />
          AI Chat
          {conf?.model && <span className="ai-chat-model">{conf.model}</span>}
        </span>
        <span className="ai-chat-status">
          {status ? (
            <span className={status.ok ? 'ai-chat-ok' : ''}>{status.text}</span>
          ) : (
            'checking Ollama…'
          )}
        </span>
        <button className="ai-chat-clear" onClick={handleNewChat} title="New chat">
          <FiTrash2 size={12} /> New Chat
        </button>
      </div>

      <div className="ai-chat-list" ref={listRef}>
        {messages.length === 0 && !streaming && (
          <div className="ai-chat-empty">
            <FiCpu size={28} />
            <p>Ask about code, or use a quick action on the selected code.</p>
            <div className="ai-chat-quick-actions">
              {QUICK_ACTIONS.map(a => (
                <button
                  key={a.id}
                  className="ai-chat-chip"
                  onClick={() => handleQuickAction(a.id)}
                  disabled={!chatEnabled}
                >
                  <a.icon size={11} /> {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => (
          msg.role === 'user'
            ? (
              <div className="ai-chat-msg ai-chat-user" key={msg.id}>
                <div className="ai-chat-msg-body">
                  <div className="ai-chat-msg-text">{msg.content}</div>
                </div>
              </div>
            )
            : assistantMessage(msg)
        ))}
        {streaming && (
          <div className="ai-chat-msg ai-chat-assistant">
            <div className="ai-chat-streaming-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        {error && <div className="ai-chat-error">{error}</div>}
      </div>

      <form className="ai-chat-input-row" onSubmit={handleSend}>
        <textarea
          ref={inputRef}
          className="ai-chat-input"
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your code… (Enter to send, Shift+Enter for newline)"
          disabled={!chatEnabled}
        />
        {streaming ? (
          <button type="button" className="ai-chat-stop" onClick={handleStop} title="Stop generating">
            <FiSquare size={11} /> Stop
          </button>
        ) : (
          <button type="submit" className="ai-chat-send" disabled={!chatEnabled || !input.trim()} title="Send">
            <FiSend size={12} />
          </button>
        )}
      </form>
    </div>
  );
});

AiChat.displayName = 'AiChat';

export default AiChat;
