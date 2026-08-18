import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { careerSummary, currentOvr, deserialize, serialize, type CareerState } from '@fc/engine';

/**
 * Cloud save is optional. The game is local-first: everything works with no
 * network and no account. If the two environment variables are absent, the
 * cloud panel simply says so and nothing here ever runs.
 */
const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const anonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

let client: SupabaseClient | null = null;

export function cloudConfigured(): boolean {
  return Boolean(url && anonKey);
}

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured()) return null;
  if (!client) client = createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export async function currentSession(): Promise<Session | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  const sb = supabase();
  if (!sb) return { error: 'not-configured' };
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
}

export interface CloudSaveRow {
  user_id: string;
  career_seed: number;
  player_name: string;
  age: number;
  club_name: string;
  ovr: number;
  season: number;
  career_score: number;
  retired: boolean;
  save: string;
  updated_at: string;
}

/** Push the local save up. The row is keyed by user and career seed. */
export async function pushSave(state: CareerState, clubName: string): Promise<{ error?: string }> {
  const sb = supabase();
  const session = await currentSession();
  if (!sb || !session) return { error: 'not-signed-in' };

  const summary = careerSummary(state);
  const row: Omit<CloudSaveRow, 'updated_at'> = {
    user_id: session.user.id,
    career_seed: state.careerSeed,
    player_name: `${state.player.firstName} ${state.player.lastName}`,
    age: state.world.season - state.player.birthYear,
    club_name: clubName,
    ovr: currentOvr(state),
    season: state.world.season,
    career_score: summary.score,
    retired: state.retired,
    save: serialize(state),
  };

  const { error } = await sb.from('careers').upsert(row, { onConflict: 'user_id,career_seed' });
  return error ? { error: error.message } : {};
}

/** Pull the most recently updated cloud save for this account. */
export async function pullLatestSave(): Promise<{ state?: CareerState; error?: string }> {
  const sb = supabase();
  const session = await currentSession();
  if (!sb || !session) return { error: 'not-signed-in' };

  const { data, error } = await sb
    .from('careers')
    .select('save, updated_at')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) return { error: error.message };
  const raw = data?.[0]?.save as string | undefined;
  if (!raw) return { error: 'no-cloud-save' };
  return { state: deserialize(raw) };
}

export interface LeaderboardRow {
  player_name: string;
  club_name: string;
  ovr: number;
  career_score: number;
  retired: boolean;
  season: number;
}

export async function leaderboard(limit = 20): Promise<LeaderboardRow[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('leaderboard')
    .select('player_name, club_name, ovr, career_score, retired, season')
    .order('career_score', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as LeaderboardRow[];
}
