import { test, expect } from '../../../fixtures/base.fixture';
import { ContactsPage } from '../pages/contacts.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bond — Company CRUD', () => {
  let contactsPage: ContactsPage;

  test.beforeEach(async ({ page, screenshots }) => {
    contactsPage = new ContactsPage(page, screenshots);
  });

  test('companies page loads', async ({ page, screenshots }) => {
    await contactsPage.goto();
    await contactsPage.navigateToCompanies();
    await screenshots.capture(page, 'companies-loaded');
    await contactsPage.expectPath('/companies');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'companies-content-visible');
  });

  test('create company via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const companyName = `E2E Company ${Date.now()}`;
    const company = await api.post<any>('/v1/companies', { name: companyName });
    await screenshots.capture(page, 'company-created-via-api');

    await contactsPage.goto();
    await contactsPage.navigateToCompanies();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'companies-after-create');

    await expect(page.getByText(companyName, { exact: false }).first()).toBeVisible();
    await screenshots.capture(page, 'new-company-visible');

    // Cleanup
    try {
      await api.delete(`/v1/companies/${company.id}`);
    } catch {}
  });

  test('open company detail from list', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    let company: any;
    try {
      const companies = await api.get<any[]>('/v1/companies');
      if (companies.length > 0) company = companies[0];
    } catch {}

    test.skip(!company, 'No company available');

    await contactsPage.goto();
    await contactsPage.navigateToCompanies();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'companies-before-click');

    await page.getByText(company.name, { exact: false }).first().click();
    await contactsPage.waitForAppReady();
    await screenshots.capture(page, 'company-detail-opened');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'company-detail-visible');
  });

  test('update company name via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const companyName = `E2E Company Update ${Date.now()}`;
    const company = await api.post<any>('/v1/companies', { name: companyName });

    const updatedName = `${companyName} Updated`;
    await api.patch(`/v1/companies/${company.id}`, { name: updatedName });

    await contactsPage.goto();
    await contactsPage.navigateToCompanies();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'companies-after-rename');

    await expect(page.getByText(updatedName, { exact: false }).first()).toBeVisible();
    await screenshots.capture(page, 'renamed-company-visible');

    // Cleanup
    try {
      await api.delete(`/v1/companies/${company.id}`);
    } catch {}
  });

  test('delete company via API and verify removed from UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const companyName = `E2E Company Delete ${Date.now()}`;
    const company = await api.post<any>('/v1/companies', { name: companyName });

    await api.delete(`/v1/companies/${company.id}`);

    await contactsPage.goto();
    await contactsPage.navigateToCompanies();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'companies-after-delete');

    await expect(page.getByText(companyName, { exact: false })).not.toBeVisible();
    await screenshots.capture(page, 'deleted-company-gone');
  });
});
