/**
 * Renders an array of EmailBlocks into email-safe HTML.
 *
 * All styles are inlined — email clients ignore <style> blocks.
 * Wraps everything in a 600px centered table for maximum compatibility.
 */

import type { EmailBlock } from './block-types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case 'header': {
      const { text, level, align, color } = block.props;
      const sizes = { 1: 28, 2: 22, 3: 18 } as const;
      const fontSize = sizes[level];
      return `<h${level} style="margin:0;padding:12px 0;font-size:${fontSize}px;font-weight:700;color:${color};text-align:${align};line-height:1.3;">${esc(text)}</h${level}>`;
    }

    case 'text': {
      const { html, align, color, fontSize } = block.props;
      return `<div style="padding:8px 0;color:${color};font-size:${fontSize}px;line-height:1.6;text-align:${align};">${html}</div>`;
    }

    case 'image': {
      const { src, alt, href, width, align, borderRadius } = block.props;
      const widthVal = width === 'full' ? '100%' : width;
      const img = `<img src="${esc(src)}" alt="${esc(alt)}" width="${widthVal === '100%' ? 600 : ''}" style="max-width:${widthVal};height:auto;display:block;border-radius:${borderRadius}px;${align === 'center' ? 'margin:0 auto;' : ''}" />`;
      const wrapped = href ? `<a href="${esc(href)}" target="_blank">${img}</a>` : img;
      return `<div style="padding:12px 0;text-align:${align};">${wrapped}</div>`;
    }

    case 'button': {
      const { text, href, bgColor, textColor, align, borderRadius, fullWidth } = block.props;
      const widthStyle = fullWidth ? 'display:block;width:100%;' : 'display:inline-block;';
      return `<div style="padding:16px 0;text-align:${align};">
        <a href="${esc(href)}" target="_blank" style="${widthStyle}background-color:${bgColor};color:${textColor};padding:12px 28px;border-radius:${borderRadius}px;text-decoration:none;font-weight:600;font-size:16px;text-align:center;">${esc(text)}</a>
      </div>`;
    }

    case 'divider': {
      const { color, thickness, style, padding } = block.props;
      return `<div style="padding:${padding}px 0;"><hr style="border:0;border-top:${thickness}px ${style} ${color};margin:0;" /></div>`;
    }

    case 'columns': {
      const { columns, contents } = block.props;
      const pct = Math.floor(100 / columns);
      const cells = contents
        .slice(0, columns)
        .map(
          (html) =>
            `<td style="width:${pct}%;padding:8px;vertical-align:top;font-size:14px;line-height:1.5;color:#374151;">${html}</td>`,
        )
        .join('');
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:8px 0;"><tr>${cells}</tr></table>`;
    }

    case 'social': {
      const { align, links } = block.props;
      // Text-based social links (no image dependency)
      const items = links
        .map(
          (l) =>
            `<a href="${esc(l.url)}" target="_blank" style="display:inline-block;padding:6px 12px;margin:4px;background:#f3f4f6;border-radius:4px;color:#374151;text-decoration:none;font-size:13px;font-weight:500;">${esc(l.platform)}</a>`,
        )
        .join('');
      return `<div style="padding:12px 0;text-align:${align};">${items}</div>`;
    }

    case 'spacer':
      return `<div style="height:${block.props.height}px;"></div>`;
  }
}

export interface EmailStyleConfig {
  bgColor: string;
  contentBg: string;
  fontFamily: string;
}

const defaultStyle: EmailStyleConfig = {
  bgColor: '#f4f4f5',
  contentBg: '#ffffff',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export function blocksToHtml(blocks: EmailBlock[], style: Partial<EmailStyleConfig> = {}): string {
  const s = { ...defaultStyle, ...style };
  const body = blocks.map(renderBlock).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Email</title>
</head>
<body style="margin:0;padding:0;background-color:${s.bgColor};font-family:${s.fontFamily};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${s.bgColor};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${s.contentBg};border-radius:8px;">
          <tr>
            <td style="padding:32px 24px;">
${body}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
