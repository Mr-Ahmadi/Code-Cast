import { v4 as uuidv4 } from 'uuid';

const ROOT_DIR_KEY = 'codecast_fs_root';

const DEFAULT_FILES = {
  'index.html': { language: 'html', firstValue: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Project</title>\n</head>\n<body>\n</body>\n</html>' },
  'style.css': { language: 'css', firstValue: '' },
  'script.js': { language: 'javascript', firstValue: '' },
};

function rootDir() {
  return localStorage.getItem(ROOT_DIR_KEY) || '';
}

const api = () => window.electronAPI?.file;

function projectsDir() {
  const r = rootDir();
  return r ? `${r}/codecast-projects` : '';
}

function indexFilePath() {
  return `${projectsDir()}/index.json`;
}

async function readIndex() {
  const f = api();
  if (!f) return {};
  await f.mkdir(projectsDir());
  const raw = await f.read(indexFilePath());
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function writeIndex(index) {
  const f = api();
  if (!f) return;
  await f.mkdir(projectsDir());
  await f.write(indexFilePath(), JSON.stringify(index, null, 2));
}

export async function getProjectDir(id) {
  const index = await readIndex();
  return index[id] || null;
}

function projectJsonPath(dir) {
  return `${dir}/project.json`;
}

function projectRecordsDir(dir) {
  return `${dir}/records`;
}

function recordingFilePath(dir, recId) {
  return `${projectRecordsDir(dir)}/${recId}.json`;
}

export function isConfigured() {
  // File system is available if running in Electron (no root dir needed for Open Folder)
  return !!(api());
}

export async function configureRoot() {
  const f = api();
  if (!f) return false;
  const dir = await f.selectDirectory();
  if (!dir) return false;
  localStorage.setItem(ROOT_DIR_KEY, dir);
  await f.mkdir(projectsDir());
  return true;
}

export function getRootDir() {
  return rootDir();
}

export async function getLocalProjects() {
  const f = api();
  if (!f) return [];
  const index = await readIndex();
  const projects = [];
  for (const dir of Object.values(index)) {
    const raw = await f.read(projectJsonPath(dir));
    if (!raw) continue;
    try {
      const p = JSON.parse(raw);
      projects.push(p);
    } catch {
      // intentionally empty
    }
  }
  projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return projects;
}

export async function createLocalProject(name = 'New Project') {
  const f = api();
  if (!f) throw new Error('File system not available');

  const dir = await f.selectProjectDirectory(name);
  if (!dir) return null;

  const existing = await f.read(projectJsonPath(dir));
  if (existing) {
    throw new Error('This folder already contains a project');
  }

  const now = Date.now();
  const id = uuidv4();
  const project = {
    id,
    name,
    path: dir,
    files: JSON.parse(JSON.stringify(DEFAULT_FILES)),
    createdAt: now,
    updatedAt: now,
  };

  await f.mkdir(dir);
  await f.write(projectJsonPath(dir), JSON.stringify(project, null, 2));
  await f.mkdir(projectRecordsDir(dir));

  const index = await readIndex();
  index[id] = dir;
  await writeIndex(index);

  return project;
}

export async function updateLocalProject(id, data) {
  const f = api();
  if (!f) return;
  const dir = await getProjectDir(id);
  if (!dir) return;
  const raw = await f.read(projectJsonPath(dir));
  if (!raw) return;
  try {
    const existing = JSON.parse(raw);
    const updated = { ...existing, ...data, updatedAt: Date.now() };
    await f.write(projectJsonPath(dir), JSON.stringify(updated, null, 2));
  } catch {
    // intentionally empty
  }
}

export async function deleteLocalProject(id) {
  const f = api();
  if (!f) return;
  const dir = await getProjectDir(id);
  if (!dir) return;

  const recs = await getLocalRecordings(id);
  for (const [, rid] of recs) {
    await f.remove(recordingFilePath(dir, rid));
  }

  await f.remove(projectJsonPath(dir));

  try {
    const entries = await f.list(projectRecordsDir(dir));
    if (entries.length === 0) {
      await f.remove(projectRecordsDir(dir));
    }
  } catch {
    // intentionally empty
  }

  const index = await readIndex();
  delete index[id];
  await writeIndex(index);
}

export async function getLocalProject(id) {
  const f = api();
  if (!f) return null;
  const dir = await getProjectDir(id);
  if (!dir) return null;
  const raw = await f.read(projectJsonPath(dir));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveLocalRecording(projectId, name, data, projectPath) {
  const f = api();
  if (!f) throw new Error('File system not available');

  let dir = projectPath;
  if (!dir) {
    dir = await getProjectDir(projectId);
  }
  if (!dir) throw new Error('Project directory not found');

  const now = Date.now();
  const id = uuidv4();
  const rec = {
    id,
    projectId: projectId || 'opened-folder',
    name,
    data: JSON.parse(JSON.stringify(data)),
    createdAt: now,
  };

  const recDir = `${dir}/.record`;
  const mkdirOk = await f.mkdir(recDir);
  if (!mkdirOk) throw new Error(`Failed to create directory: ${recDir}`);

  const filePath = `${recDir}/${id}.json`;
  const writeOk = await f.write(filePath, JSON.stringify(rec, null, 2));
  if (!writeOk) throw new Error(`Failed to write recording file: ${filePath}`);

  if (projectId) {
    await updateLocalProject(projectId, { updatedAt: now });
  }
  return id;
}

export async function getLocalRecordings(projectId, projectPath) {
  const f = api();
  if (!f) return [];

  const dirs = [];
  if (projectPath) {
    dirs.push(`${projectPath}/.record`);
  } else if (projectId) {
    const dir = await getProjectDir(projectId);
    if (dir) {
      dirs.push(projectRecordsDir(dir));
      dirs.push(`${dir}/.record`);
    }
  } else {
    const index = await readIndex();
    for (const dir of Object.values(index)) {
      dirs.push(projectRecordsDir(dir));
      dirs.push(`${dir}/.record`);
    }
  }

  const results = [];
  for (const recDir of dirs) {
    let entries;
    try {
      entries = await f.list(recDir);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.name.endsWith('.json')) continue;
      const raw = await f.read(`${recDir}/${e.name}`);
      if (!raw) continue;
      try {
        const rec = JSON.parse(raw);
        results.push([rec.name, rec.id]);
      } catch {
      // intentionally empty
    }
    }
  }
  results.sort((a, b) => a[0].localeCompare(b[0]));
  return results;
}

export async function getLocalRecording(id, projectPath) {
  const f = api();
  if (!f) return null;

  // If projectPath is given, check there first (for opened folders not in the index)
  if (projectPath) {
    for (const recDir of [projectRecordsDir(projectPath), `${projectPath}/.record`]) {
      const raw = await f.read(`${recDir}/${id}.json`);
      if (raw) {
        try { return JSON.parse(raw); } catch { return null; }
      }
    }
  }

  const searchDirs = [];
  const index = await readIndex();
  for (const dir of Object.values(index)) {
    searchDirs.push(dir);
  }

  const rootDirVal = rootDir();
  if (rootDirVal) {
    const folders = await f.list(rootDirVal);
    for (const entry of folders) {
      if (entry.isDirectory) {
        const fullPath = `${rootDirVal}/${entry.name}`;
        if (!searchDirs.includes(fullPath)) {
          searchDirs.push(fullPath);
        }
      }
    }
  }

  for (const dir of searchDirs) {
    for (const recDir of [projectRecordsDir(dir), `${dir}/.record`]) {
      const raw = await f.read(`${recDir}/${id}.json`);
      if (raw) {
        try { return JSON.parse(raw); } catch { return null; }
      }
    }
  }
  return null;
}

export async function deleteLocalRecording(id, projectPath) {
  const f = api();
  if (!f) return;

  // If projectPath is known, check there first (for opened folders not in the index)
  if (projectPath) {
    for (const recDir of [`${projectPath}/.record`, projectRecordsDir(projectPath)]) {
      const p = `${recDir}/${id}.json`;
      const exists = await f.exists(p);
      if (exists) {
        await f.remove(p);
        return;
      }
    }
  }

  const searchDirs = [];
  const index = await readIndex();
  for (const dir of Object.values(index)) {
    searchDirs.push(dir);
  }

  const rDir = rootDir();
  if (rDir) {
    const folders = await f.list(rDir);
    for (const entry of folders) {
      if (entry.isDirectory) {
        const fullPath = `${rDir}/${entry.name}`;
        if (!searchDirs.includes(fullPath)) {
          searchDirs.push(fullPath);
        }
      }
    }
  }

  for (const dir of searchDirs) {
    for (const recDir of [projectRecordsDir(dir), `${dir}/.record`]) {
      const p = `${recDir}/${id}.json`;
      const exists = await f.exists(p);
      if (exists) {
        await f.remove(p);
        return;
      }
    }
  }
}

export async function getAllLocalRecordings() {
  const f = api();
  if (!f) return [];

  const searchDirs = [];
  const index = await readIndex();
  for (const dir of Object.values(index)) {
    searchDirs.push(dir);
  }

  const rootDirVal = rootDir();
  if (rootDirVal) {
    const folders = await f.list(rootDirVal);
    for (const entry of folders) {
      if (entry.isDirectory) {
        searchDirs.push(`${rootDirVal}/${entry.name}`);
      }
    }
  }

  const results = [];
  for (const dir of searchDirs) {
    for (const recDir of [projectRecordsDir(dir), `${dir}/.record`]) {
      let entries;
      try {
        entries = await f.list(recDir);
      } catch {
        continue;
      }
      for (const e of entries) {
        if (!e.name.endsWith('.json')) continue;
        const raw = await f.read(`${recDir}/${e.name}`);
        if (!raw) continue;
        try {
          results.push(JSON.parse(raw));
        } catch {
      // intentionally empty
    }
      }
    }
  }
  results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return results;
}
