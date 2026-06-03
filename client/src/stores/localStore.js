import * as fsStore from './localFsStore';

export function isConfigured() {
  return fsStore.isConfigured();
}

export function configureRoot() {
  return fsStore.configureRoot();
}

export function getRootDir() {
  return fsStore.getRootDir();
}

let dexieStore;

async function getDexie() {
  if (!dexieStore) {
    dexieStore = await import('./dexieStore');
  }
  return dexieStore;
}

export async function getLocalProjects() {
  if (fsStore.isConfigured()) return fsStore.getLocalProjects();
  const d = await getDexie();
  return d.getLocalProjects();
}

export async function createLocalProject(name = 'New Project') {
  if (fsStore.isConfigured()) return fsStore.createLocalProject(name);
  const d = await getDexie();
  return d.createLocalProject(name);
}

export async function updateLocalProject(id, data) {
  if (fsStore.isConfigured()) return fsStore.updateLocalProject(id, data);
  const d = await getDexie();
  return d.updateLocalProject(id, data);
}

export async function deleteLocalProject(id) {
  if (fsStore.isConfigured()) return fsStore.deleteLocalProject(id);
  const d = await getDexie();
  return d.deleteLocalProject(id);
}

export async function getLocalProject(id) {
  if (fsStore.isConfigured()) return fsStore.getLocalProject(id);
  const d = await getDexie();
  return d.getLocalProject(id);
}

export async function saveLocalRecording(projectId, name, data) {
  if (fsStore.isConfigured()) return fsStore.saveLocalRecording(projectId, name, data);
  const d = await getDexie();
  return d.saveLocalRecording(projectId, name, data);
}

export async function getLocalRecordings(projectId) {
  if (fsStore.isConfigured()) return fsStore.getLocalRecordings(projectId);
  const d = await getDexie();
  return d.getLocalRecordings(projectId);
}

export async function getLocalRecording(id) {
  if (fsStore.isConfigured()) return fsStore.getLocalRecording(id);
  const d = await getDexie();
  return d.getLocalRecording(id);
}

export async function deleteLocalRecording(id) {
  if (fsStore.isConfigured()) return fsStore.deleteLocalRecording(id);
  const d = await getDexie();
  return d.deleteLocalRecording(id);
}

export async function getAllLocalRecordings() {
  if (fsStore.isConfigured()) return fsStore.getAllLocalRecordings();
  const d = await getDexie();
  return d.getAllLocalRecordings();
}
