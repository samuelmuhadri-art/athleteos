// Isolated local SQL restore drill. Never connects to a remote database and
// never restores into postgres. Storage binaries are NOT covered by this drill.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const container='supabase_db_athleteos';
const id=crypto.randomUUID().replaceAll('-','');
const database=`athleteos_restore_${id}`;
const archive=`/tmp/athleteos_restore_${id}.dump`;
if (!/^athleteos_restore_[a-f0-9]{32}$/.test(database)) throw new Error('Cible temporaire invalide');
const run=(...args)=>execFileSync('docker',['exec',container,...args],{encoding:'utf8',maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
const sql=(db,query)=>run('psql','-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',query).trim();
let created=false;
let phase='inventaire';
try {
  const tables=JSON.parse(sql('postgres',`SELECT json_agg(json_build_object('schema',schemaname,'name',tablename) ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname IN ('public','auth','storage','supabase_migrations')`));
  phase='dump';
  run('pg_dump','-U','postgres','-d','postgres','--format=custom','--schema=public','--schema=auth','--schema=storage','--schema=extensions','--schema=supabase_migrations','--file',archive);
  run('createdb','-U','postgres','--template=template0',database);created=true;
  // A fresh template0 database already owns an empty public schema. Only our
  // newly created temporary database is touched; no CASCADE is needed.
  sql(database,'DROP SCHEMA public');
  phase='restauration';
  run('pg_restore','-U','supabase_admin','--dbname',database,'--no-owner','--exit-on-error',archive);
  // Only counts are compared/reported; personal rows never appear in logs.
  const quote=name=>`"${name.replaceAll('"','""')}"`;
  phase='comparaison';
  for(const table of tables) {
    const query=`SELECT count(*) FROM ${quote(table.schema)}.${quote(table.name)}`;
    assert.equal(sql(database,query),sql('postgres',query),`Nombre de lignes différent pour ${table.schema}.${table.name}`);
  }
  const policies=`SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','storage')`;
  assert.equal(sql(database,policies),sql('postgres',policies));
  console.log(`Restauration SQL locale validée : ${tables.length} tables, volumes et nombre de policies identiques.`);
  console.log('Ne valide pas les fichiers Storage, les secrets, les tâches planifiées ni une restauration de production.');
} catch(error) {
  // Database diagnostics may contain personal values; don't print stderr.
  console.error(`Échec de restauration locale (${phase}) : ${error.code ?? error.name}. Aucun contenu métier journalisé.`);
  const schemaDiagnostic=String(error.stderr ?? '').match(/ERROR:\s+(?:schema|extension|function|type|relation|permission denied)[^\r\n]*/)?.[0];
  if(schemaDiagnostic) console.error(schemaDiagnostic);
  process.exitCode=1;
} finally {
  // Names are generated above, immutable and checked. No user database is dropped.
  if(created) run('dropdb','-U','postgres',database);
  run('rm','-f','--',archive);
  console.log('Base de restauration et archive temporaires locales nettoyées ; source conservée.');
}
