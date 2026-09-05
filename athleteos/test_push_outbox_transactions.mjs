import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Ce test est réservé à Supabase local.');
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const clients = [], authIds = [], userIds = [], athleteIds = [], messageIds = [], sessionIds = [];
let club;
async function insert(table, payload, client = admin) {
  const result = await client.from(table).insert(payload).select().single();
  if (result.error) throw result.error;
  return result.data;
}
async function account(role) {
  const email = `outbox-${role}-${Date.now()}@example.invalid`, password = 'Local-only-test-2026!';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  authIds.push(data.user.id);
  const user = await insert('users', { club_id: club.id, role, email, auth_uid: data.user.id, name: role });
  userIds.push(user.id);
  const client = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, options);
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  clients.push(client);
  return { user, client };
}
async function events(kind) {
  const result = await admin.from('push_event_outbox').select('*').eq('club_id', club.id).eq('event_type', kind);
  if (result.error) throw result.error;
  return result.data;
}
try {
  club = await insert('clubs', { name: `Outbox local ${Date.now()}` });
  const coach = await account('head_coach'), athlete = await account('athlete');
  const person = await insert('athletes', { club_id: club.id, user_id: athlete.user.id, name: 'Alice' }); athleteIds.push(person.id);
  const teammate = await insert('athletes', { club_id: club.id, name: 'Teammate' }); athleteIds.push(teammate.id);
  let resolveIncoming;
  const received = new Promise(resolve => { resolveIncoming = resolve; });
  const channel = athlete.client.channel(`outbox-realtime-${Date.now()}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${athlete.user.id}` }, payload => resolveIncoming(payload.new));
  await new Promise((resolve, reject) => {
    // SUBSCRIBED confirme le canal WebSocket, pas forcément la réplication
    // Postgres lors du démarrage à froid de l'instance locale.
    const timeout = setTimeout(() => reject(new Error('Realtime replication readiness timeout')), 30000);
    channel.on('system', {}, payload => {
      if (payload.extension === 'postgres_changes' && payload.status === 'ok') { clearTimeout(timeout); resolve(); }
      else if (payload.status === 'error') { clearTimeout(timeout); reject(new Error(`Realtime: ${payload.message}`)); }
    });
    channel.subscribe((status, error) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timeout); reject(error || new Error(`Realtime ${status}`)); } });
  });
  const message = await insert('messages', { sender_id: coach.user.id, receiver_id: athlete.user.id, content: 'Note privée', is_read: false }, coach.client); messageIds.push(message.id);
  let receiveTimeout;
  const delivered = await Promise.race([received, new Promise((_, reject) => { receiveTimeout = setTimeout(() => reject(new Error('Realtime delivery timeout')), 12000); })]).finally(() => clearTimeout(receiveTimeout));
  assert.equal(delivered.id, message.id);
  const messageEvents = await events('message_received');
  assert.equal(messageEvents.length, 1); assert.deepEqual(messageEvents[0].athlete_ids, [person.id]);
  assert.ok(!JSON.stringify(messageEvents).includes('Note privée'));
  console.log('✓ message réel : Realtime reçu, événement unique, contenu privé absent de la file');

  const created = await coach.client.rpc('create_session_with_athletes', { p_session: { title: 'Test outbox', sessionDate: '2026-09-05', day: 'Samedi', week: 36, time: '09:00', type: 'Sprint', category: 'sprint', trainingFocus: 'acceleration', durationMinutes: 60, loadWeight: 1 }, p_athlete_ids: [person.id, teammate.id], p_idempotency_key: crypto.randomUUID() });
  if (created.error) throw created.error;
  const sessions = await admin.from('sessions').select('id').eq('club_id', club.id);
  sessionIds.push(...sessions.data.map(row => row.id));
  const sessionEvents = await events('session_changed');
  assert.equal(sessionEvents.length, 1); assert.deepEqual([...sessionEvents[0].athlete_ids].sort(), [...athleteIds].sort());
  console.log('✓ séance et affectations dans une transaction : un seul événement, tous les participants');

  const response = await athlete.client.from('session_athletes').update({ rsvp_status: 'unavailable', rsvp_note: 'Note confidentielle' }).eq('session_id', sessionIds[0]).eq('athlete_id', person.id);
  if (response.error) throw response.error;
  const replies = await events('session_response');
  assert.equal(replies.length, 1); assert.deepEqual(replies[0].user_ids, [coach.user.id]);
  assert.ok(!JSON.stringify(replies).includes('confidentielle'));
  console.log('✓ réponse personnelle : uniquement le coach, sans note libre');

  await insert('social_posts', { club_id: club.id, athlete_id: person.id, content: 'Photo privée' }, athlete.client);
  const posts = await events('social_post');
  assert.deepEqual(posts[0].athlete_ids, [teammate.id]); assert.deepEqual(posts[0].user_ids, [coach.user.id]);
  console.log('✓ partage club : auteur exclu et destinataires calculés par la base');

  const goal = await insert('athlete_goals', { club_id: club.id, athlete_id: person.id, discipline: '100m', target_value: '12.0' });
  const achieved = await athlete.client.from('athlete_goals').update({ achieved: true }).eq('id', goal.id);
  if (achieved.error) throw achieved.error;
  assert.equal((await events('goal_achieved')).length, 1);
  const replay = await athlete.client.from('athlete_goals').update({ achieved: true }).eq('id', goal.id);
  if (replay.error) throw replay.error;
  assert.equal((await events('goal_achieved')).length, 1);
  console.log('✓ objectif atteint : événement seulement lors du changement effectif');
} finally {
  for (const client of clients) { await client.removeAllChannels(); await client.auth.signOut(); }
  if (messageIds.length) await admin.from('messages').delete().in('id', messageIds);
  if (sessionIds.length) await admin.from('sessions').delete().in('id', sessionIds);
  if (athleteIds.length) await admin.from('athletes').delete().in('id', athleteIds);
  if (userIds.length) await admin.from('users').delete().in('id', userIds);
  for (const id of authIds) await admin.auth.admin.deleteUser(id);
  if (club) await admin.from('clubs').delete().eq('id', club.id);
}
