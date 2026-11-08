import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalCheckCommands } from './maintenance';

const workflow = readFileSync(
  new URL('../.github/workflows/maintenance.yml', import.meta.url),
  'utf8',
);
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

describe('maintenance workflow trust boundary', () => {
  it('uses only weekly/manual triggers and minimum permissions with serialized runs', () => {
    expect(workflow).toContain("cron: '23 8 * * 1'");
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/pull_request|workflow_run|repository_dispatch|secrets\./);
    expect(workflow).toContain('github.event.repository.fork == false');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain('permissions:\n  contents: read\n  issues: write');
    expect(workflow).toContain('group: catalog-maintenance\n  cancel-in-progress: false');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('GITHUB_TOKEN: ${{ github.token }}');
  });

  it('uses the CI action pins and setup, delegating all maintenance logic to the TypeScript script', () => {
    const actions = (text: string) =>
      [...text.matchAll(/uses: ([\w/-]+)@([a-f0-9]{40}) # (v[\d.]+)/g)].map((match) => match[0]);
    expect(actions(workflow)).toHaveLength(3);
    expect(actions(workflow)).toEqual(actions(ci));
    expect(workflow).toContain('node-version-file: .node-version');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow.match(/- run: .+/g)).toEqual([
      '- run: pnpm install --frozen-lockfile',
      '- run: pnpm maintenance',
    ]);
    expect([...ci.matchAll(/- run: pnpm ([\w:]+)\s*$/gm)].map((match) => match[1])).toEqual([
      ...normalCheckCommands,
    ]);
  });
});
