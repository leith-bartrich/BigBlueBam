// Terminal color helpers — zero dependencies, ANSI escape codes only.

export const bold = (s) => `\x1b[1m${s}\x1b[0m`;
export const green = (s) => `\x1b[32m${s}\x1b[0m`;
export const red = (s) => `\x1b[31m${s}\x1b[0m`;
export const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
export const blue = (s) => `\x1b[34m${s}\x1b[0m`;
export const dim = (s) => `\x1b[2m${s}\x1b[0m`;
export const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
export const magenta = (s) => `\x1b[35m${s}\x1b[0m`;

export const check = green('[ok]');
export const cross = red('[FAIL]');
export const arrow = blue('->');
export const warn = yellow('[!]');
