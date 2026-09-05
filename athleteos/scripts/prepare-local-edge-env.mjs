import { createECDH } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';

// Artefact local ignoré : aucune clé de production, aucune valeur imprimée.
const key = createECDH('prime256v1');
key.generateKeys();
const target = new URL('../supabase/.temp/', import.meta.url);
await mkdir(target, { recursive: true });
await writeFile(new URL('security-test.env', target), [
  `VAPID_PUBLIC_KEY=${key.getPublicKey().toString('base64url')}`,
  `VAPID_PRIVATE_KEY=${key.getPrivateKey().toString('base64url')}`,
  'SIGNUP_TEST_MODE=true',
  '',
].join('\n'));
console.log('Configuration Edge locale générée dans supabase/.temp/security-test.env (clés éphémères).');
