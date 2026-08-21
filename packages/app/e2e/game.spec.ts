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

test('shows one slow-motion goal replay and removes its label before play resumes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Replay');
  await page.getByLabel('Last name').fill('Test');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  await page.evaluate(() => {
    const debug = window as unknown as {
      fc: {
        game: {
          getState: () => { state: Record<string, any> };
          setState: (next: Record<string, unknown>) => void;
        };
      };
    };
    const game = debug.fc.game;
    const state = structuredClone(game.getState().state);
    const player = state.player;
    const homeClubId = player.clubId as string;
    const awayClubId = Object.keys(state.world.clubs).find((id) => id !== homeClubId) as string;
    const match = {
      id: 'e2e_replay_match',
      season: state.world.season,
      week: state.world.week,
      competitionId: 'friendly',
      homeClubId,
      awayClubId,
      homeGoals: 1,
      awayGoals: 0,
      detailLevel: 1,
      importance: 'friendly',
      userLine: {
        played: true,
        started: true,
        minutes: 90,
        position: player.primaryPos,
        goals: 1,
        assists: 0,
        shots: 1,
        keyPasses: 0,
        tackles: 0,
        saves: 0,
        yellow: 0,
        red: 0,
        rating: 7.5,
        motm: true,
      },
      events: [
        {
          minute: 0,
          type: 'goal',
          playerId: player.id,
          byUser: true,
          detailKey: 'match.event.userGoal',
          score: [1, 0],
        },
        {
          minute: 1,
          type: 'chance',
          byUser: false,
          detailKey: 'match.live.buildUp',
        },
      ],
    };
    state.lastMatch = match;
    state.matchLog = [match, ...state.matchLog];
    game.setState({
      state,
      screen: 'match',
      focusMatchId: match.id,
      liveMatchId: match.id,
      liveFromMinute: 0,
    });
  });

  const replay = page.locator('.pitch-replay');
  await expect(replay).toBeVisible({ timeout: 5_000 });
  await expect(replay).toBeHidden({ timeout: 4_000 });
  await page.waitForTimeout(1_000);
  await expect(replay).toBeHidden();
});
