import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectAccessible(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze();
  const message = result.violations.map((violation) =>
    `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(' ')).join('\n')}`,
  ).join('\n');
  expect(result.violations, message).toEqual([]);
}

test('creates a career through the real UI with no automated accessibility violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'New career' })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Haim');
  await page.getByLabel('Last name').fill('Yegudis');
  await expectAccessible(page);

  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign here' }).first()).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Sign here' }).first().click();
  await expect(page.getByText('Haim Yegudis')).toBeVisible();
  await expectAccessible(page);

  await page.evaluate(async () => {
    const debug = window as unknown as { fc: { game: { getState: () => { save: () => Promise<void> } } } };
    await debug.fc.game.getState().save();
  });
  await page.reload();
  await expect(page.getByText('Haim Yegudis')).toBeVisible();
  await expectAccessible(page);
});

test('modal sheets trap focus and dismiss with Escape when safe', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Test');
  await page.getByLabel('Last name').fill('Player');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  await page.getByRole('button', { name: 'More', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'More' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
