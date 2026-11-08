import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checks } from './index';

// Rules every protocol in the catalog must follow, so adding one stays a form to fill in.
describe('catalog', () => {
  it('has unique ids that are safe folder names', () => {
    const ids = checks.map((check) => check.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it.each(checks.map((check) => [check.id, check] as const))(
    '%s has its folder, test and English guide',
    (id) => {
      for (const file of ['check.ts', 'check.test.ts', 'guide.en.md']) {
        expect(existsSync(join(import.meta.dirname, id, file)), `${id}/${file}`).toBe(true);
      }
    },
  );

  it.each(checks.map((check) => [check.id, check] as const))(
    '%s links to an official https page and has a verification date',
    (_id, check) => {
      expect(check.officialLink).toMatch(/^https:\/\//);
      expect(check.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(check.verifiedOn).getTime()).toBeLessThanOrEqual(Date.now());
    },
  );
});
