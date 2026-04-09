import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { centsToDisplay } from '../lib/utils.js';
import { getInvoice, getInvoiceByToken } from './invoice.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItemRow {
  description: string;
  quantity: string | number;
  unit: string | null;
  unit_price: number;
  amount: number;
}

interface InvoiceData {
  invoice_number: string;
  invoice_date?: string;
  due_date: string;
  status: string;
  currency: string;
  subtotal: number;
  tax_rate: string | null;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  from_name: string | null;
  from_email: string | null;
  from_address: string | null;
  from_logo_url: string | null;
  from_tax_id?: string | null;
  to_name: string | null;
  to_email: string | null;
  to_address: string | null;
  to_tax_id?: string | null;
  payment_terms_days: number;
  payment_instructions: string | null;
  notes: string | null;
  footer_text: string | null;
  terms_text: string | null;
  line_items: LineItemRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const COLOR_PRIMARY = rgb(0.13, 0.27, 0.53); // dark blue
const COLOR_TEXT = rgb(0.15, 0.15, 0.15);
const COLOR_MUTED = rgb(0.45, 0.45, 0.45);
const COLOR_LINE = rgb(0.82, 0.82, 0.82);
const COLOR_BG_ALT = rgb(0.96, 0.96, 0.98);
const COLOR_WHITE = rgb(1, 1, 1);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function drawHorizontalLine(page: PDFPage, y: number) {
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.5,
    color: COLOR_LINE,
  });
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color = COLOR_BG_ALT) {
  page.drawRectangle({
    x,
    y: y - h,
    width: w,
    height: h,
    color,
  });
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

export async function generateInvoicePdf(invoiceId: string, orgId: string): Promise<Uint8Array> {
  const invoice = await getInvoice(invoiceId, orgId);
  return buildPdf(invoice as unknown as InvoiceData);
}

export async function generateInvoicePdfByToken(token: string): Promise<{ pdf: Uint8Array; invoiceNumber: string }> {
  const invoice = await getInvoiceByToken(token);
  // getInvoiceByToken aliases invoice_date as issue_date — normalize for buildPdf
  const normalized: InvoiceData = {
    ...invoice as unknown as InvoiceData,
    invoice_date: (invoice as any).issue_date ?? (invoice as any).invoice_date,
  };
  const pdf = await buildPdf(normalized);
  return { pdf, invoiceNumber: invoice.invoice_number };
}

async function buildPdf(invoice: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${invoice.invoice_number}`);
  doc.setSubject(`Invoice ${invoice.invoice_number}`);
  doc.setProducer('BigBlueBam Bill');
  doc.setCreator('BigBlueBam Bill');

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const currency = invoice.currency ?? 'USD';
  const fmt = (cents: number) => centsToDisplay(cents, currency);

  // -----------------------------------------------------------------------
  // Header: company name + invoice title
  // -----------------------------------------------------------------------

  // Company name (left)
  if (invoice.from_name) {
    page.drawText(invoice.from_name, {
      x: MARGIN_LEFT,
      y,
      size: 18,
      font: fontBold,
      color: COLOR_PRIMARY,
    });
  }

  // "INVOICE" label (right-aligned)
  const invoiceLabel = 'INVOICE';
  const labelWidth = fontBold.widthOfTextAtSize(invoiceLabel, 22);
  page.drawText(invoiceLabel, {
    x: PAGE_WIDTH - MARGIN_RIGHT - labelWidth,
    y,
    size: 22,
    font: fontBold,
    color: COLOR_PRIMARY,
  });

  y -= 18;

  // Company contact info
  const fromLines: string[] = [];
  if (invoice.from_address) fromLines.push(...invoice.from_address.split('\n'));
  if (invoice.from_email) fromLines.push(invoice.from_email);
  if (invoice.from_tax_id) fromLines.push(`Tax ID: ${invoice.from_tax_id}`);

  for (const line of fromLines) {
    page.drawText(line, {
      x: MARGIN_LEFT,
      y,
      size: 9,
      font: fontRegular,
      color: COLOR_MUTED,
    });
    y -= 12;
  }

  y -= 6;

  // -----------------------------------------------------------------------
  // Invoice details block (right side)
  // -----------------------------------------------------------------------

  const detailsStartY = PAGE_HEIGHT - MARGIN_TOP - 22;
  let detY = detailsStartY;
  const detailLabelX = PAGE_WIDTH - MARGIN_RIGHT - 200;
  const detailValueX = PAGE_WIDTH - MARGIN_RIGHT - 90;

  const details: [string, string][] = [
    ['Invoice #:', invoice.invoice_number],
    ['Date:', invoice.invoice_date ?? ''],
    ['Due Date:', invoice.due_date],
    ['Terms:', `Net ${invoice.payment_terms_days}`],
  ];

  // Status badge
  const statusMap: Record<string, string> = {
    draft: 'DRAFT',
    sent: 'SENT',
    viewed: 'VIEWED',
    paid: 'PAID',
    partially_paid: 'PARTIAL',
    overdue: 'OVERDUE',
    void: 'VOID',
    written_off: 'WRITTEN OFF',
  };

  details.push(['Status:', statusMap[invoice.status] ?? invoice.status.toUpperCase()]);

  for (const [label, value] of details) {
    page.drawText(label, {
      x: detailLabelX,
      y: detY,
      size: 9,
      font: fontBold,
      color: COLOR_MUTED,
    });
    page.drawText(value, {
      x: detailValueX,
      y: detY,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    detY -= 14;
  }

  // Ensure y is below both from-address and details block
  y = Math.min(y, detY) - 10;

  drawHorizontalLine(page, y);
  y -= 20;

  // -----------------------------------------------------------------------
  // Bill-To section
  // -----------------------------------------------------------------------

  page.drawText('BILL TO', {
    x: MARGIN_LEFT,
    y,
    size: 9,
    font: fontBold,
    color: COLOR_PRIMARY,
  });
  y -= 14;

  if (invoice.to_name) {
    page.drawText(invoice.to_name, {
      x: MARGIN_LEFT,
      y,
      size: 11,
      font: fontBold,
      color: COLOR_TEXT,
    });
    y -= 14;
  }

  const toLines: string[] = [];
  if (invoice.to_address) toLines.push(...invoice.to_address.split('\n'));
  if (invoice.to_email) toLines.push(invoice.to_email);
  if (invoice.to_tax_id) toLines.push(`Tax ID: ${invoice.to_tax_id}`);

  for (const line of toLines) {
    page.drawText(line, {
      x: MARGIN_LEFT,
      y,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    y -= 12;
  }

  y -= 14;

  // -----------------------------------------------------------------------
  // Line items table
  // -----------------------------------------------------------------------

  // Column layout
  const colDesc = MARGIN_LEFT;
  const colQty = MARGIN_LEFT + CONTENT_WIDTH * 0.50;
  const colUnit = MARGIN_LEFT + CONTENT_WIDTH * 0.60;
  const colPrice = MARGIN_LEFT + CONTENT_WIDTH * 0.72;
  const colAmount = PAGE_WIDTH - MARGIN_RIGHT; // right-aligned

  // Table header
  const headerHeight = 20;
  drawRect(page, MARGIN_LEFT, y, CONTENT_WIDTH, headerHeight, COLOR_PRIMARY);

  const headerY = y - 14;
  const headerFont = fontBold;
  const headerSize = 9;
  const headerColor = COLOR_WHITE;

  page.drawText('Description', { x: colDesc + 6, y: headerY, size: headerSize, font: headerFont, color: headerColor });
  page.drawText('Qty', { x: colQty, y: headerY, size: headerSize, font: headerFont, color: headerColor });
  page.drawText('Unit', { x: colUnit, y: headerY, size: headerSize, font: headerFont, color: headerColor });
  page.drawText('Unit Price', { x: colPrice, y: headerY, size: headerSize, font: headerFont, color: headerColor });

  const amtHeaderText = 'Amount';
  const amtHeaderWidth = headerFont.widthOfTextAtSize(amtHeaderText, headerSize);
  page.drawText(amtHeaderText, { x: colAmount - amtHeaderWidth - 6, y: headerY, size: headerSize, font: headerFont, color: headerColor });

  y -= headerHeight;

  // Table rows
  const rowHeight = 18;
  const descMaxWidth = colQty - colDesc - 12;

  for (let i = 0; i < invoice.line_items.length; i++) {
    const item = invoice.line_items[i]!;
    const descLines = wrapText(item.description, descMaxWidth, fontRegular, 9);
    const thisRowHeight = Math.max(rowHeight, descLines.length * 12 + 6);

    // Check if we need a new page
    if (y - thisRowHeight < MARGIN_BOTTOM + 120) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }

    // Alternating row background
    if (i % 2 === 0) {
      drawRect(page, MARGIN_LEFT, y, CONTENT_WIDTH, thisRowHeight, COLOR_BG_ALT);
    }

    const textY = y - 13;

    // Description (possibly multi-line)
    for (let li = 0; li < descLines.length; li++) {
      page.drawText(descLines[li]!, {
        x: colDesc + 6,
        y: textY - li * 12,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });
    }

    // Quantity
    const qtyStr = String(Number(item.quantity));
    page.drawText(qtyStr, { x: colQty, y: textY, size: 9, font: fontRegular, color: COLOR_TEXT });

    // Unit
    page.drawText(item.unit ?? '', { x: colUnit, y: textY, size: 9, font: fontRegular, color: COLOR_TEXT });

    // Unit price
    page.drawText(fmt(item.unit_price), { x: colPrice, y: textY, size: 9, font: fontRegular, color: COLOR_TEXT });

    // Amount (right-aligned)
    const amtText = fmt(item.amount);
    const amtWidth = fontRegular.widthOfTextAtSize(amtText, 9);
    page.drawText(amtText, { x: colAmount - amtWidth - 6, y: textY, size: 9, font: fontRegular, color: COLOR_TEXT });

    y -= thisRowHeight;
  }

  drawHorizontalLine(page, y);
  y -= 8;

  // -----------------------------------------------------------------------
  // Totals section
  // -----------------------------------------------------------------------

  // Check if we need a new page for totals
  if (y < MARGIN_BOTTOM + 100) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_TOP;
  }

  const totalsLabelX = PAGE_WIDTH - MARGIN_RIGHT - 200;
  const totalsValueX = PAGE_WIDTH - MARGIN_RIGHT;

  const drawTotalRow = (label: string, value: string, bold = false, large = false) => {
    const font = bold ? fontBold : fontRegular;
    const size = large ? 12 : 10;
    const color = bold ? COLOR_PRIMARY : COLOR_TEXT;

    page.drawText(label, {
      x: totalsLabelX,
      y,
      size,
      font,
      color,
    });

    const valWidth = font.widthOfTextAtSize(value, size);
    page.drawText(value, {
      x: totalsValueX - valWidth,
      y,
      size,
      font,
      color,
    });

    y -= large ? 20 : 16;
  };

  drawTotalRow('Subtotal:', fmt(invoice.subtotal));

  const taxRate = Number(invoice.tax_rate ?? 0);
  if (taxRate > 0) {
    drawTotalRow(`Tax (${taxRate}%):`, fmt(invoice.tax_amount));
  }

  if (invoice.discount_amount > 0) {
    drawTotalRow('Discount:', `-${fmt(invoice.discount_amount)}`);
  }

  drawHorizontalLine(page, y + 6);
  y -= 4;

  drawTotalRow('Total:', fmt(invoice.total), true, true);

  if (invoice.amount_paid > 0) {
    drawTotalRow('Amount Paid:', fmt(invoice.amount_paid));
  }

  const amountDue = invoice.total - invoice.amount_paid;
  if (amountDue !== invoice.total) {
    drawTotalRow('Balance Due:', fmt(amountDue), true, true);
  }

  y -= 10;

  // -----------------------------------------------------------------------
  // Payment instructions
  // -----------------------------------------------------------------------

  if (invoice.payment_instructions) {
    if (y < MARGIN_BOTTOM + 80) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }

    drawHorizontalLine(page, y);
    y -= 16;

    page.drawText('PAYMENT INSTRUCTIONS', {
      x: MARGIN_LEFT,
      y,
      size: 9,
      font: fontBold,
      color: COLOR_PRIMARY,
    });
    y -= 14;

    const instrLines = wrapText(invoice.payment_instructions, CONTENT_WIDTH - 10, fontRegular, 9);
    for (const line of instrLines) {
      if (y < MARGIN_BOTTOM) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN_TOP;
      }
      page.drawText(line, {
        x: MARGIN_LEFT,
        y,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });
      y -= 12;
    }

    y -= 6;
  }

  // -----------------------------------------------------------------------
  // Notes (internal notes are NOT shown, but invoice notes/footer are)
  // -----------------------------------------------------------------------

  if (invoice.terms_text) {
    if (y < MARGIN_BOTTOM + 60) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }

    page.drawText('TERMS & CONDITIONS', {
      x: MARGIN_LEFT,
      y,
      size: 9,
      font: fontBold,
      color: COLOR_PRIMARY,
    });
    y -= 14;

    const termsLines = wrapText(invoice.terms_text, CONTENT_WIDTH - 10, fontRegular, 8);
    for (const line of termsLines) {
      if (y < MARGIN_BOTTOM) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN_TOP;
      }
      page.drawText(line, {
        x: MARGIN_LEFT,
        y,
        size: 8,
        font: fontRegular,
        color: COLOR_MUTED,
      });
      y -= 11;
    }
    y -= 6;
  }

  // -----------------------------------------------------------------------
  // Footer
  // -----------------------------------------------------------------------

  if (invoice.footer_text) {
    // Draw footer at the bottom of the last page
    const footerLines = wrapText(invoice.footer_text, CONTENT_WIDTH, fontRegular, 8);
    let footerY = MARGIN_BOTTOM - 10;
    for (const line of footerLines) {
      const lineWidth = fontRegular.widthOfTextAtSize(line, 8);
      page.drawText(line, {
        x: MARGIN_LEFT + (CONTENT_WIDTH - lineWidth) / 2, // centered
        y: footerY,
        size: 8,
        font: fontRegular,
        color: COLOR_MUTED,
      });
      footerY -= 10;
    }
  }

  return doc.save();
}
