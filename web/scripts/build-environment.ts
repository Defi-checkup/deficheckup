export function buildEnvironment(value: string | undefined) {
  if (value === undefined || value === 'production') return 'production';
  if (value === 'staging') return 'staging';
  throw new Error('DEFICHECKUP_ENV must be staging or production.');
}
