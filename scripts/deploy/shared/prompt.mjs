// Interactive readline helpers — zero dependencies (node:readline only).

import * as readline from 'node:readline';
import { bold, blue, dim, cyan, green } from './colors.mjs';

/** Create a readline interface bound to stdin/stdout. */
function createRl() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a simple text question. Returns the trimmed answer (or defaultValue).
 */
export function ask(question, defaultValue) {
  return new Promise((resolve) => {
    const rl = createRl();
    rl.on('error', () => rl.close());
    const suffix = defaultValue != null ? ` ${dim(`[${defaultValue}]`)}` : '';
    rl.question(`${question}${suffix} `, (answer) => {
      rl.close();
      const val = answer.trim();
      resolve(val || defaultValue || '');
    });
  });
}

/**
 * Ask for a password — input is masked with asterisks.
 */
export function askPassword(question) {
  return new Promise((resolve) => {
    const rl = createRl();
    rl.on('error', () => rl.close());
    process.stdout.write(`${question} `);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    try { if (stdin.isTTY) stdin.setRawMode(true); } catch {}

    let password = '';
    const onData = (ch) => {
      const c = ch.toString('utf8');
      if (c === '\n' || c === '\r' || c === '\u0004') {
        // Enter or Ctrl-D
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(password);
      } else if (c === '\u0003') {
        // Ctrl-C
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        process.exit(130);
      } else if (c === '\u007f' || c === '\b') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (c.charCodeAt(0) >= 32) {
        password += c;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

/**
 * Y/n confirmation. Returns true/false.
 */
export function confirm(question, defaultYes = true) {
  return new Promise((resolve) => {
    const rl = createRl();
    rl.on('error', () => rl.close());
    const hint = defaultYes ? dim('[Y/n]') : dim('[y/N]');
    rl.question(`${question} ${hint} `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else resolve(a === 'y' || a === 'yes');
    });
  });
}

/**
 * Numbered selection menu. Returns the `value` of the chosen option.
 * @param {string} question
 * @param {{ label: string, value: string, description?: string }[]} options
 */
export function select(question, options) {
  return new Promise((resolve) => {
    const rl = createRl();
    rl.on('error', () => rl.close());
    console.log(`\n${bold(question)}\n`);
    options.forEach((opt, i) => {
      const num = cyan(`  ${i + 1}.`);
      const desc = opt.description ? `  ${dim(opt.description)}` : '';
      console.log(`${num} ${opt.label}${desc}`);
    });
    console.log('');

    const doAsk = () => {
      rl.question(`${blue('Choose')} ${dim(`[1-${options.length}]`)}: `, (answer) => {
        const idx = parseInt(answer.trim(), 10) - 1;
        if (idx >= 0 && idx < options.length) {
          rl.close();
          resolve(options[idx].value);
        } else {
          console.log(`  Please enter a number between 1 and ${options.length}.`);
          doAsk();
        }
      });
    };
    doAsk();
  });
}

/**
 * Print a boxed banner header.
 */
export function banner(title) {
  const pad = 4;
  const inner = title.length + pad * 2;
  const top = '+' + '='.repeat(inner) + '+';
  const mid = '|' + ' '.repeat(pad) + bold(title) + ' '.repeat(pad) + '|';
  const bot = '+' + '='.repeat(inner) + '+';
  console.log('');
  console.log(green(top));
  console.log(green(mid));
  console.log(green(bot));
  console.log('');
}
