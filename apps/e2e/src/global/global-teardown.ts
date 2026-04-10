export default async function globalTeardown(): Promise<void> {
  console.log('\n=== E2E Global Teardown ===');
  // Teardown is intentionally minimal — test data is left in place
  // for debugging. The next run's global setup will reuse existing users.
  console.log('=== Global Teardown Complete ===\n');
}
