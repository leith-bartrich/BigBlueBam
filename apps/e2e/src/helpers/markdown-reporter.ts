import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

interface TestRecord {
  project: string;
  suite: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  duration: number;
  error?: string;
  screenshotDir?: string;
  screenshots: Array<{ step: string; file: string }>;
}

export default class MarkdownReporter implements Reporter {
  private records: TestRecord[] = [];
  private startTime = 0;
  private runTimestamp = '';

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = Date.now();
    const metaPath = path.join(__dirname, '..', '..', 'reports', '.current-run');
    try {
      this.runTimestamp = fs.readFileSync(metaPath, 'utf-8').trim();
    } catch {
      this.runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const projectName = test.parent?.project()?.name || 'unknown';
    if (projectName === 'setup') return;

    const suiteName = this.extractSuiteName(test);
    const testName = this.sanitizeTestName(test.title);
    const screenshotDir = path.join(
      __dirname, '..', '..', 'reports', this.runTimestamp, projectName, testName,
    );

    let screenshots: Array<{ step: string; file: string }> = [];
    const metaFile = path.join(screenshotDir, '_screenshots.json');
    if (fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
        screenshots = meta.map((m: { stepName: string; filePath: string }) => ({
          step: m.stepName,
          file: path.relative(path.join(__dirname, '..', '..', 'reports', this.runTimestamp), m.filePath),
        }));
      } catch {}
    }

    this.records.push({
      project: projectName,
      suite: suiteName,
      title: test.title,
      status: result.status,
      duration: result.duration,
      error: result.errors?.[0]?.message,
      screenshotDir,
      screenshots,
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    try {
      const totalDuration = Date.now() - this.startTime;
      // Re-read .current-run in case onBegin missed it
      if (!this.runTimestamp) {
        const metaPath = path.join(__dirname, '..', '..', 'reports', '.current-run');
        try {
          this.runTimestamp = fs.readFileSync(metaPath, 'utf-8').trim();
        } catch {
          this.runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        }
      }
      const reportPath = path.join(__dirname, '..', '..', 'reports', this.runTimestamp, 'report.md');
      const md = this.generateReport(totalDuration, result.status);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, md);
      console.log(`\n=== Markdown report written to: ${reportPath} ===`);
      console.log(`=== ${this.records.length} test records captured ===\n`);
    } catch (err) {
      console.error('Markdown reporter error:', err);
    }
  }

  private generateReport(totalDuration: number, overallStatus: string): string {
    const lines: string[] = [];
    const date = this.runTimestamp.replace('T', ' ').replace(/-/g, (m, offset) => offset > 9 ? ':' : '-');

    lines.push(`# E2E Test Report — ${date}`);
    lines.push('');
    lines.push(`**Overall Status:** ${overallStatus.toUpperCase()}`);
    lines.push(`**Total Duration:** ${this.formatDuration(totalDuration)}`);
    lines.push('');

    // Summary table
    const projects = [...new Set(this.records.map((r) => r.project))];
    lines.push('## Summary');
    lines.push('');
    lines.push('| App | Passed | Failed | Skipped | Duration |');
    lines.push('|-----|--------|--------|---------|----------|');

    for (const proj of projects) {
      const projRecords = this.records.filter((r) => r.project === proj);
      const passed = projRecords.filter((r) => r.status === 'passed').length;
      const failed = projRecords.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
      const skipped = projRecords.filter((r) => r.status === 'skipped').length;
      const duration = projRecords.reduce((sum, r) => sum + r.duration, 0);
      const failedMark = failed > 0 ? ' ❌' : '';
      lines.push(`| ${proj}${failedMark} | ${passed} | ${failed} | ${skipped} | ${this.formatDuration(duration)} |`);
    }
    lines.push('');

    // Per-app detail
    for (const proj of projects) {
      const projRecords = this.records.filter((r) => r.project === proj);
      const suites = [...new Set(projRecords.map((r) => r.suite))];

      lines.push(`## ${proj}`);
      lines.push('');

      for (const suite of suites) {
        const suiteRecords = projRecords.filter((r) => r.suite === suite);
        lines.push(`### ${suite}`);
        lines.push('');

        for (const rec of suiteRecords) {
          const icon = rec.status === 'passed' ? '✅' : rec.status === 'failed' ? '❌' : '⏭️';
          const screenshotCount = rec.screenshots.length;
          const countLabel = screenshotCount > 0 ? ` (${screenshotCount} screenshots)` : '';
          lines.push(`- ${icon} **${rec.title}**${countLabel} — ${this.formatDuration(rec.duration)}`);

          if (rec.error) {
            lines.push(`  - **Error:** \`${this.truncate(rec.error, 200)}\``);
          }

          for (const ss of rec.screenshots) {
            lines.push(`  - ![${ss.step}](${ss.file})`);
          }

          lines.push('');
        }
      }
    }

    lines.push('---');
    lines.push(`*Generated by @bigbluebam/e2e markdown reporter*`);

    return lines.join('\n');
  }

  private extractSuiteName(test: TestCase): string {
    const parts: string[] = [];
    let parent: typeof test.parent | undefined = test.parent;
    while (parent) {
      if (parent.title && !parent.project()) {
        parts.unshift(parent.title);
      }
      parent = parent.parent;
    }
    return parts.join(' > ') || 'default';
  }

  private sanitizeTestName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private truncate(str: string, maxLen: number): string {
    const oneLine = str.replace(/\n/g, ' ');
    return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}...` : oneLine;
  }
}
