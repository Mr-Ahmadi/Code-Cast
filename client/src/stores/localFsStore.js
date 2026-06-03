import { v4 as uuidv4 } from 'uuid';

const ROOT_DIR_KEY = 'codevideo_fs_root';

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
  return r ? `${r}/codevideo-projects` : '';
}

function recordingsDir() {
  const r = rootDir();
  return r ? `${r}/codevideo-recordings` : '';
}

function projectPath(id) {
  return `${projectsDir()}/${id}.json`;
}

function recordingPath(id) {
  return `${recordingsDir()}/${id}.json`;
}

export function isConfigured() {
  return !!rootDir();
}

export async function configureRoot() {
  const f = api();
  if (!f) return false;
  const dir = await f.selectDirectory();
  if (!dir) return false;
  localStorage.setItem(ROOT_DIR_KEY, dir);
  await f.mkdir(projectsDir());
  await f.mkdir(recordingsDir());
  return true;
}

export function getRootDir() {
  return rootDir();
}

export async function getLocalProjects() {
  const f = api();
  if (!f) return [];
  const dir = projectsDir();
  const entries = await f.list(dir);
  const projects = [];
  for (const e of entries) {
    if (!e.name.endsWith('.json')) continue;
    const data = await f.read(`${dir}/${e.name}`);
    if (!data) continue;
    try {
      const p = JSON.parse(data);
      projects.push(p);
    } catch {}
  }
  projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return projects;
}

export async function createLocalProject(name = 'New Project') {
  const f = api();
  if (!f) throw new Error('File system not available');
  const now = Date.now();
  const id = uuidv4();
  const project = {
    id,
    name,
    files: JSON.parse(JSON.stringify(DEFAULT_FILES)),
    createdAt: now,
    updatedAt: now,
  };
  await f.write(projectPath(id), JSON.stringify(project, null, 2));
  return project;
}

export async function updateLocalProject(id, data) {
  const f = api();
  if (!f) return;
  const existing = await getLocalProject(id);
  if (!existing) return;
  const updated = { ...existing, ...data, updatedAt: Date.now() };
  await f.write(projectPath(id), JSON.stringify(updated, null, 2));
}

export async function deleteLocalProject(id) {
  const f = api();
  if (!f) return;
  const recs = await getLocalRecordings(id);
  for (const [, rid] of recs) {
    await f.remove(recordingPath(rid));
  }
  await f.remove(projectPath(id));
}

export async function getLocalProject(id) {
  const f = api();
  if (!f) return null;
  const data = await f.read(projectPath(id));
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveLocalRecording(projectId, name, data) {
  const f = api();
  if (!f) throw new Error('File system not available');
  const now = Date.now();
  const id = uuidv4();
  const rec = {
    id,
    projectId,
    name,
    data: JSON.parse(JSON.stringify(data)),
    createdAt: now,
  };
  await f.write(recordingPath(id), JSON.stringify(rec, null, 2));
  if (projectId) {
    await updateLocalProject(projectId, { updatedAt: now });
  }
  return id;
}

export async function getLocalRecordings(projectId) {
  const f = api();
  if (!f) return [];
  const dir = recordingsDir();
  const entries = await f.list(dir);
  const results = [];
  for (const e of entries) {
    if (!e.name.endsWith('.json')) continue;
    const raw = await f.read(`${dir}/${e.name}`);
    if (!raw) continue;
    try {
      const rec = JSON.parse(raw);
      if (rec.projectId === (projectId || null)) {
        results.push([rec.name, rec.id]);
      }
    } catch {}
  }
  results.sort((a, b) => a[0].localeCompare(b[0]));
  return results;
}

export async function getLocalRecording(id) {
  const f = api();
  if (!f) return null;
  const data = await f.read(recordingPath(id));
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function deleteLocalRecording(id) {
  const f = api();
  if (!f) return;
  await f.remove(recordingPath(id));
}

export async function getAllLocalRecordings() {
  const f = api();
  if (!f) return [];
  const dir = recordingsDir();
  const entries = await f.list(dir);
  const results = [];
  for (const e of entries) {
    if (!e.name.endsWith('.json')) continue;
    const raw = await f.read(`${dir}/${e.name}`);
    if (!raw) continue;
    try {
      results.push(JSON.parse(raw));
    } catch {}
  }
  results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return results;
}
