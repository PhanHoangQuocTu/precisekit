import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read public package metadata, without inheriting local npm credentials or registries.
// Only a successful, well-formed response can establish that a version is absent.
export async function assertUnpublishedPackage(name, version, fetchMetadata = fetch) {
  const response = await fetchMetadata(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (response.status !== 200) {
    throw new Error(`Cannot verify npm registry state (HTTP ${response.status}); publishing is blocked.`);
  }
  const metadata = await response.json();
  if (!metadata || metadata.name !== name || !metadata.versions || typeof metadata.versions !== 'object' || Array.isArray(metadata.versions)) {
    throw new Error('Invalid npm registry metadata; publishing is blocked.');
  }
  if (Object.hasOwn(metadata.versions, version)) {
    throw new Error(`${name}@${version} is already published to npm. Never republish an existing version.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { name, version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    await assertUnpublishedPackage(name, version);
    console.log(`Registry verified: ${name}@${version} is not published.`);
  } catch (error) {
    console.error(`Release preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}
