import type { Page, TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

interface ScreenshotMeta {
  stepNumber: number;
  stepName: string;
  timestamp: string;
  filePath: string;
  testTitle: string;
  projectName: string;
}

export class ScreenshotCollector {
  private stepCounter = 0;
  private metadata: ScreenshotMeta[] = [];
  private outputDir: string;

  constructor(
    private defaultPage: Page,
    private testInfo: TestInfo,
  ) {
    const runTimestamp = this.getCurrentRunTimestamp();
    const projectName = testInfo.project.name;
    const testName = this.sanitizeTestName(testInfo.title);
    this.outputDir = path.join(__dirname, '..', '..', 'reports', runTimestamp, projectName, testName);
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async capture(page: Page | null, stepName: string): Promise<string> {
    const target = page || this.defaultPage;
    this.stepCounter++;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const paddedStep = String(this.stepCounter).padStart(2, '0');
    const safeName = this.sanitizeName(stepName);
    const filename = `${paddedStep}-${safeName}_${timestamp}.png`;
    const filePath = path.join(this.outputDir, filename);

    await target.screenshot({ path: filePath, fullPage: false });

    const meta: ScreenshotMeta = {
      stepNumber: this.stepCounter,
      stepName,
      timestamp,
      filePath,
      testTitle: this.testInfo.title,
      projectName: this.testInfo.project.name,
    };
    this.metadata.push(meta);

    // Also write metadata JSON for the report generator
    const metaPath = path.join(this.outputDir, '_screenshots.json');
    fs.writeFileSync(metaPath, JSON.stringify(this.metadata, null, 2));

    return filePath;
  }

  getMetadata(): ScreenshotMeta[] {
    return [...this.metadata];
  }

  getOutputDir(): string {
    return this.outputDir;
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  private sanitizeTestName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  private getCurrentRunTimestamp(): string {
    const metaPath = path.join(__dirname, '..', '..', 'reports', '.current-run');
    try {
      return fs.readFileSync(metaPath, 'utf-8').trim();
    } catch {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      fs.mkdirSync(path.dirname(metaPath), { recursive: true });
      fs.writeFileSync(metaPath, ts);
      return ts;
    }
  }
}
