#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

try {
  for (const raw of readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"), "utf8").split("\n")) {
    const match = raw.replace(/\r$/u, "").match(/^([A-Z0-9_]+)=(.*)$/u);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
} catch { /* environnement CI/local */ }

const url=process.env.VITE_SUPABASE_URL, anon=process.env.VITE_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error("Variables Supabase locales manquantes.");
const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
const runId=Date.now(), authIds=[], checks=[];
const check=(name,pass,detail="")=>{checks.push({name,pass});console.log(`${pass?"✓":"✗"} ${name}${detail?` — ${detail}`:""}`);};
async function insert(table,value){const {data,error}=await admin.from(table).insert(value).select().single();if(error)throw error;return data;}
async function account(clubId,role,label){const email=`wellness-${label}-${runId}@example.invalid`,password=`Wellness-${runId}-Aa!`;const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;authIds.push(created.data.user.id);const user=await insert("users",{club_id:clubId,role,name:label,email,auth_uid:created.data.user.id});const client=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;return{user,client};}

let club;
try {
  club=await insert("clubs",{name:`Wellness ${runId}`});
  const head=await account(club.id,"head_coach","head");
  const coach=await account(club.id,"coach","coach");
  const athleteAccount=await account(club.id,"athlete","athlete");
  const athlete=await insert("athletes",{club_id:club.id,name:"Athlète wellness",user_id:athleteAccount.user.id});
  const legacyAccount=await account(club.id,"athlete","legacy");
  const legacyAthlete=await insert("athletes",{club_id:club.id,name:"Athlète historique",user_id:legacyAccount.user.id});
  const today=new Date().toISOString().slice(0,10);

  const defaultConfig=await athleteAccount.client.rpc("get_wellness_questionnaire",{p_date:today});
  check("un club historique reçoit le preset V1 sans migration de données",!defaultConfig.error&&defaultConfig.data?.isDefault===true&&defaultConfig.data?.questions?.length===5,defaultConfig.error?.message);
  await insert("athlete_wellness",{athlete_id:legacyAthlete.id,club_id:club.id,date:today,sleep:4,energy:4,soreness:2,mood:4,stress:2});

  const forbiddenConfig=await coach.client.rpc("configure_wellness_questionnaire",{p_questions:[{key:"sleep",required:true}],p_active_days:[1,3,5],p_response_visibility:"staff"});
  check("seul le head coach configure le questionnaire",Boolean(forbiddenConfig.error),forbiddenConfig.error?.message);

  const configured=await head.client.rpc("configure_wellness_questionnaire",{p_questions:[{key:"sleep",required:true},{key:"motivation",required:false}],p_active_days:[1,3,5],p_response_visibility:"head_coach"});
  const versionId=configured.data?.versionId;
  const activeConfig=await athleteAccount.client.rpc("get_wellness_questionnaire",{p_date:today});
  check("ordre, obligation, jours et visibilité sont versionnés",!configured.error&&activeConfig.data?.versionId===versionId&&activeConfig.data?.questions?.[1]?.key==="motivation"&&activeConfig.data?.activeDays?.join(",")==="1,3,5",configured.error?.message??activeConfig.error?.message);
  const legacyConfig=await legacyAccount.client.rpc("get_wellness_questionnaire",{p_date:today});
  check("une réponse historique sans version reste attachée au preset V1",!legacyConfig.error&&legacyConfig.data?.isDefault===true&&legacyConfig.data?.versionId===null&&legacyConfig.data?.questions?.length===5,legacyConfig.error?.message);

  const missingRequired=await athleteAccount.client.rpc("submit_wellness_response",{p_answers:{motivation:5},p_notes:null,p_date:today});
  check("une question obligatoire manquante est refusée",Boolean(missingRequired.error),missingRequired.error?.message);

  const submitted=await athleteAccount.client.rpc("submit_wellness_response",{p_answers:{sleep:4,motivation:5},p_notes:"Bonne journée",p_date:today});
  const {data:stored}=await admin.from("athlete_wellness").select("*").eq("athlete_id",athlete.id).eq("date",today).single();
  check("la réponse conserve le snapshot et les colonnes V1 compatibles",!submitted.error&&stored.questionnaire_version_id===versionId&&stored.sleep===4&&stored.energy===null&&stored.answers?.motivation===5,submitted.error?.message);

  const coachView=await coach.client.from("athlete_wellness").select("id").eq("id",stored.id);
  const headView=await head.client.from("athlete_wellness").select("id").eq("id",stored.id);
  const athleteView=await athleteAccount.client.from("athlete_wellness").select("id").eq("id",stored.id);
  check("la visibilité head coach masque la réponse aux autres coachs",coachView.data?.length===0&&headView.data?.length===1&&athleteView.data?.length===1,coachView.error?.message??headView.error?.message??athleteView.error?.message);

  const version2=await head.client.rpc("configure_wellness_questionnaire",{p_questions:[{key:"energy",required:true},{key:"mood",required:true}],p_active_days:[2,4],p_response_visibility:"staff"});
  const sameDayConfig=await athleteAccount.client.rpc("get_wellness_questionnaire",{p_date:today});
  const edited=await athleteAccount.client.rpc("submit_wellness_response",{p_answers:{sleep:5,motivation:4},p_notes:"Corrigé",p_date:today});
  const {data:afterEdit}=await admin.from("athlete_wellness").select("questionnaire_version_id,answers").eq("id",stored.id).single();
  check("une nouvelle version ne change jamais le sens d’une réponse existante",!version2.error&&sameDayConfig.data?.versionId===versionId&&!edited.error&&afterEdit.questionnaire_version_id===versionId&&afterEdit.answers?.sleep===5,version2.error?.message??sameDayConfig.error?.message??edited.error?.message);

  const invalidCatalog=await head.client.rpc("configure_wellness_questionnaire",{p_questions:[{key:"question_libre",required:true}],p_active_days:[1],p_response_visibility:"staff"});
  check("la bibliothèque fermée refuse une question arbitraire",Boolean(invalidCatalog.error),invalidCatalog.error?.message);
} finally {
  if(club)await admin.from("clubs").delete().eq("id",club.id);
  for(const id of authIds)await admin.auth.admin.deleteUser(id).catch(()=>{});
}
const failed=checks.filter(result=>!result.pass);console.log(`\n${checks.length-failed.length}/${checks.length} validations wellness OK`);if(failed.length)process.exit(1);
