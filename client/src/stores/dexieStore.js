import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_FILES = {};

class LocalDB extends Dexie {
  constructor() {
    super('CodeVideoLocal');

    this.version(1).stores({
      projects: '++id, name, createdAt, updatedAt',
      recordings: '++id, projectId, name, createdAt',
    });

    this.projects = this.table('projects');
    this.recordings = this.table('recordings');
  }
}

const db = new LocalDB();

export async function getLocalProjects() {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function createLocalProject(name = 'New Project') {
  const now = Date.now();
  const id = uuidv4();
  await db.projects.add({
    id,
    name,
    files: JSON.parse(JSON.stringify(DEFAULT_FILES)),
    createdAt: now,
    updatedAt: now,
  });
  return { id, name, files: DEFAULT_FILES };
}

export async function updateLocalProject(id, data) {
  await db.projects.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteLocalProject(id) {
  await db.recordings.where('projectId').equals(id).delete();
  await db.projects.delete(id);
}

export async function getLocalProject(id) {
  return db.projects.get(id);
}

export async function saveLocalRecording(projectId, name, data) {
  const now = Date.now();
  const id = uuidv4();
  await db.recordings.add({
    id,
    projectId,
    name,
    data: JSON.parse(JSON.stringify(data)),
    createdAt: now,
  });
  if (projectId) {
    await db.projects.update(projectId, { updatedAt: now });
  }
  return id;
}

export async function getLocalRecordings(projectId) {
  const records = await db.recordings
    .where('projectId')
    .equals(projectId || '')
    .reverse()
    .toArray();
  return records.map((r) => [r.name, r.id]);
}

export async function getLocalRecording(id) {
  return db.recordings.get(id);
}

export async function deleteLocalRecording(id) {
  await db.recordings.delete(id);
}

export async function getAllLocalRecordings() {
  return db.recordings.orderBy('createdAt').reverse().toArray();
}

export async function getProjectDir() {
  return null;
}
