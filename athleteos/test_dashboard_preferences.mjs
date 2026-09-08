import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { normalizeDashboardPreferences } from './src/domain/dashboardPreferences.js';

const url=process.env.VITE_SUPABASE_URL, anon=process.env.VITE_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !['127.0.0.1','localhost'].includes(new URL(url).hostname) || !anon || !service) throw new Error('Supabase LOCAL requis');
const options={auth:{autoRefreshToken:false,persistSession:false}};
const admin=createClient(url,service,options), authIds=[], clubs=[], run=Date.now(); let checks=0;
const data=async query=>{const result=await query;if(result.error)throw result.error;return result.data;};
const insert=(table,value)=>data(admin.from(table).insert(value).select().single());
const ok=(label,condition)=>{assert.ok(condition,label);console.log(`✓ ${label}`);checks++;};
async function account(clubId,role){
  const email=`dashboard-${role}-${authIds.length}-${run}@example.invalid`, password=`Dashboard-${run}-Aa!`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
  authIds.push(created.data.user.id);
  const user=await insert('users',{club_id:clubId,role,name:role,email,auth_uid:created.data.user.id});
  const client=createClient(url,anon,options); await data(client.auth.signInWithPassword({email,password}));return {client,user};
}
try {
  const club=await insert('clubs',{name:`Dashboard ${run}`});clubs.push(club.id);
  const foreign=await insert('clubs',{name:`Dashboard foreign ${run}`});clubs.push(foreign.id);
  const head=await account(club.id,'head_coach'), coach=await account(club.id,'coach'), athlete=await account(club.id,'athlete'), stranger=await account(foreign.id,'head_coach');
  await insert('athletes',{club_id:club.id,name:'Test dashboard',group_name:'Sprint'});
  await insert('athletes',{club_id:foreign.id,name:'Test foreign',group_name:'Sauts'});
  const get=client=>data(client.rpc('get_my_dashboard_preferences'));
  const defaults=normalizeDashboardPreferences(null);
  const configured={...defaults,order:['overview','priorities','wellness','followup'],hidden:['wellness','goals'],defaultGroup:'Sprint',feedbackDays:14};
  const save=(client,p_preferences)=>client.rpc('configure_my_dashboard_preferences',{p_preferences});
  ok('Club existant sans réglages : valeurs par défaut',JSON.stringify(await get(coach.client))==='{}');
  ok('Un coach peut personnaliser son propre accueil',!(await save(coach.client,configured)).error);
  assert.deepEqual(await get(coach.client),configured);ok('Préférences persistées côté serveur',true);
  ok('Le responsable ne lit pas les préférences du coach',(await data(head.client.from('coach_dashboard_preferences').select('*'))).length===0);
  ok('Isolation inter-club',(await data(stranger.client.from('coach_dashboard_preferences').select('*').eq('user_id',coach.user.id))).length===0);
  ok('Le responsable garde ses propres valeurs par défaut',JSON.stringify(await get(head.client))==='{}');
  ok('Chaque responsable peut enregistrer ses préférences',!(await save(head.client,defaults)).error);
  ok('Un athlète ne configure pas un accueil coach',!!(await save(athlete.client,defaults)).error);
  ok('Un athlète ne lit pas les préférences coach',!!(await athlete.client.rpc('get_my_dashboard_preferences')).error);
  ok('Lecture anonyme refusée',!!(await createClient(url,anon,options).rpc('get_my_dashboard_preferences')).error);
  ok('Écriture directe interdite même au propriétaire',!!(await coach.client.from('coach_dashboard_preferences').update({preferences:{}}).eq('user_id',coach.user.id)).error);
  ok('Insertion directe pour un autre utilisateur interdite',!!(await coach.client.from('coach_dashboard_preferences').insert({user_id:athlete.user.id,club_id:club.id})).error);
  for(const [label,patch] of [
    ['bloc inconnu',{order:['evil','priorities','wellness','overview']}],
    ['ordre incomplet',{order:['overview']}],
    ['ordre dupliqué',{order:['overview','overview','wellness','priorities']}],
    ['carte inconnue',{hidden:['custom_metric']}],
    ['période hors bornes',{feedbackDays:365}],
    ['période texte',{feedbackDays:'14'}],
    ['groupe étranger',{defaultGroup:'Sauts'}],
    ['identité injectée',{user_id:head.user.id}],
  ]) ok(`Validation serveur : ${label}`,!!(await save(coach.client,{...configured,...patch})).error);
  ok('Valeur nulle refusée',!!(await save(coach.client,null)).error);
  assert.deepEqual(await get(coach.client),configured);ok('Échecs sans altération des réglages',true);
  await data(admin.from('users').update({role:'athlete'}).eq('id',coach.user.id));
  ok('Rôle rétrogradé : préférences devenues inaccessibles',!!(await coach.client.rpc('get_my_dashboard_preferences')).error && (await data(coach.client.from('coach_dashboard_preferences').select('*'))).length===0);
  await data(admin.from('users').update({role:'coach',club_id:foreign.id}).eq('id',coach.user.id));
  ok('Changement de club : les anciennes préférences ne sont pas réutilisées',JSON.stringify(await get(coach.client))==='{}');
  ok('Réinitialisation possible dans le nouveau club',!(await save(coach.client,defaults)).error);
  await data(admin.from('users').delete().eq('id',coach.user.id));
  ok('Suppression du compte : préférences supprimées par cascade',(await data(admin.from('coach_dashboard_preferences').select('*').eq('user_id',coach.user.id))).length===0);
  console.log(`\n${checks} validations dashboard OK`);
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {
  for(const id of clubs) for(const table of ['athletes','users','clubs']) {
    const result=await admin.from(table).delete().eq(table==='clubs'?'id':'club_id',id);
    if(result.error){console.error(`Nettoyage fixture ${table}/${id}: ${result.error.message}`);process.exitCode=1;}
  }
  for(const id of authIds) {const result=await admin.auth.admin.deleteUser(id);if(result.error)process.exitCode=1;}
}
