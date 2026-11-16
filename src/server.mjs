import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCareerServer } from './career-server.mjs';

export { createCareerServer } from './career-server.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const server = createCareerServer();
  server.listen(port, host, () => console.log(`Career Versuch 2 running at http://localhost:${port}`));
}
