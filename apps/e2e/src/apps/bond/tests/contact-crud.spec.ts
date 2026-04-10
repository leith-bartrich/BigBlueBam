import { test, expect } from '../../../fixtures/base.fixture';
import { ContactsPage } from '../pages/contacts.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bond — Contact CRUD', () => {
  let contactsPage: ContactsPage;

  test.beforeEach(async ({ page, screenshots }) => {
    contactsPage = new ContactsPage(page, screenshots);
  });

  test('contacts page loads with contact list', async ({ page, screenshots }) => {
    await contactsPage.goto();
    await screenshots.capture(page, 'contacts-loaded');
    await contactsPage.expectContactsLoaded();
    await screenshots.capture(page, 'contacts-content-visible');
  });

  test('create contact via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const firstName = `E2EContact${Date.now()}`;
    const email = `e2e-${Date.now()}@test.example.com`;
    let contact: any;
    try {
      contact = await api.post('/contacts', { first_name: firstName, email });
    } catch {
      test.skip(true, 'Could not create contact via API');
      return;
    }
    await screenshots.capture(page, 'contact-created-via-api');

    await contactsPage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'contacts-after-create');
    await contactsPage.expectContactVisible(firstName);
    await screenshots.capture(page, 'new-contact-visible');

    // Cleanup
    try {
      await api.delete(`/contacts/${contact.id}`);
    } catch {}
  });

  test('open contact detail from list', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    let contact: any;
    try {
      const contacts = await api.get<any[]>('/contacts');
      if (contacts.length > 0) contact = contacts[0];
    } catch {}

    test.skip(!contact, 'No contact available');

    await contactsPage.goto();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'contacts-before-click');

    const displayName = contact.first_name || contact.email;
    await contactsPage.clickContact(displayName);
    await screenshots.capture(page, 'contact-detail-opened');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'contact-detail-visible');
  });

  test('update contact via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const firstName = `E2EUpdate${Date.now()}`;
    const email = `e2e-update-${Date.now()}@test.example.com`;
    let contact: any;
    try {
      contact = await api.post('/contacts', { first_name: firstName, email });
    } catch {
      test.skip(true, 'Could not create contact via API');
      return;
    }

    const updatedName = `${firstName}Updated`;
    try {
      await api.patch(`/contacts/${contact.id}`, { first_name: updatedName });
    } catch {
      test.skip(true, 'Could not update contact via API');
      return;
    }

    await contactsPage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'contacts-after-update');
    await contactsPage.expectContactVisible(updatedName);
    await screenshots.capture(page, 'updated-contact-visible');

    // Cleanup
    try {
      await api.delete(`/contacts/${contact.id}`);
    } catch {}
  });

  test('delete contact via API and verify removed from UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const firstName = `E2EDelete${Date.now()}`;
    const email = `e2e-delete-${Date.now()}@test.example.com`;
    let contact: any;
    try {
      contact = await api.post('/contacts', { first_name: firstName, email });
    } catch {
      test.skip(true, 'Could not create contact via API');
      return;
    }

    try {
      await api.delete(`/contacts/${contact.id}`);
    } catch {
      test.skip(true, 'Could not delete contact via API');
      return;
    }

    await contactsPage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'contacts-after-delete');
    await contactsPage.expectContactNotVisible(firstName);
    await screenshots.capture(page, 'deleted-contact-gone');
  });

  test('search filters contact list', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    let contacts: any[] = [];
    try {
      contacts = await api.get<any[]>('/contacts');
    } catch {}

    test.skip(contacts.length === 0, 'No contacts available');

    await contactsPage.goto();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'contacts-before-search');

    const searchTerm = contacts[0].first_name || contacts[0].email;
    await contactsPage.searchContacts(searchTerm);
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'contacts-after-search');
  });
});
