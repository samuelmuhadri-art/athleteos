// Read-only production probes. No service key, no account creation, no cron run.
import assert from 'node:assert/strict';

const site = process.env.ATHLETEOS_SITE_URL || 'https://athleteos-by-samuelmuhadri.vercel.app';
const project = process.env.ATHLETEOS_PROJECT_REF || 'kuqafsmkwajeipzolbky';
const origin = new URL(site).origin;
if (!origin.startsWith('https://')) throw new Error('HTTPS requis');
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
const results = [];
const check = async (name, action) => {
  try { await action(); results.push({ name, ok: true }); console.log(`OK ${name}`); }
  catch { results.push({ name, ok: false }); console.error(`ECHEC ${name} (aucun contenu de réponse journalisé)`); }
};
let anonKey;
await check('Frontend et liaison au projet Supabase attendu', async () => {
  const response = await request(origin, { cache: 'no-store' });
  assert.equal(response.status, 200);
  const html = await response.text();
  const paths = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.js)"/g)].map((match) => match[1]))];
  assert.ok(paths.length > 0 && paths.length <= 40);
  const bundles = await Promise.all(paths.map(async (path) => {
    const response = await request(new URL(path, origin)); assert.equal(response.status, 200); return response.text();
  }));
  const source = bundles.join('\n');
  assert.ok(source.includes(`https://${project}.supabase.co`));
  for (const token of source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
      if (payload.role === 'anon' && payload.ref === project) { anonKey = token; break; }
    } catch { /* not an Auth token */ }
  }
  assert.ok(anonKey, 'Clé publique attendue introuvable');
});
if (anonKey) {
  const backend = `https://${project}.supabase.co`;
  const headers = { apikey: anonKey, 'Content-Type': 'application/json' };
  for (const rpc of ['get_my_dashboard_preferences', 'get_club_alert_rules', 'get_wellness_questionnaire']) {
    await check(`RPC ${rpc} : anonyme refusé`, async () => {
      const response = await request(`${backend}/rest/v1/rpc/${rpc}`, { method: 'POST', headers, body: '{}' });
      assert.ok([401,403].includes(response.status));
    });
  }
  for (const name of ['admin-actions','send-push','session-reminders','weekly-cron']) {
    await check(`Edge ${name} : anonyme refusé`, async () => {
      const response = await request(`${backend}/functions/v1/${name}`, { method: 'POST', headers, body: '{}' });
      if (name === 'admin-actions' && response.status === 200) {
        const body = await response.json(); assert.equal(body.success, false); assert.equal(body.error, 'Non authentifié.');
      } else assert.ok([401,403].includes(response.status));
    });
  }
  await check('Signup : méthode GET refusée sans créer de compte', async () => {
    const response = await request(`${backend}/functions/v1/signup`, { headers }); assert.equal(response.status,405);
  });
}
console.log(`${results.filter((item) => item.ok).length}/${results.length} contrôles. Recette authentifiée et SMTP non couverts par ces sondes.`);
if (results.some((item) => !item.ok)) process.exitCode = 1;
