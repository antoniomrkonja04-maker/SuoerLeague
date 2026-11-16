import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createSharedStateStore(filePath) {
  let writes = Promise.resolve();

  async function read() {
    try {
      const envelope = JSON.parse(await readFile(filePath, 'utf8'));
      if (!Number.isInteger(envelope.revision) || envelope.revision < 1 || !envelope.state) {
        throw new Error('Shared Career state file has an invalid structure.');
      }
      return envelope;
    } catch (error) {
      if (error.code === 'ENOENT') return { revision: 0, state: null };
      throw error;
    }
  }

  function write(state, expectedRevision) {
    const operation = writes.then(async () => {
      const current = await read();
      if (expectedRevision !== current.revision) return { conflict: true, current };
      const next = { revision: current.revision + 1, state };
      await mkdir(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await writeFile(temporary, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, filePath);
      return next;
    });
    writes = operation.catch(() => {});
    return operation;
  }

  return { read, write };
}
