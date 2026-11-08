import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startServer } from '../../tests/e2e/server.mjs';
import { guideArt } from '../src/lib/guide-art.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('../../test-results/lighthouse/', import.meta.url);
const temporary = new URL('./tmp/', output);
await mkdir(temporary, { recursive: true });
// Resolve the installed executable without launching Playwright. CHROME_PATH can select local Chrome.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL('../../node_modules/.cache/ms-playwright/', import.meta.url),
);
const chromePath = process.env.CHROME_PATH || chromium.executablePath();
const cli = fileURLToPath(import.meta.resolve('lighthouse/cli/index.js'));
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
const { version } = JSON.parse(
  await readFile(new URL('../package.json', import.meta.resolve('lighthouse')), 'utf8'),
);
const summary = {
  lighthouseVersion: version,
  threshold: 90,
  generatedAt: new Date().toISOString(),
  runs: [],
};
const server = await startServer(0);
const origin = `http://127.0.0.1:${server.address().port}`;

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, CHROME_PATH: chromePath, TMPDIR: fileURLToPath(temporary) },
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Lighthouse exited with ${signal || code}.`));
    });
  });
}

try {
  for (const path of [
    '/',
    '/protocols',
    ...Object.keys(guideArt).map((id) => `/protocols/${id}`),
  ]) {
    for (const device of ['mobile', 'desktop']) {
      const reportFile = `${path === '/' ? 'home' : path.slice(1).replaceAll('/', '-')}-${device}.json`;
      const entry = { path, device, scores: null, reportFile };
      summary.runs.push(entry);
      console.log(`Lighthouse: ${path} (${device})`);
      try {
        await run([
          `${origin}${path}`,
          '--quiet',
          '--chrome-flags=--headless',
          '--only-categories=' + categories.join(','),
          '--output=json',
          '--output-path=' + fileURLToPath(new URL(reportFile, output)),
          ...(device === 'desktop' ? ['--preset=desktop'] : []),
        ]);
        const report = JSON.parse(await readFile(new URL(reportFile, output), 'utf8'));
        if (report.runtimeError) throw new Error(report.runtimeError.message);
        entry.scores = Object.fromEntries(
          categories.map((category) => {
            const score = report.categories[category]?.score;
            if (typeof score !== 'number') throw new Error(`Missing score: ${category}.`);
            return [category, Math.round(score * 100)];
          }),
        );
        if (
          Object.values(entry.scores).some((score) => score < summary.threshold) ||
          entry.scores.seo !== 100 ||
          (path === '/' && entry.scores.performance < (device === 'desktop' ? 100 : 90))
        )
          process.exitCode = 1;
        console.log(entry.scores);
      } catch (error) {
        entry.error = error.message;
        process.exitCode = 1;
        console.error(`${path} (${device}): ${error.message}`);
      }
      await writeFile(new URL('scores.json', output), JSON.stringify(summary, null, 2) + '\n');
    }
  }
  console.log('Scores and full reports: test-results/lighthouse/');
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
