import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { normalizeAlertRules } from './src/domain/alertRules.js';

const url=process.env.VITE_SUPABASE_URL, anon=process.env.VITE_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !['127.0.0.1','localhost'].includes(new URL(url).hostname) || !anon || !service) {
  throw new Error('Ce test exige les clés de Supabase LOCAL.');
}
const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
const authIds=[], clubs=[], run=Date.now(); let checks=0;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(new Date());
const day=offset=>new Date(new Date(`${today}T12:00:00Z`).getTime()+offset*86400000).toISOString().slice(0,10);
const ok=(label,condition)=>{assert.ok(condition,label);console.log(`✓ ${label}`);checks++;};
const data=async query=>{const result=await query;if(result.error)throw new Error(result.error.message);return result.data;};
const insert=(table,value)=>data(admin.from(table).insert(value).select().single());
async function account(clubId,role){
  const email=`alert-rules-${role}-${authIds.length}-${run}@example.invalid`,password=`Rules-${run}-Aa!`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
  authIds.push(created.data.user.id);
  const user=await insert('users',{club_id:clubId,role,name:role,email,auth_uid:created.data.user.id});
  const client=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
  await data(client.auth.signInWithPassword({email,password}));return {client,user};
}
let club;
try {
  club=await insert('clubs',{name:`Alert rules ${run}`});clubs.push(club.id);
  const other=await insert('clubs',{name:`Alert rules foreign ${run}`});clubs.push(other.id);
  const head=await account(club.id,'head_coach'),coach=await account(club.id,'coach'),member=await account(club.id,'athlete');
  const stranger=await account(other.id,'head_coach');
  const athlete=await insert('athletes',{club_id:club.id,name:'Sprint test',group_name:'Sprint',user_id:member.user.id});
  const ignored=await insert('athletes',{club_id:club.id,name:'Sauts test',group_name:'Sauts'});
  let rules=normalizeAlertRules([]);
  const save=()=>data(head.client.rpc('configure_club_alert_rules',{p_rules:rules}));
  const evaluate=(client=admin,extra={})=>data(client.rpc('evaluate_club_alert_rules',{p_club_id:club.id,p_as_of:today,...extra}));
  const alerts=()=>data(admin.from('alerts').select('*').eq('club_id',club.id).not('rule_key','is',null));
  ok('Un club sans configuration ne reçoit aucune nouvelle règle active',(await evaluate()).generated===0);
  ok('Configuration réservée au responsable',!!(await coach.client.rpc('configure_club_alert_rules',{p_rules:rules})).error);
  ok('Un athlète ne peut pas évaluer les règles',!!(await member.client.rpc('evaluate_club_alert_rules',{p_club_id:club.id})).error);
  ok('Un autre club ne peut pas évaluer ces règles',!!(await stranger.client.rpc('evaluate_club_alert_rules',{p_club_id:club.id})).error);
  ok('Une date arbitraire est refusée au navigateur',!!(await head.client.rpc('evaluate_club_alert_rules',{p_club_id:club.id,p_as_of:day(1)})).error);
  const bad=normalizeAlertRules([]);bad[0].parameters.days=999;
  ok('Les bornes sont validées côté serveur',!!(await head.client.rpc('configure_club_alert_rules',{p_rules:bad})).error);
  rules=rules.map(rule=>({...rule,enabled:true,targetGroup:'Sprint'}));
  await save();
  const once=await data(head.client.rpc('get_club_alert_rules'));
  await save();
  ok('Un enregistrement identique ne crée pas une nouvelle version',JSON.stringify(once)===JSON.stringify(await data(head.client.rpc('get_club_alert_rules'))));
  ok('Les réglages sont isolés entre clubs',(await data(stranger.client.from('club_alert_rules').select('*').eq('club_id',club.id))).length===0);
  await data(admin.from('club_alert_rules').update({updated_at:`${day(-10)}T12:00:00Z`}).eq('club_id',club.id));
  const questionnaire=await data(head.client.rpc('configure_wellness_questionnaire',{
    p_questions:[{key:'sleep',required:true},{key:'soreness',required:true}],p_active_days:[1,2,3,4,5,6,7],p_response_visibility:'head_coach',
  }));
  for(const id of [athlete.id,ignored.id]) for(const offset of [-2,-1]) await insert('athlete_wellness',{
    club_id:club.id,athlete_id:id,date:day(offset),sleep:1,soreness:5,questionnaire_version_id:questionnaire.versionId,answers:{sleep:1,soreness:5},
  });
  const session=await insert('sessions',{club_id:club.id,title:'Séance réalisée',session_date:day(-3),lifecycle_status:'completed'});
  await insert('session_athletes',{session_id:session.id,athlete_id:athlete.id,status:'done'});
  const cancelled=await insert('sessions',{club_id:club.id,title:'Absence déclarée',session_date:day(-4),lifecycle_status:'planned'});
  await insert('session_athletes',{session_id:cancelled.id,athlete_id:athlete.id,status:'none'});
  const competition=await insert('competitions',{club_id:club.id,name:'Meeting',date:day(10)});
  await insert('competition_athletes',{competition_id:competition.id,athlete_id:athlete.id});
  await evaluate(admin,{p_dry_run:true});
  ok('Le dry-run ne crée ni alerte ni Push',(await alerts()).length===0&&(await data(admin.from('push_event_outbox').select('id').eq('club_id',club.id))).length===0);
  await evaluate();let generated=await alerts();
  ok('Sommeil, courbatures, feedback, RPE et compétition sont évalués', ['sleep_low','soreness_high','feedback_missing','rpe_missing','competition_unplanned'].every(key=>generated.some(alert=>alert.rule_key===key)));
  ok('Population, absences déclarées et charge incomplète respectées',generated.every(alert=>alert.athlete_id===athlete.id&&alert.session_id!==cancelled.id&&alert.rule_key!=='load_variation'));
  const sleep=generated.find(alert=>alert.rule_key==='sleep_low');
  ok('La provenance conserve les seuils et les réponses',sleep.trigger_data.parameters.threshold===2&&sleep.trigger_data.responses.length===2&&sleep.rule_version===1);
  ok('Une réponse privée force une alerte privée malgré la règle staff',sleep.recipient_scope==='head_coach');
  ok('Le coach et l’athlète ne lisent pas une alerte privée',(await data(coach.client.from('alerts').select('*').eq('id',sleep.id))).length===0&&(await data(member.client.from('alerts').select('*').eq('id',sleep.id))).length===0);
  ok('Les RPC de lecture et résolution respectent les destinataires',(await data(coach.client.rpc('mark_alerts_read',{p_alert_ids:[sleep.id]})))===0&&!!(await coach.client.rpc('set_alert_resolution',{p_alert_id:sleep.id,p_resolved:true})).error);
  const push=await data(admin.from('push_event_outbox').select('*').eq('club_id',club.id).eq('entity_id',sleep.id).eq('event_type','rule_wellness'));
  ok('La Push privée est déterminée par le serveur',push.length===1&&JSON.stringify(push[0].user_ids)===JSON.stringify([head.user.id]));
  ok('Le navigateur ne peut pas forger la provenance',!!(await head.client.from('alerts').insert({club_id:club.id,rule_key:'sleep_low',title:'forgée'})).error);
  ok('Le texte d’une alerte automatique est immuable',!!(await head.client.from('alerts').update({description:'falsifié'}).eq('id',sleep.id)).error);
  await data(head.client.rpc('set_alert_resolution',{p_alert_id:sleep.id,p_resolved:true,p_archived:true}));
  const before=generated.length;await Promise.all([evaluate(),evaluate()]);generated=await alerts();
  ok('Concurrence et résolution ne recréent pas le même épisode',generated.length===before&&generated.find(row=>row.id===sleep.id).archived_at!==null);
  await insert('athlete_wellness',{club_id:club.id,athlete_id:athlete.id,date:today,sleep:5,soreness:1});
  await evaluate();ok('Une récupération ne crée pas une fausse alerte',(await alerts()).length===before);
  await data(admin.from('athlete_wellness').delete().eq('athlete_id',athlete.id));
  await data(admin.from('wellness_questionnaire_versions').update({created_at:`${day(-10)}T12:00:00Z`}).eq('id',questionnaire.versionId));
  await evaluate();ok('Absence de wellness calculée sur les jours terminés demandés',(await alerts()).some(row=>row.rule_key==='wellness_missing'));
  const newRule=rules.find(row=>row.key==='wellness_missing');newRule.parameters.days=3;
  await save();
  await data(admin.from('club_alert_rules').update({updated_at:`${day(-10)}T12:00:00Z`}).eq('club_id',club.id));
  await data(admin.from('athlete_modules').upsert({club_id:club.id,athlete_id:athlete.id,module_key:'wellness',enabled:false},{onConflict:'athlete_id,module_key'}));
  const disabledBefore=(await alerts()).length;await evaluate();
  ok('Wellness désactivé individuellement : aucune nouvelle alerte',(await alerts()).length===disabledBefore);

  // Complete 35-day history, including explicitly confirmed rest; missing historical days must not become zero.
  await data(head.client.from('session_athletes').update({rpe:8,actual_duration_minutes:50,duration_source:'reported',feedback_submitted_at:new Date().toISOString()}).eq('session_id',session.id));
  for(const offset of [-10,-17,-24,-31]){
    const reference=await insert('sessions',{club_id:club.id,title:'Référence',session_date:day(offset),lifecycle_status:'completed'});
    await insert('session_athletes',{session_id:reference.id,athlete_id:athlete.id,status:'done',rpe:2,actual_duration_minutes:50,duration_source:'reported'});
  }
  await data(admin.from('athlete_daily_load_days').insert(Array.from({length:35},(_,i)=>({athlete_id:athlete.id,load_date:day(-i-1)}))));
  await evaluate();
  const load=(await alerts()).find(row=>row.rule_key==='load_variation');
  ok('Charge complète comparée sans coefficient ACWR',load?.trigger_data.variationPercent===300&&load.trigger_data.load===400&&load.trigger_data.reference===100);
  const loadRule=rules.find(row=>row.key==='load_variation');loadRule.parameters.percent=30;await save();
  await data(admin.from('athlete_daily_load_days').delete().eq('athlete_id',athlete.id).eq('load_date',day(-35)));
  await evaluate();ok('Une seule journée inconnue empêche la comparaison de charge',(await alerts()).filter(row=>row.rule_key==='load_variation').length===1);
  await insert('athlete_daily_load_days',{athlete_id:athlete.id,load_date:day(-35)});
  const incomplete=await insert('sessions',{club_id:club.id,title:'Seconde séance sans retour',session_date:day(-3)});
  await insert('session_athletes',{session_id:incomplete.id,athlete_id:athlete.id});
  await evaluate();ok('Une séance sans retour rend sa journée incomplète même si une autre séance est renseignée',
    (await alerts()).filter(row=>row.rule_key==='load_variation').length===1);
  const newcomer=await account(club.id,'coach');
  const claimed=await data(admin.rpc('claim_trusted_push_events',{p_actor_user_id:head.user.id}));
  ok('La livraison ignore les alertes archivées, les modules désactivés et les anciennes versions',
    claimed.every(event=>event.entity_id!==sleep.id&&!['rule_wellness','rule_load'].includes(event.event_type)));
  ok('Les destinataires sont recalculés à la livraison',claimed.length>0&&claimed.every(event=>event.user_ids.includes(newcomer.user.id)));
  const secondClaim=await data(admin.rpc('claim_trusted_push_events',{p_actor_user_id:head.user.id}));
  ok('Un événement déjà réservé ne peut pas être livré simultanément',secondClaim.length===0);
  console.log(`\n${checks} validations alertes OK`);
} catch(error) {
  console.error('Échec test alertes :',error.message);process.exitCode=1;
} finally {
  for(const id of clubs) {
    for(const table of ['alerts','athlete_wellness','sessions','competitions','athletes','wellness_questionnaire_versions','push_event_outbox','users','clubs']) {
      const result=await admin.from(table).delete().eq(table==='clubs'?'id':'club_id',id);
      if(result.error)console.error(`Nettoyage ${table} du club de test ${id} : ${result.error.message}`);
    }
  }
  for(const id of authIds){const result=await admin.auth.admin.deleteUser(id);if(result.error)console.error('Nettoyage utilisateur de test échoué');}
}
