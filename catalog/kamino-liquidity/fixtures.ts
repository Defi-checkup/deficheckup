// Lossless expansion of the recorded registry's common fields. All 5,612 rows are retained.
// Test and live-test helper only; the browser imports check.ts, never this fixture.
import recorded from './recorded.json';

export function recordedRegistry() {
  const { common, context, accounts } = recorded.registry;
  return {
    context: { ...context },
    value: accounts.map(([pubkey, lamports, data]) => ({
      pubkey: pubkey as string,
      account: {
        owner: common.owner,
        executable: common.executable,
        space: common.space,
        lamports: lamports as number,
        data: [data as string, common.encoding],
      },
    })),
  };
}
