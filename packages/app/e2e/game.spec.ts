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
  // An academy career opens inside camp, with its youth friendly visible before the
  // player advances. This is the match the coach uses to evaluate him.
  await expect(page.getByText('Pre-season friendly')).toBeVisible();
  await expectAccessible(page);

  // Settling a blocking approach must consume its notification. Otherwise the player
  // chooses an agent and is then shown the stale "agents want you" premise afterward.
  await page.evaluate(() => {
    const debug = window as unknown as {
      fc: {
        game: {
          getState: () => Record<string, any>;
          setState: (next: Record<string, unknown>) => void;
        };
      };
    };
    const game = debug.fc.game;
    const store = game.getState();
    const state = structuredClone(store.state);
    const agent = {
      id: 'e2e_agent', name: 'Order Test', tier: 'local', connections: 30,
      negotiation: 35, loyalty: 60, greed: 20, careerPlanning: 45,
      internationalNetwork: 10, commissionPct: 0.04, relationship: 50,
      countries: ['ISR'],
    };
    const decisionId = 'agent_e2e_order';
    const messageId = 'msg_e2e_agent_interest';
    state.agentOffers = [agent];
    state.pendingDecisions.push({
      id: decisionId, kind: 'agent', blocking: true, eventId: 'agentApproach',
      category: 'agent', textKey: 'decision.agentApproach', options: [], agents: [agent],
    });
    state.inbox.unshift({
      id: messageId, season: state.world.season, week: state.world.week,
      category: 'agent', titleKey: 'inbox.agentInterest', args: { count: 1 },
      read: false, decisionId,
    });
    game.setState({ state, pendingNews: [messageId] });
    game.getState().answerAgent(decisionId, agent.id);
  });
  await expect.poll(() => page.evaluate(() => {
    const game = (window as unknown as { fc: { game: { getState: () => Record<string, any> } } }).fc.game.getState();
    return {
      agent: game.state.agent?.id,
      queued: game.pendingNews.includes('msg_e2e_agent_interest'),
      read: game.state.inbox.find((message: Record<string, any>) => message.id === 'msg_e2e_agent_interest')?.read,
    };
  })).toEqual({ agent: 'e2e_agent', queued: false, read: true });

  await page.evaluate(() => {
    const game = (window as unknown as {
      fc: { game: { getState: () => Record<string, any>; setState: (next: Record<string, unknown>) => void } };
    }).fc.game;
    const state = structuredClone(game.getState().state);
    const decisionId = 'milestone_e2e_single_window';
    const messageId = 'msg_e2e_media';
    state.pendingDecisions.push({
      id: decisionId, kind: 'event', blocking: true, eventId: 'milestone:debut',
      category: 'media', textKey: 'milestone.debut',
      options: [{ id: 'humble', labelKey: 'milestone.debut.humble', effects: [] }],
    });
    state.inbox.unshift({
      id: messageId, season: state.world.season, week: state.world.week,
      category: 'media', titleKey: 'milestone.debut', read: false, decisionId,
    });
    game.setState({ state, result: null, pendingNews: [messageId] });
    game.getState().decide(decisionId, 'humble');
  });
  await expect.poll(() => page.evaluate(() => {
    const game = (window as unknown as { fc: { game: { getState: () => Record<string, any> } } }).fc.game.getState();
    return {
      secondModal: game.result !== null,
      pending: game.state.pendingDecisions.some((decision: Record<string, any>) => decision.id === 'milestone_e2e_single_window'),
      queued: game.pendingNews.includes('msg_e2e_media'),
    };
  })).toEqual({ secondModal: false, pending: false, queued: false });

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
  const goalSplash = page.locator('.goal-splash');
  await expect(goalSplash).toBeVisible({ timeout: 2_000 });
  await expect.poll(async () => page.evaluate(() => {
    const pitch = document.querySelector('.pitch-wrap')!.getBoundingClientRect();
    const splash = document.querySelector('.goal-splash')!.getBoundingClientRect();
    return splash.top >= pitch.top - 1 && splash.bottom <= pitch.bottom + 1
      && splash.left >= pitch.left - 1 && splash.right <= pitch.right + 1;
  })).toBe(true);
  await expect(replay).toBeVisible({ timeout: 5_000 });
  await expect(replay).toBeHidden({ timeout: 4_000 });
  await page.waitForTimeout(1_000);
  await expect(replay).toBeHidden();

  await page.getByRole('button', { name: 'Skip to the end' }).click();
  const report = page.getByRole('button', { name: 'Match report' });
  await expect(report).toBeVisible();
  await expect.poll(async () => report.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);
});
