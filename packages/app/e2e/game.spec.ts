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
  // Camp is six friendlies, two a week, and all of them are on the card before a ball
  // is kicked - not a counter that only fills in afterwards.
  await expect(page.getByText('Training camp assessment')).toBeVisible();
  await expect(page.getByText('To come')).toHaveCount(6);
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
    game.setState({ state, result: null, resultDecision: null, pendingNews: [messageId] });
  });

  const interview = page.getByRole('dialog', {
    name: 'A reporter catches you in the tunnel after your first one. "What is going through your head?"',
  });
  await expect(interview).toBeVisible();
  await interview.locator('.option').first().click();
  // The question remains the dialog identity while its answer buttons become the exact
  // before/after impact. There is one interaction, not a hidden result or a new generic
  // summary popup.
  await expect(interview).toBeVisible();
  await expect(interview.getByText('What that did')).toBeVisible();
  await expect(interview.getByRole('listitem').filter({ hasText: 'Manager trust' })).toContainText('+5');
  await expect(interview.getByRole('button', { name: 'Got it' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => {
    const game = (window as unknown as { fc: { game: { getState: () => Record<string, any> } } }).fc.game.getState();
    return {
      impactVisible: game.result !== null,
      sameInteraction: game.resultDecision?.id,
      pending: game.state.pendingDecisions.some((decision: Record<string, any>) => decision.id === 'milestone_e2e_single_window'),
      queued: game.pendingNews.includes('msg_e2e_media'),
    };
  })).toEqual({
    impactVisible: true,
    sameInteraction: 'milestone_e2e_single_window',
    pending: false,
    queued: false,
  });
  await expectAccessible(page);
  await interview.getByRole('button', { name: 'Got it' }).click();

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

test('applies a coach camp assignment and opens the selected training focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Camp');
  await page.getByLabel('Last name').fill('Action');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  await page.evaluate(() => {
    const game = (window as unknown as {
      fc: { game: { getState: () => Record<string, any>; setState: (next: Record<string, unknown>) => void } };
    }).fc.game;
    const state = structuredClone(game.getState().state);
    const messageId = 'msg_e2e_camp_action';
    state.flags[`campRecommendedFocus:${state.world.season}`] = 'physical';
    state.inbox.unshift({
      id: messageId, season: state.world.season, week: state.world.week,
      category: 'manager', titleKey: 'inbox.trainingCampFeedback.1', read: true,
      args: {
        rating: '7.2', strength: 'skill.technique', weakness: 'skill.physical',
        focus: 'train.focus.physical',
      },
      action: { type: 'setTrainingFocus', focus: 'physical' },
    });
    const player = state.player;
    const homeClubId = player.clubId as string;
    const awayClubId = Object.keys(state.world.clubs).find((id) => id !== homeClubId) as string;
    const match = {
      id: 'e2e_camp_report', season: state.world.season, week: state.world.week,
      competitionId: 'friendly.youth', homeClubId, awayClubId,
      homeGoals: 1, awayGoals: 0, detailLevel: 1, importance: 'friendly',
      userLine: {
        played: true, started: true, minutes: 90, position: player.primaryPos,
        goals: 1, assists: 0, shots: 2, keyPasses: 1, tackles: 0, saves: 0,
        yellow: 0, red: 0, rating: 7.2, motm: false,
      },
      events: [],
    };
    state.lastMatch = match;
    state.matchLog = [match, ...state.matchLog];
    game.setState({
      state, pendingNews: [], screen: 'match', focusMatchId: match.id,
      liveMatchId: null, liveFromMinute: 0,
    });
  });

  await expect(page.getByText('The coach reviews your first audition:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Apply plan and open training' }).click();
  await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Physical' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Coach assignment')).toBeVisible();
  await expectAccessible(page);
});

test('opens a played camp friendly from the camp card', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Camp');
  await page.getByLabel('Last name').fill('Report');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  // The first friendly of the camp, played. The card has to show its score in place of
  // "to come" and open that match's report when it is pressed.
  await page.evaluate(() => {
    const game = (window as unknown as {
      fc: { game: { getState: () => Record<string, any>; setState: (next: Record<string, unknown>) => void } };
    }).fc.game;
    const state = structuredClone(game.getState().state);
    const player = state.player;
    const homeClubId = player.clubId as string;
    const awayClubId = state.flags[`campOpponent:${state.world.season}:1:a`] as string;
    const match = {
      id: 'e2e_camp_first', season: state.world.season, week: 1,
      competitionId: 'friendly.youth', homeClubId, awayClubId,
      homeGoals: 3, awayGoals: 1, detailLevel: 1, importance: 'friendly',
      userLine: {
        played: true, started: true, minutes: 90, position: player.primaryPos,
        goals: 2, assists: 0, shots: 3, keyPasses: 1, tackles: 0, saves: 0,
        yellow: 0, red: 0, rating: 8.1, motm: true,
      },
      events: [],
    };
    state.matchLog = [match, ...state.matchLog];
    game.setState({ state, pendingNews: [], screen: 'hub' });
  });

  await expect(page.getByText('To come')).toHaveCount(5);
  await expect(page.getByText('3–1')).toBeVisible();
  await page.getByRole('button', { name: /3–1/ }).click();
  await expect(page.getByText('Pre-season friendly').first()).toBeVisible();
  await expect(page.getByText('Man of the match')).toBeVisible();
  await expectAccessible(page);
});

test('shows a penalty announcement on the pitch before the kick', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Penalty');
  await page.getByLabel('Last name').fill('Test');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  await page.evaluate(() => {
    const game = (window as unknown as {
      fc: { game: { getState: () => Record<string, any>; setState: (next: Record<string, unknown>) => void } };
    }).fc.game;
    const state = structuredClone(game.getState().state);
    const player = state.player;
    const homeClubId = player.clubId as string;
    const awayClubId = Object.keys(state.world.clubs).find((id) => id !== homeClubId) as string;
    const match = {
      id: 'e2e_penalty_match', season: state.world.season, week: state.world.week,
      competitionId: 'friendly', homeClubId, awayClubId, homeGoals: 0, awayGoals: 0,
      detailLevel: 1, importance: 'friendly',
      userLine: {
        played: true, started: true, minutes: 90, position: player.primaryPos,
        goals: 0, assists: 0, shots: 0, keyPasses: 0, tackles: 0, saves: 0,
        yellow: 0, red: 0, rating: 6.5, motm: false,
      },
      events: [{
        minute: 0, type: 'penaltyAwarded', byUser: false, forUserTeam: true,
        detailKey: 'match.event.penaltyFor',
      }],
    };
    state.lastMatch = match;
    state.matchLog = [match, ...state.matchLog];
    game.setState({
      state, screen: 'match', focusMatchId: match.id, liveMatchId: match.id, liveFromMinute: 0,
    });
  });

  const incident = page.locator('.incident-splash');
  await expect(page.getByText('PENALTY FOR US')).toBeVisible({ timeout: 2_000 });
  await expect.poll(async () => page.evaluate(() => {
    const pitch = document.querySelector('.pitch-wrap')!.getBoundingClientRect();
    const overlay = document.querySelector('.incident-splash')!.getBoundingClientRect();
    return overlay.top >= pitch.top - 1 && overlay.bottom <= pitch.bottom + 1
      && overlay.left >= pitch.left - 1 && overlay.right <= pitch.right + 1;
  })).toBe(true);
  await expect(incident).toBeVisible();
});

test('shows one named card animation and applies live player instructions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Live');
  await page.getByLabel('Last name').fill('Player');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  await page.evaluate(() => {
    const game = (window as unknown as {
      fc: { game: { getState: () => Record<string, any>; setState: (next: Record<string, unknown>) => void } };
    }).fc.game;
    const state = structuredClone(game.getState().state);
    const player = state.player;
    const homeClubId = player.clubId as string;
    const awayClubId = Object.keys(state.world.clubs).find((id) => id !== homeClubId) as string;
    const match = {
      id: 'e2e_live_instruction', season: state.world.season, week: state.world.week,
      competitionId: 'friendly', homeClubId, awayClubId, homeGoals: 0, awayGoals: 0,
      detailLevel: 1, importance: 'friendly',
      userLine: {
        played: true, started: true, minutes: 90, position: 'ST',
        goals: 0, assists: 0, shots: 0, keyPasses: 0, tackles: 0, saves: 0,
        yellow: 1, red: 0, rating: 6.5, motm: false,
      },
      events: [{
        minute: 0, type: 'yellow', playerId: player.id, byUser: true,
        forUserTeam: true, detailKey: 'match.event.yellow',
      }],
    };
    state.lastMatch = match;
    state.matchLog = [match, ...state.matchLog];
    game.setState({
      state, screen: 'match', focusMatchId: match.id, liveMatchId: match.id, liveFromMinute: 0,
    });
  });

  await page.getByRole('button', { name: 'Pause' }).click();
  const card = page.locator('.incident-splash');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('YELLOW CARD');
  await expect(card).toContainText('Live Player');
  await expect(page.locator('.live-row').filter({ hasText: 'Booked.' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Instructions' }).click();
  await page.getByRole('button', { name: 'Shoot from distance' }).click();
  await expect.poll(() => page.evaluate(() => {
    const game = (window as unknown as { fc: { game: { getState: () => Record<string, any> } } }).fc.game.getState();
    const match = game.state.matchLog.find((entry: Record<string, any>) => entry.id === 'e2e_live_instruction');
    return {
      shots: match.userLine.shots,
      instruction: match.instructionChanges?.[0]?.instruction,
      response: match.events.some((event: Record<string, any>) =>
        event.detailKey === 'match.live.instruction.shootFromDistance'),
    };
  })).toEqual({ shots: 1, instruction: 'shootFromDistance', response: true });
  await expect(page.getByText('Active instruction')).toBeVisible();
  await expect(page.getByText('Shoot from distance', { exact: true })).toBeVisible();
});

test('shows the player’s real first-half statistics in the dressing room', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Half');
  await page.getByLabel('Last name').fill('Time');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  await page.evaluate(() => {
    const game = (window as unknown as {
      fc: { game: { getState: () => Record<string, any>; setState: (next: Record<string, unknown>) => void } };
    }).fc.game;
    const state = structuredClone(game.getState().state);
    const player = state.player;
    const homeClubId = player.clubId as string;
    const awayClubId = Object.keys(state.world.clubs).find((id) => id !== homeClubId) as string;
    state.pendingHalfTime = {
      matchId: 'e2e_half_stats', competitionId: 'friendly.youth', homeClubId, awayClubId,
      importance: 'friendly', matchSeed: 77, lineup: {},
      minutes: { played: true, started: true, minutes: 90, slot: 'ST' },
      score: [2, 0], rating: 7.4, demand: null,
      options: ['shootFromDistance', 'passMore'],
      firstHalfEvents: [
        { minute: 4, type: 'goal', byUser: false, detailKey: 'match.event.teamGoal', score: [1, 0] },
        { minute: 4, type: 'assist', playerId: player.id, byUser: true, detailKey: 'match.event.assist' },
        { minute: 10, type: 'goal', playerId: player.id, byUser: true, detailKey: 'match.event.userGoal', score: [2, 0] },
        { minute: 16, type: 'save', playerId: player.id, byUser: true, detailKey: 'match.event.userSaved' },
        { minute: 22, type: 'blockedShot', playerId: player.id, byUser: true, detailKey: 'match.event.userBlocked' },
        { minute: 28, type: 'keyPass', playerId: player.id, byUser: true, detailKey: 'match.event.userKeyPass' },
        { minute: 34, type: 'tackle', playerId: player.id, byUser: true, detailKey: 'match.event.userTackle' },
        { minute: 39, type: 'yellow', playerId: player.id, byUser: true, detailKey: 'match.event.yellow' },
      ],
    };
    game.setState({ state, screen: 'match', focusMatchId: null, liveMatchId: null, liveFromMinute: 0 });
  });

  await page.getByRole('button', { name: 'Skip to the end' }).click();
  await page.getByRole('button', { name: 'To the dressing room' }).click();
  const stats = page.getByLabel('Your first-half stats');
  await expect(stats).toBeVisible();
  await expect(stats.locator('.stat-value')).toHaveText(['1', '1', '3', '1', '1', '0', '1/0']);
  await expectAccessible(page);
});

test('separates friendlies and exposes only official competitions the player appeared in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('Stats');
  await page.getByLabel('Last name').fill('Filter');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  await page.evaluate(() => {
    const game = (window as unknown as {
      fc: { game: { getState: () => Record<string, any>; setState: (next: Record<string, unknown>) => void } };
    }).fc.game;
    const state = structuredClone(game.getState().state);
    const clubId = state.player.clubId as string;
    const opponents = Object.keys(state.world.clubs).filter((id) => id !== clubId);
    const line = (goals: number, assists: number, rating: number) => ({
      played: true, started: true, minutes: 90, position: state.player.primaryPos,
      goals, assists, shots: goals + 2, keyPasses: assists + 1, tackles: 1, saves: 0,
      yellow: 0, red: 0, rating, motm: rating >= 8.5,
    });
    const base = { season: state.world.season, detailLevel: 1 };
    state.matchLog = [
      {
        ...base, id: 'stats_national', week: 13, competitionId: 'national.qualifier',
        homeClubId: 'ISR', awayClubId: 'ENG', homeGoals: 2, awayGoals: 1,
        userClubId: 'ISR', userLine: line(1, 0, 8.2),
      },
      {
        ...base, id: 'stats_cup', week: 12, competitionId: `${clubId.slice(0, 3)}_cup`,
        homeClubId: clubId, awayClubId: opponents[0], homeGoals: 1, awayGoals: 0,
        userClubId: clubId, userLine: line(0, 1, 7.4),
      },
      {
        ...base, id: 'stats_league', week: 11,
        competitionId: state.world.clubs[clubId].competitionId,
        homeClubId: clubId, awayClubId: opponents[1], homeGoals: 3, awayGoals: 1,
        userClubId: clubId, userLine: line(2, 0, 8.8),
      },
      {
        ...base, id: 'stats_friendly', week: 5, competitionId: 'friendly',
        homeClubId: clubId, awayClubId: opponents[2], homeGoals: 0, awayGoals: 0,
        userClubId: clubId, userLine: line(0, 0, 6.5),
      },
    ];
    game.setState({ state, screen: 'matches' });
  });

  await expect(page.getByRole('button', { name: 'Official matches' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Friendlies' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'League', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cup', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'National team', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Europe', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'National team', exact: true }).click();
  await expect(page.getByText('England', { exact: true })).toBeVisible();
  await expect(page.getByText('International qualifier')).toBeVisible();

  await page.getByRole('button', { name: 'Friendlies' }).click();
  await expect(page.getByRole('button', { name: 'National team', exact: true })).toHaveCount(0);
  await expect(page.getByText('Pre-season friendly')).toBeVisible();
  await expectAccessible(page);
});

test('opens a national call-up match live with country names and player instructions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'New career' }).click();
  await page.getByLabel('First name').fill('National');
  await page.getByLabel('Last name').fill('Player');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'Sign here' }).first().click();

  await page.evaluate(() => {
    const game = (window as unknown as {
      fc: { game: { getState: () => Record<string, any>; setState: (next: Record<string, unknown>) => void } };
    }).fc.game;
    const state = structuredClone(game.getState().state);
    const player = state.player;
    const match = {
      id: 'e2e_national_live', season: state.world.season, week: 13,
      competitionId: 'national.qualifier', homeClubId: 'ISR', awayClubId: 'ENG',
      homeGoals: 1, awayGoals: 0, detailLevel: 1, userClubId: 'ISR', importance: 'normal',
      userLine: {
        played: true, started: true, minutes: 90, position: 'CAM',
        goals: 0, assists: 1, shots: 1, keyPasses: 2, tackles: 1, saves: 0,
        yellow: 0, red: 0, rating: 7.4, motm: false,
      },
      events: [
        { minute: 0, type: 'kickOff', byUser: false, ambient: true, detailKey: 'match.live.kickOff' },
        { minute: 55, type: 'goal', byUser: false, forUserTeam: true, detailKey: 'match.event.teamGoal', score: [1, 0] },
        { minute: 90, type: 'fullTime', byUser: false, ambient: true, detailKey: 'match.live.fullTime' },
      ],
    };
    state.flags.e2eNationalTrust = state.managerTrust;
    state.lastMatch = match;
    state.matchLog = [match, ...state.matchLog];
    game.setState({
      state, screen: 'match', focusMatchId: match.id, liveMatchId: match.id, liveFromMinute: 0,
    });
  });

  const board = page.locator('.live-board');
  await expect(board.getByText('Israel', { exact: true })).toBeVisible();
  await expect(board.getByText('England', { exact: true })).toBeVisible();
  await expect(page.getByText('International qualifier', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Instructions' }).click();
  await page.getByRole('button', { name: 'Pass more' }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as {
      fc: { game: { getState: () => Record<string, any> } };
    }).fc.game.getState().state;
    const match = state.matchLog.find((entry: Record<string, any>) => entry.id === 'e2e_national_live');
    return {
      instruction: match.instructionChanges?.[0]?.instruction,
      trustUnchanged: state.managerTrust === state.flags.e2eNationalTrust,
    };
  })).toEqual({ instruction: 'passMore', trustUnchanged: true });
  await expectAccessible(page);
});
