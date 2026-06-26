export const BINARY_EXTS = new Set([
  "exe", "dll", "bin", "iso", "img", "msi",
  "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "mp3", "mp4", "wav", "flac", "mov", "avi", "mkv",
  "swf", "flv", "psd", "ai", "eps", "tiff", "raw",
  "dmg", "pkg", "deb", "rpm", "node", "dylib", "so",
  "pyc", "pyo", "pyd", "class", "jar", "war", "ear"
]);

export function isBinaryFile(name) {
  if (!name) return false;
  const parts = name.split(".");
  if (parts.length === 1) return false;
  const ext = parts.pop().toLowerCase();
  return BINARY_EXTS.has(ext);
}

export function isTextFile(name) {
  return !isBinaryFile(name);
}

export function extLang(name) {
  if (!name) return "plaintext";
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
  const map = {
    html: "html", htm: "html",
    css: "css", scss: "scss", less: "less",
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python",
    json: "json", jsonc: "json",
    md: "markdown", mdx: "markdown",
    xml: "xml", svg: "xml",
    sql: "sql",
    sh: "shell", bash: "shell", zsh: "shell",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    php: "php",
    c: "c", cpp: "cpp", h: "c", hpp: "cpp",
    yaml: "yaml", yml: "yaml",
    toml: "toml",
    lua: "lua",
    r: "r",
    pl: "perl", pm: "perl",
    dart: "dart",
    swift: "swift",
  };
  return map[ext] || "plaintext";
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "svg"]);
const PDF_EXTS = new Set(["pdf"]);

export function isImageFile(name) {
  if (!name) return false;
  const ext = name.split(".").pop()?.toLowerCase();
  return IMAGE_EXTS.has(ext);
}

export function isPdfFile(name) {
  if (!name) return false;
  const ext = name.split(".").pop()?.toLowerCase();
  return PDF_EXTS.has(ext);
}

export function isReadmeFile(name) {
  if (!name) return false;
  const base = name.split("/").pop().toLowerCase();
  return base === "readme" || base.startsWith("readme.");
}

export function getIconType(name) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
  
  const codeExts = new Set([
    "js", "jsx", "ts", "tsx", "mjs", "cjs",
    "html", "htm", "css", "scss", "less",
    "py", "rb", "go", "rs", "java", "kt", "swift", "c", "cpp", "h", "hpp",
    "json", "xml", "yaml", "yml", "toml", "ini", "cfg",
    "md", "sh", "bash", "zsh", "sql", "graphql", "php", "lua", "r"
  ]);

  const imgExts = new Set(["png", "jpg", "jpeg", "gif", "svg", "ico", "webp"]);

  if (codeExts.has(ext)) return "code";
  if (imgExts.has(ext)) return "image";
  return "text";
}

