import { useState, useEffect, useCallback, useContext } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import { useMode, MODES } from "../../contexts/ModeContext";
import { FiGitBranch, FiRefreshCw, FiPlus, FiMinus, FiChevronRight, FiChevronDown, FiGithub, FiRotateCcw, FiArrowUp, FiZap, FiAlertCircle } from "react-icons/fi";
import { ollamaChat } from "../../services/ollama";

function parsePorcelain(output) {
  const staged = [];
  const unstaged = [];
  const untracked = [];

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const xy = line.slice(0, 2);
    const file = line.slice(3);

    if (xy === "??") {
      untracked.push({ path: file, status: "U" });
      continue;
    }

    const stagedStatus = xy[0];
    const worktreeStatus = xy[1];

    if (stagedStatus !== " " && stagedStatus !== "?" && stagedStatus !== "!") {
      const label = { M: "M", A: "A", D: "D", R: "R" }[stagedStatus] || stagedStatus;
      staged.push({ path: file, status: label });
    }

    if (worktreeStatus !== " " && worktreeStatus !== "?" && worktreeStatus !== "!") {
      const label = { M: "M", D: "D", "?": "U" }[worktreeStatus] || worktreeStatus;
      unstaged.push({ path: file, status: label });
    }
  }

  return { staged, unstaged, untracked };
}

export default function GitPanel() {
  const { currentWorkspace, settings, setToast } = useContext(GlobalContext);
  const { mode } = useMode();
  const isLocal = mode === MODES.LOCAL;
  const repoPath = currentWorkspace?.path;

  const [hasRepo, setHasRepo] = useState(false);
  const [checkingRepo, setCheckingRepo] = useState(true);
  const [hasRemote, setHasRemote] = useState(false);
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState({ staged: [], unstaged: [], untracked: [] });
  const [commits, setCommits] = useState([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [postInitPrompt, setPostInitPrompt] = useState(false);
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [repoVisibility, setRepoVisibility] = useState("public");
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [expandedSections, setExpandedSections] = useState({ staged: true, unstaged: true, untracked: true, commits: false });

  const gitExec = useCallback(async (args) => {
    if (!isLocal || !window.electronAPI?.git?.exec || !repoPath) return { stdout: "", stderr: "", code: 1 };
    return window.electronAPI.git.exec(repoPath, args);
  }, [isLocal, repoPath]);

  const shellExec = useCallback(async (command) => {
    if (!window.electronAPI?.shell?.exec) return { stdout: "", stderr: "", code: 1 };
    return window.electronAPI.shell.exec(repoPath || ".", command);
  }, [repoPath]);

  const handleGenerateMsg = useCallback(async () => {
    if (!repoPath) return;
    const diffRes = await gitExec(["diff", "--cached"]);
    if (diffRes.code !== 0 || !diffRes.stdout.trim()) {
      setToast({ message: "No staged changes found.", type: "ERROR" });
      return;
    }
    const { model, ollamaUrl } = settings?.commitMessage || {};
    if (!model || !ollamaUrl) {
      setToast({ message: "Ollama model or URL not configured in settings.", type: "ERROR" });
      return;
    }
    setGenerating(true);
    try {
      const diff = diffRes.stdout;
      const files = diff.match(/^\+\+\+ b\/(.+)$/gm)?.map(l => l.slice(6)) || [];
      const lines = diff.split('\n');
      const added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
      const removed = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
      const summary = files.length ? `Files: ${files.join(', ')}\n+${added} -${removed}` : diff.slice(0, 500);
      const msg = await ollamaChat({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a git commit message generator. Reply with ONLY the commit message, one line, max 72 chars.',
          },
          { role: 'user', content: summary },
        ],
        ollamaUrl,
      });
      const lines2 = msg.trim().split('\n');
      let clean = '';
      for (const l of lines2) {
        const t = l.trim();
        if (!t || t.startsWith('`') || t.startsWith('*') || t.startsWith('-') || t.startsWith('#')) continue;
        if (t.length > 150 || /^(the|this|i think|here|sure|okay)/i.test(t)) continue;
        clean = t;
        break;
      }
      if (clean) {
        setCommitMsg(clean);
      } else {
        setToast({ message: "Model returned empty response.", type: "ERROR" });
      }
    } catch (err) {
      setToast({ message: `Commit message generation failed: ${err.message}`, type: "ERROR" });
    }
    setGenerating(false);
  }, [repoPath, settings, gitExec, setToast]);

  const clearState = useCallback(() => {
    setHasRepo(false);
    setBranch("");
    setStatus({ staged: [], unstaged: [], untracked: [] });
    setCommits([]);
    setCommitMsg("");
  }, []);

  const refresh = useCallback(async () => {
    if (!repoPath || !isLocal) { clearState(); setCheckingRepo(false); return; }
    setLoading(true);

    const checkRes = await gitExec(["rev-parse", "--git-dir"]);
    if (checkRes.code !== 0) {
      clearState();
      setLoading(false);
      setCheckingRepo(false);
      return;
    }

    setHasRepo(true);

    const [branchRes, statusRes, logRes, remoteRes] = await Promise.all([
      gitExec(["branch", "--show-current"]),
      gitExec(["status", "--porcelain"]),
      gitExec(["log", "--oneline", "-15", "--no-decorate"]),
      gitExec(["remote", "get-url", "origin"]),
    ]);
    setHasRemote(remoteRes.code === 0);

    if (branchRes.code === 0) setBranch(branchRes.stdout.trim());
    else setBranch("");

    if (statusRes.code === 0) setStatus(parsePorcelain(statusRes.stdout));
    else setStatus({ staged: [], unstaged: [], untracked: [] });

    if (logRes.code === 0) {
      const logLines = logRes.stdout.split("\n").filter(Boolean);
      setCommits(logLines.map(line => {
        const spaceIdx = line.indexOf(" ");
        return { hash: line.slice(0, spaceIdx), message: line.slice(spaceIdx + 1) };
      }));
    } else {
      setCommits([]);
    }

    setLoading(false);
    setCheckingRepo(false);
  }, [repoPath, isLocal, gitExec, clearState]);

  useEffect(() => {
    setCheckingRepo(true);
    refresh();
  }, [repoPath, isLocal, refresh]);

  const handleStage = async (file) => {
    await gitExec(["add", file]);
    refresh();
  };

  const handleStageAll = async () => {
    await gitExec(["add", "-A"]);
    refresh();
  };

  const handleUnstage = async (file) => {
    await gitExec(["restore", "--staged", file]);
    refresh();
  };

  const handleUnstageAll = async () => {
    await gitExec(["restore", "--staged", "."]);
    refresh();
  };

  const handleRevert = async (file, isUntracked = false) => {
    if (isUntracked) {
      if (window.electronAPI?.file?.remove && repoPath) {
        const pathUtil = window.electronAPI.path;
        const absPath = pathUtil.join(repoPath, file);
        await window.electronAPI.file.remove(absPath);
      }
    } else {
      await gitExec(["restore", file]);
    }
    refresh();
  };

  const handleRevertAll = async () => {
    await gitExec(["restore", "."]);
    // Also clean untracked files
    await gitExec(["clean", "-fd"]);
    refresh();
  };

  const handlePush = async () => {
    if (!branch) return;
    setPushing(true);
    await gitExec(["push", "origin", branch]);
    setPushing(false);
    refresh();
  };

  const handleCommit = async (andPush = false) => {
    const msg = commitMsg.trim();
    if (!msg) return;
    setCommitting(true);
    const res = await gitExec(["commit", "-m", msg]);
    if (res.code === 0 && andPush) {
      setPushing(true);
      await gitExec(["push", "origin", branch]);
      setPushing(false);
    }
    setCommitMsg("");
    setCommitting(false);
    refresh();
  };

  const handleInitRepo = async () => {
    setInitializing(true);
    const res = await gitExec(["init"]);
    if (res.code === 0) {
      setPostInitPrompt(true);
      refresh();
    }
    setInitializing(false);
  };

  const handlePostInitYes = () => {
    const defaultName = currentWorkspace?.name || repoPath?.split("/").pop() || "my-project";
    setRepoName(defaultName);
    setPublishError("");
    setPostInitPrompt(false);
    setShowPublishForm(true);
  };

  const handlePostInitNo = () => {
    setPostInitPrompt(false);
  };

  const handleOpenPublish = () => {
    const defaultName = currentWorkspace?.name || repoPath?.split("/").pop() || "my-project";
    setRepoName(defaultName);
    setPublishError("");
    setShowPublishForm(true);
  };

  const handlePublishToGitHub = async () => {
    const name = repoName.trim();
    if (!name) { setPublishError("Repository name is required"); return; }

    const ghCheck = await shellExec("gh auth status");
    if (ghCheck.code !== 0) {
      setPublishError("GitHub CLI (gh) is not installed or not authenticated. Install it from https://cli.github.com");
      return;
    }

    setPublishing(true);
    setPublishError("");

    if (commits.length === 0) {
      await gitExec(["add", "-A"]);
      const commitRes = await gitExec(["commit", "-m", "Initial commit"]);
      if (commitRes.code !== 0) {
        setPublishError("Failed to create initial commit: " + (commitRes.stderr || "unknown error"));
        setPublishing(false);
        return;
      }
    }

    const visibility = repoVisibility === "private" ? "--private" : "--public";
    const res = await shellExec(`gh repo create "${name}" ${visibility} --source="${repoPath}" --push`);
    if (res.code === 0) {
      setShowPublishForm(false);
      refresh();
    } else {
      setPublishError(res.stderr || "Failed to publish to GitHub");
    }
    setPublishing(false);
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const stagedCount = status.staged.length;
  const unstagedCount = status.unstaged.length + status.untracked.length;

  if (!isLocal || !repoPath) {
    return (
      <div className="git-panel">
        <div className="git-panel-empty">
          <FiGitBranch size={32} />
          <p>Source control is only available in local mode with an open project.</p>
        </div>
      </div>
    );
  }

  if (checkingRepo) {
    return (
      <div className="git-panel">
        <div className="git-panel-empty">
          <p>Checking repository...</p>
        </div>
      </div>
    );
  }

  if (!hasRepo) {
    return (
      <div className="git-panel">
        <div className="git-panel-empty">
          {postInitPrompt ? (
            <>
              <FiGithub size={32} />
              <p>Repository initialized! Would you like to publish it to GitHub?</p>
              <div className="git-dialog-actions">
                <button className="git-init-btn" onClick={handlePostInitYes}>Yes</button>
                <button className="git-init-btn git-init-btn-secondary" onClick={handlePostInitNo}>No</button>
              </div>
            </>
          ) : (
            <>
              <FiGitBranch size={32} />
              <p>This project does not have a git repository.</p>
              <button
                className="git-init-btn"
                onClick={handleInitRepo}
                disabled={initializing}
              >
                {initializing ? "Initializing..." : "Initialize Repository"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="git-panel">
      <div className="git-panel-header">
        <div className="git-branch-info">
          <FiGitBranch size={12} />
          <span className="git-branch-name">{branch || "main"}</span>
        </div>
        <div className="git-header-actions">
          {hasRemote && (
            <button className="git-header-btn" onClick={handlePush} title="Push" disabled={loading || pushing}>
              <FiArrowUp size={12} className={pushing ? "pulse" : ""} />
            </button>
          )}
          <button className="git-header-btn" onClick={refresh} title="Refresh" disabled={loading}>
            <FiRefreshCw size={12} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div className="git-commit-area">
        <div className="git-commit-input-wrap">
          <textarea
            className="git-commit-input"
            placeholder="Commit message (Ctrl+Enter to commit)"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleCommit(false);
              }
            }}
            rows={2}
          />
          {settings?.commitMessage?.enabled && stagedCount > 0 && (
            <button
              className="git-commit-magic-btn"
              onClick={handleGenerateMsg}
              disabled={generating}
              title={generating ? "Generating..." : "Generate commit message with Ollama"}
            >
              <FiZap size={14} className={generating ? "pulse" : ""} />
            </button>
          )}
        </div>
        <div className="git-commit-actions">
          <button
            className="git-commit-btn"
            onClick={() => handleCommit(false)}
            disabled={!commitMsg.trim() || committing || stagedCount === 0}
          >
            {committing && !pushing ? "Committing..." : "Commit"}
          </button>
          {hasRemote && (
            <button
              className="git-commit-btn git-commit-push-btn"
              onClick={() => handleCommit(true)}
              disabled={!commitMsg.trim() || committing || stagedCount === 0}
            >
              {pushing ? "Pushing..." : "Commit & Push"}
            </button>
          )}
        </div>
      </div>

      {!hasRemote && (
        <div className="git-publish-area">
          {!showPublishForm ? (
            <div className="git-publish-row">
              <button className="git-publish-btn" onClick={handleOpenPublish}>
                <FiGithub size={12} />
                Publish to GitHub
              </button>
            </div>
          ) : (
            <div className="git-publish-form">
              <input
                className="git-publish-input"
                type="text"
                placeholder="Repository name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                autoFocus
              />
              <div className="git-publish-actions">
                <select
                  className="git-visibility-select"
                  value={repoVisibility}
                  onChange={(e) => setRepoVisibility(e.target.value)}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <button
                  className="git-publish-btn"
                  onClick={handlePublishToGitHub}
                  disabled={publishing}
                >
                  {publishing ? "Publishing..." : "Publish"}
                </button>
                <button
                  className="git-publish-cancel"
                  onClick={() => setShowPublishForm(false)}
                  disabled={publishing}
                >
                  Cancel
                </button>
              </div>
              {publishError && <div className="git-publish-error">{publishError}</div>}
            </div>
          )}
        </div>
      )}

      <div className="git-sections">
        <div className="git-section">
          <div className="git-section-header">
            <div className="git-section-title" onClick={() => toggleSection("staged")}>
              {expandedSections.staged ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
              <span>Staged Changes {stagedCount > 0 && <span className="git-count">{stagedCount}</span>}</span>
            </div>
            {stagedCount > 0 && (
              <button className="git-section-action" onClick={handleUnstageAll} title="Unstage All">
                <FiMinus size={12} />
              </button>
            )}
          </div>
          {expandedSections.staged && (
            <div className="git-files">
              {stagedCount === 0 ? (
                <div className="git-empty-msg">No staged changes</div>
              ) : (
                status.staged.map((file) => (
                  <div key={file.path} className="git-file-item">
                    <span className={`git-file-status git-status-${file.status.toLowerCase()}`}>{file.status}</span>
                    <span className="git-file-path">{file.path}</span>
                    <button className="git-file-action" onClick={() => handleUnstage(file.path)} title="Unstage">
                      <FiMinus size={10} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="git-section">
          <div className="git-section-header">
            <div className="git-section-title" onClick={() => toggleSection("unstaged")}>
              {expandedSections.unstaged ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
              <span>Changes {unstagedCount > 0 && <span className="git-count">{unstagedCount}</span>}</span>
            </div>
            {unstagedCount > 0 && (
              <div className="git-section-actions">
                <button className="git-section-action" onClick={handleRevertAll} title="Revert All Changes">
                  <FiRotateCcw size={12} />
                </button>
                <button className="git-section-action" onClick={handleStageAll} title="Stage All">
                  <FiPlus size={12} />
                </button>
              </div>
            )}
          </div>
          {expandedSections.unstaged && (
            <div className="git-files">
              {unstagedCount === 0 ? (
                <div className="git-empty-msg">No changes</div>
              ) : (
                <>
                  {status.unstaged.map((file) => (
                    <div key={file.path} className="git-file-item">
                      <span className={`git-file-status git-status-${file.status.toLowerCase()}`}>{file.status}</span>
                      <span className="git-file-path">{file.path}</span>
                      <div className="git-file-actions">
                        <button className="git-file-action" onClick={() => handleRevert(file.path)} title="Revert">
                          <FiRotateCcw size={10} />
                        </button>
                        <button className="git-file-action" onClick={() => handleStage(file.path)} title="Stage">
                          <FiPlus size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {status.untracked.map((file) => (
                    <div key={file.path} className="git-file-item">
                      <span className="git-file-status git-status-u">U</span>
                      <span className="git-file-path">{file.path}</span>
                      <div className="git-file-actions">
                        <button className="git-file-action" onClick={() => handleRevert(file.path, true)} title="Delete (Untracked)">
                          <FiRotateCcw size={10} />
                        </button>
                        <button className="git-file-action" onClick={() => handleStage(file.path)} title="Stage">
                          <FiPlus size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="git-section">
          <div className="git-section-header" onClick={() => toggleSection("commits")}>
            {expandedSections.commits ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
            <span>Recent Commits</span>
            <span className="git-count">{commits.length}</span>
          </div>
          {expandedSections.commits && (
            <div className="git-files">
              {commits.length === 0 ? (
                <div className="git-empty-msg">No commits yet</div>
              ) : (
                commits.map((c) => (
                  <div key={c.hash} className="git-commit-item" title={c.message}>
                    <span className="git-commit-hash">{c.hash}</span>
                    <span className="git-commit-msg">{c.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
