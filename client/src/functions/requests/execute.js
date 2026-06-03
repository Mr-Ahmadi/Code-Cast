import axios from "axios";

export const executeCode = async (language, sourceCode) => {
  const mode = localStorage.getItem('codecast_mode') || 'online';
  const lang = Array.isArray(language) ? language[0] : language;

  if (mode === 'local' && window.electronAPI?.execute) {
    return window.electronAPI.execute.run({ language: lang, sourceCode });
  }

  if (mode === 'local') {
    return {
      run: {
        stdout: '',
        stderr: 'Local execution requires the Electron desktop app. Run with: npm run electron',
        output: 'Local execution requires the Electron desktop app. Run with: npm run electron',
        code: 1,
        signal: null,
      },
    };
  }

  const response = await axios.request({
    method: "post",
    url: "index/execute",
    headers: { "Content-Type": "application/json" },
    data: { language: lang, sourceCode },
    withCredentials: true,
  });
  return response.data;
};
