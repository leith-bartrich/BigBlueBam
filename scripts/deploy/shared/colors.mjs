// Terminal color helpers — zero dependencies, ANSI escape codes only.

const supportsColor = process.env.FORCE_COLOR !== '0' && (
  process.stdout.isTTY ||
  process.env.FORCE_COLOR === '1' ||
  process.env.COLORTERM != null ||
  (process.env.TERM && process.env.TERM !== 'dumb')
);

const wrap = supportsColor
  ? (code, s) => `\x1b[${code}m${s}\x1b[0m`
  : (_code, s) => s;

export const bold = (s) => wrap('1', s);
export const green = (s) => wrap('32', s);
export const red = (s) => wrap('31', s);
export const yellow = (s) => wrap('33', s);
export const blue = (s) => wrap('34', s);
export const dim = (s) => wrap('2', s);
export const cyan = (s) => wrap('36', s);
export const magenta = (s) => wrap('35', s);

export const check = green('[ok]');
export const cross = red('[FAIL]');
export const arrow = blue('->');
export const warn = yellow('[!]');
