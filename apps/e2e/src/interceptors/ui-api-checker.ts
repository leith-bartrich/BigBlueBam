import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { DirectApiClient } from '../api/api-client';

export interface ListCheckConfig {
  apiPath: string;
  containerSelector?: string;
  itemTextExtractor: (item: Record<string, unknown>) => string;
  params?: Record<string, string>;
}

export interface DetailCheckConfig {
  apiPath: string;
  fieldMappings: Array<{
    apiField: string;
    locator: Locator;
    transform?: (value: unknown) => string;
  }>;
}

export interface AgreementResult {
  passed: boolean;
  mismatches: Array<{
    type: 'missing-in-ui' | 'missing-in-api' | 'value-mismatch';
    field?: string;
    apiValue?: string;
    uiValue?: string;
  }>;
}

export class UiApiChecker {
  constructor(
    private page: Page,
    private apiClient: DirectApiClient,
  ) {}

  async checkListRendering(config: ListCheckConfig): Promise<AgreementResult> {
    const apiData = await this.apiClient.get<Array<Record<string, unknown>>>(config.apiPath, config.params);
    const mismatches: AgreementResult['mismatches'] = [];

    const items = Array.isArray(apiData) ? apiData : (apiData as any)?.items || [];

    for (const item of items) {
      const text = config.itemTextExtractor(item);
      if (!text) continue;

      const container = config.containerSelector
        ? this.page.locator(config.containerSelector)
        : this.page;

      const visible = await container.getByText(text, { exact: false }).first().isVisible().catch(() => false);
      if (!visible) {
        mismatches.push({
          type: 'missing-in-ui',
          apiValue: text,
        });
      }
    }

    return {
      passed: mismatches.length === 0,
      mismatches,
    };
  }

  async checkDetailRendering(config: DetailCheckConfig): Promise<AgreementResult> {
    const apiData = await this.apiClient.get<Record<string, unknown>>(config.apiPath);
    const mismatches: AgreementResult['mismatches'] = [];

    for (const mapping of config.fieldMappings) {
      const apiValue = this.getNestedValue(apiData, mapping.apiField);
      const displayValue = mapping.transform ? mapping.transform(apiValue) : String(apiValue ?? '');

      const uiText = await mapping.locator.textContent().catch(() => null);
      if (uiText === null) {
        mismatches.push({
          type: 'missing-in-ui',
          field: mapping.apiField,
          apiValue: displayValue,
        });
        continue;
      }

      if (!uiText.includes(displayValue)) {
        mismatches.push({
          type: 'value-mismatch',
          field: mapping.apiField,
          apiValue: displayValue,
          uiValue: uiText,
        });
      }
    }

    return {
      passed: mismatches.length === 0,
      mismatches,
    };
  }

  async assertListAgreement(config: ListCheckConfig): Promise<void> {
    const result = await this.checkListRendering(config);
    if (!result.passed) {
      const details = result.mismatches
        .map((m) => `  ${m.type}: ${m.field || ''} api="${m.apiValue}" ui="${m.uiValue || 'N/A'}"`)
        .join('\n');
      throw new Error(`UI-API agreement check failed:\n${details}`);
    }
  }

  async assertDetailAgreement(config: DetailCheckConfig): Promise<void> {
    const result = await this.checkDetailRendering(config);
    if (!result.passed) {
      const details = result.mismatches
        .map((m) => `  ${m.type}: ${m.field || ''} api="${m.apiValue}" ui="${m.uiValue || 'N/A'}"`)
        .join('\n');
      throw new Error(`UI-API agreement check failed:\n${details}`);
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
      return undefined;
    }, obj);
  }
}
