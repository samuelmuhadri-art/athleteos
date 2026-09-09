import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const url=process.env.VITE_SUPABASE_URL, anon=process.env.VITE_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !['127.0.0.1','localhost'].includes(new URL(url).hostname) || !anon || !service) throw new Error('Supabase LOCAL requis ; ce script ne peut pas modifier la production.');
const options={auth:{autoRefreshToken:false,persistSession:false}};
const admin=createClient(url,service,options), authIds=[], clubs=[], run=Date.now(); let checks=0;
const data=async query=>{const result=await query;if(result.error)throw result.error;return result.data;};
const insert=(table,value)=>data(admin.from(table).insert(value).select().single());
const ok=(name,condition)=>{assert.ok(condition,name);console.log(`OK ${name}`);checks++;};
async function account(clubId,role) {
  const email=`readiness-${role}-${authIds.length}-${run}@example.invalid`,password=`Readiness-${run}-Aa!`;
  const created=await data(admin.auth.admin.createUser({email,password,email_confirm:true})); authIds.push(created.user.id);
  const user=await insert('users',{club_id:clubId,role,name:role,email,auth_uid:created.user.id});
  const client=createClient(url,anon,options); await data(client.auth.signInWithPassword({email,password}));
  return {client,user,authId:created.user.id,email};
}
try {
  const club=await insert('clubs',{name:`Readiness ${run}`,invite_code:'RDTST234'});clubs.push(club.id);
  const foreign=await insert('clubs',{name:`Readiness foreign ${run}`});clubs.push(foreign.id);
  const head=await account(club.id,'head_coach'),coach=await account(club.id,'coach'),athlete=await account(club.id,'athlete'),other=await account(foreign.id,'head_coach');
  const sprint=await insert('athletes',{club_id:club.id,name:'Sprint',group_name:'Sprint'});
  const jump=await insert('athletes',{club_id:club.id,name:'Sauts',group_name:'Sauts'});
  const outsider=await insert('athletes',{club_id:foreign.id,name:'Externe',group_name:'Lancers'});
  const get=client=>data(client.rpc('get_coach_following'));
  const save=(client,patch={})=>client.rpc('configure_coach_following',{
    p_coach_user_id:coach.user.id,p_mode:'assigned',p_groups:['Sprint'],p_athlete_ids:[jump.id],p_expected_revision:0,...patch,
  });
  ok('Défaut rétrocompatible : tout le club',(await get(coach.client)).coaches[0].mode==='club');
  ok('Responsable global présent',(await get(head.client)).coaches.find(u=>u.id===head.user.id).mode==='club');
  ok('Athlète : lecture des affectations refusée',!!(await athlete.client.rpc('get_coach_following')).error);
  ok('Anonyme : lecture refusée',!!(await createClient(url,anon,options).rpc('get_coach_following')).error);
  ok('Coach : pas d’auto-affectation',!!(await save(coach.client)).error);
  ok('Autre club refusé',!!(await save(other.client)).error);
  ok('Head coach non restreignable',!!(await save(head.client,{p_coach_user_id:head.user.id})).error);
  ok('Groupe étranger refusé',!!(await save(head.client,{p_groups:['Lancers']})).error);
  ok('Athlète étranger refusé',!!(await save(head.client,{p_athlete_ids:[outsider.id]})).error);
  ok('Écriture directe interdite',!!(await coach.client.from('coach_following').insert({coach_user_id:coach.user.id,club_id:club.id})).error);
  ok('Affectations enregistrées',!(await save(head.client)).error);
  let following=(await get(coach.client)).coaches[0];
  assert.deepEqual(following.groups,['Sprint']); assert.deepEqual(following.athleteIds,[jump.id]); ok('Lecture limitée à son suivi',(await get(coach.client)).coaches.length===1);
  ok('Conflit concurrent détecté',!!(await save(head.client)).error);
  ok('Échec atomique sans perdre les affectations',(await get(coach.client)).coaches[0].revision===1);
  await data(admin.from('athletes').update({group_name:'Demi-fond'}).eq('id',sprint.id));
  ok('Groupe disparu refusé à la sauvegarde',!!(await save(head.client,{p_expected_revision:1})).error);
  ok('Réinitialisation explicite possible',!(await save(head.client,{p_mode:'club',p_groups:[],p_athlete_ids:[],p_expected_revision:1})).error);
  following=(await get(coach.client)).coaches[0];ok('Réinitialisation efface les anciennes affectations',following.mode==='club' && following.groups.length===0 && following.athleteIds.length===0);
  ok('Email non confirmé impossible via profil',!!(await coach.client.from('users').update({email:'forged@example.invalid'}).eq('id',coach.user.id)).error);
  const newEmail=`readiness-confirmed-${run}@example.invalid`;
  await data(admin.auth.admin.updateUserById(coach.authId,{email:newEmail,email_confirm:true}));
  ok('Email Auth confirmé synchronisé',(await data(admin.from('users').select('email').eq('id',coach.user.id).single())).email===newEmail);

  const invitedEmail=`readiness-invited-${run}@example.invalid`;
  const invitedAuth=await data(admin.auth.admin.createUser({email:invitedEmail,password:`Invited-${run}-Aa!`,email_confirm:true}));authIds.push(invitedAuth.user.id);
  const token=crypto.randomUUID();
  const invitation=await insert('club_invitations',{club_id:club.id,code:'RDCK2345',target_role:'coach',recipient_email:invitedEmail,created_by:head.user.id,reservation_token:token,reserved_until:new Date(Date.now()+300000).toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()});
  const inspect=await data(createClient(url,anon,options).rpc('inspect_club_invitation',{p_code:invitation.code}));
  ok('Inspection publique annonce le rôle sans email',inspect.targetRole==='coach' && !JSON.stringify(inspect).includes(invitedEmail));
  const payload={p_mode:'join_club',p_club_name:'',p_invite_code:'RDTST234',p_auth_uid:invitedAuth.user.id,p_name:'Coach invité',p_email:invitedEmail,p_individual_invitation_id:invitation.id,p_reservation_token:token};
  ok('RPC de création réservée au serveur',!!(await coach.client.rpc('signup_create_account_with_invitation',payload)).error);
  ok('Mauvaise réservation refusée',!!(await admin.rpc('signup_create_account_with_invitation',{...payload,p_reservation_token:crypto.randomUUID()})).error);
  ok('Mauvais destinataire refusé',!!(await admin.rpc('signup_create_account_with_invitation',{...payload,p_email:coach.email})).error);
  const accepted=await data(admin.rpc('signup_create_account_with_invitation',payload));
  ok('Invitation crée un coach',accepted.role==='coach');
  ok('Aucun faux profil athlète créé',(await data(admin.from('athletes').select('id').eq('user_id',accepted.userId))).length===0);
  ok('Invitation à usage unique',!!(await admin.rpc('signup_create_account_with_invitation',payload)).error);
  ok('Pas de self-service head coach',!!(await admin.from('club_invitations').insert({club_id:club.id,code:'RDHH2345',target_role:'head_coach',created_by:head.user.id})).error);
  ok('Invitation coach obligatoirement nominative',!!(await admin.from('club_invitations').insert({club_id:club.id,code:'RDNN2345',target_role:'coach',created_by:head.user.id})).error);
  await data(admin.from('users').update({role:'athlete'}).eq('id',coach.user.id));
  ok('Coach rétrogradé : lecture refusée',!!(await coach.client.rpc('get_coach_following')).error);
  await data(admin.from('users').delete().eq('id',coach.user.id));
  ok('Suppression du coach nettoie ses réglages',(await data(admin.from('coach_following').select('*').eq('coach_user_id',coach.user.id))).length===0);
  console.log(`${checks} contrôles intégration réussis`);
} catch(error) {console.error(error.message ?? 'Échec intégration');process.exitCode=1;}
finally {
  for(const id of clubs) for(const table of ['audit_logs','club_invitations','athletes','users','clubs']) {
    const key=table==='clubs'?'id':table==='audit_logs'?'actor_club_id':'club_id';
    const result=await admin.from(table).delete().eq(key,id);
    if(result.error){console.error(`Nettoyage ${table}/${id} impossible`);process.exitCode=1;}
  }
  for(const id of authIds) {const result=await admin.auth.admin.deleteUser(id);if(result.error)process.exitCode=1;}
}
