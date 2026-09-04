#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

try {
  for (const raw of readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"), "utf8").split("\n")) {
    const match=raw.replace(/\r$/u, "").match(/^([A-Z0-9_]+)=(.*)$/u);
    if(match&&process.env[match[1]]===undefined)process.env[match[1]]=match[2].trim();
  }
} catch { /* variables injectées par l'environnement local */ }
const url=process.env.VITE_SUPABASE_URL,anon=process.env.VITE_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!anon||!service)throw new Error("Variables Supabase locales manquantes.");
const parsedUrl=new URL(url);
if(parsedUrl.protocol!=="http:"||!["127.0.0.1","localhost","::1"].includes(parsedUrl.hostname))throw new Error("Ce scénario est réservé à Supabase local.");

const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
const runId=Date.now(),checks=[],authIds=[],storagePaths=[];
const check=(name,pass,detail="")=>{checks.push({name,pass});console.log(`${pass?"✓":"✗"} ${name}${detail?` — ${detail}`:""}`);};
async function insert(table,value){const{data,error}=await admin.from(table).insert(value).select();if(error)throw error;return data;}
async function coachAccount(clubId){const email=`scale-coach-${runId}@example.invalid`,password=`Scale-${runId}-Aa!`;const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;authIds.push(created.data.user.id);const [user]=await insert("users",{club_id:clubId,role:"head_coach",name:"Coach Scale",email,auth_uid:created.data.user.id});const client=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;return{user,client};}
async function athleteAccount(clubId){const email=`scale-athlete-${runId}@example.invalid`,password=`ScaleAthlete-${runId}-Aa!`;const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;authIds.push(created.data.user.id);const [user]=await insert("users",{club_id:clubId,role:"athlete",name:"Athlète Message 1",email,auth_uid:created.data.user.id});const client=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;return{user,client};}

let club;
try {
  [club]=await insert("clubs",{name:`Scale 30 ${runId}`});
  const coach=await coachAccount(club.id);
  const linkedAthlete=await athleteAccount(club.id);
  const extraAthleteUsers=await insert("users",[
    {club_id:club.id,role:"athlete",name:"Athlète Message 2",email:`scale-a2-${runId}@example.invalid`},
  ]);
  const athleteUsers=[linkedAthlete.user,...extraAthleteUsers];
  const groups=["Sprint","Demi-fond","Sauts"];
  const athletes=await insert("athletes",Array.from({length:30},(_,index)=>({
    club_id:club.id,name:`Athlète ${String(index+1).padStart(2,"0")}`,
    group_name:groups[index%groups.length],main_discipline:index%3===0?"100m":index%3===1?"1500m":"Longueur",
    user_id:index<2?athleteUsers[index].id:null,
  })));
  const sprint=athletes.filter(athlete=>athlete.group_name==="Sprint");
  const demiFond=athletes.filter(athlete=>athlete.group_name==="Demi-fond");
  const sauts=athletes.filter(athlete=>athlete.group_name==="Sauts");

  const moduleBatches=await Promise.all([
    coach.client.rpc("configure_athlete_modules",{p_athlete_ids:sprint.map(a=>a.id),p_enabled_module_keys:["planning","performances","session_feedback","training_load","messaging"]}),
    coach.client.rpc("configure_athlete_modules",{p_athlete_ids:demiFond.map(a=>a.id),p_enabled_module_keys:["planning","performances","messaging"]}),
    coach.client.rpc("configure_athlete_modules",{p_athlete_ids:sauts.map(a=>a.id),p_enabled_module_keys:["planning","performances","session_feedback","wellness","training_load","health","messaging","reports"]}),
  ]);
  check("30 matrices modules configurées en 3 opérations de groupe",moduleBatches.every(result=>!result.error));

  const groupSession=await coach.client.rpc("create_session_with_athletes",{p_session:{title:"Sprint groupe",sessionDate:"2027-05-03",day:"Lundi",week:18,time:"18:00",type:"Sprint",category:"sprint",trainingFocus:"acceleration",durationMinutes:75,loadWeight:1,targetGroup:"Sprint"},p_athlete_ids:sprint.map(a=>a.id),p_idempotency_key:crypto.randomUUID()});
  const individualSession=await coach.client.rpc("create_session_with_athletes",{p_session:{title:"Technique individuelle",sessionDate:"2027-05-04",day:"Mardi",week:18,time:"16:00",type:"Technique",category:"technique",trainingFocus:"technical_general",durationMinutes:45,loadWeight:1},p_athlete_ids:[athletes[0].id],p_idempotency_key:crypto.randomUUID()});
  check("séances groupe et individuelle créées sans boucle athlète",!groupSession.error&&!individualSession.error);

  const series=await coach.client.rpc("create_session_series_with_occurrences",{p_series:{title:"Cycle demi-fond",type:"Endurance",category:"endurance",trainingFocus:"endurance_general",durationMinutes:70,time:"17:30",startsOn:"2027-05-05",occurrenceCount:6,intervalWeeks:1,weekdays:[3],targetGroup:"Demi-fond"},p_athlete_ids:demiFond.map(a=>a.id),p_idempotency_key:crypto.randomUUID()});
  const {data:occurrences}=await admin.from("sessions").select("id,session_date").eq("series_id",series.data?.seriesId).order("session_date");
  const exception=await coach.client.rpc("update_recurring_session",{p_session_id:occurrences?.[1]?.id,p_scope:"single",p_patch:{title:"Test VMA — exception"},p_athlete_ids:demiFond.map(a=>a.id)});
  check("série de groupe et exception réelle conservées",!series.error&&series.data?.occurrenceCount===6&&!exception.error);

  const competition=await coach.client.rpc("create_competition_with_athletes",{p_name:"Meeting Scale",p_date:"2027-06-12",p_location:"Bruxelles",p_type:"importante",p_athlete_entries:sprint.map(a=>({athleteId:a.id,plannedEvent:"100 m"})),p_idempotency_key:crypto.randomUUID()});
  const stage=await coach.client.rpc("upsert_planning_event_with_athletes",{p_event_id:null,p_event:{kind:"stage",name:"Stage collectif",startsOn:"2027-07-01",endsOn:"2027-07-07",location:"Spa",targetGroup:"Sauts"},p_athlete_ids:sauts.map(a=>a.id)});
  check("compétition et stage affectés en batch",!competition.error&&!stage.error);

  const feedbackUpdate=await linkedAthlete.client.from("session_athletes").update({status:"done",rpe:6,actual_duration_minutes:75,duration_source:"reported",comment:"Bonne séance"}).eq("session_id",groupSession.data?.sessionId).eq("athlete_id",sprint[0].id);
  if(feedbackUpdate.error)throw feedbackUpdate.error;
  await insert("messages",{sender_id:coach.user.id,receiver_id:athleteUsers[0].id,content:"Message scénario 30 athlètes"});
  await insert("alerts",{club_id:club.id,type:"wellness",title:"Alerte scénario scale",athlete_id:sauts[0].id});

  const storagePath=`${club.id}/${runId}-scale-programme.pdf`,bytes=Buffer.from("%PDF-1.4\n%scale\n");
  const uploaded=await coach.client.storage.from("session-pdfs").upload(storagePath,bytes,{contentType:"application/pdf"});
  if(uploaded.error)throw uploaded.error;storagePaths.push(storagePath);
  const registered=await coach.client.rpc("register_training_document",{p_name:"Programme commun.pdf",p_storage_path:storagePath,p_mime_type:"application/pdf",p_size_bytes:bytes.length,p_category:"Entraînement",p_tags:["scale"]});
  if(registered.error)throw registered.error;
  const publications=await Promise.all([
    coach.client.rpc("publish_session_documents",{p_session_id:groupSession.data.sessionId,p_document_ids:[registered.data.id],p_athlete_ids:null,p_notification_key:`scale-session-${runId}`}),
    coach.client.rpc("publish_series_documents",{p_series_id:series.data.seriesId,p_document_ids:[registered.data.id],p_notification_key:`scale-series-${runId}`}),
    coach.client.rpc("publish_planning_event_documents",{p_event_id:stage.data.eventId,p_document_ids:[registered.data.id],p_notification_key:`scale-stage-${runId}`}),
  ]);
  check("un document physique distribué aux séances, série et stage",publications.every(result=>!result.error));

  const [sessions,assignments,events,competitions,feedbacks,messages,alerts,documents,moduleRows,notifications,objects]=await Promise.all([
    admin.from("sessions").select("id,source_kind,target_group,series_id").eq("club_id",club.id),
    admin.from("session_athletes").select("session_id,athlete_id").in("athlete_id",athletes.map(a=>a.id)),
    admin.from("planning_events").select("id,planning_event_athletes(athlete_id),planning_event_documents(document_id)").eq("club_id",club.id),
    admin.from("competitions").select("id,competition_athletes(athlete_id)").eq("club_id",club.id),
    admin.from("session_athletes").select("athlete_id").in("athlete_id",athletes.map(a=>a.id)).eq("rpe",6),
    admin.from("messages").select("id").eq("sender_id",coach.user.id),
    admin.from("alerts").select("id").eq("club_id",club.id),
    admin.from("documents").select("id").eq("club_id",club.id),
    admin.from("athlete_modules").select("athlete_id,module_key,enabled").eq("club_id",club.id),
    admin.from("athlete_notifications").select("athlete_id,type").eq("club_id",club.id).eq("type","training_document"),
    admin.storage.from("session-pdfs").list(String(club.id),{search:String(runId)}),
  ]);
  check("lecture planning scalable en requêtes batch",!sessions.error&&!assignments.error&&sessions.data.length===8&&assignments.data.length===71,`${sessions.data?.length} séances, ${assignments.data?.length} affectations`);
  check("les trois groupes et l’exception ont une provenance",sessions.data.some(row=>row.source_kind==="group")&&sessions.data.some(row=>row.source_kind==="group_series")&&sessions.data.some(row=>row.source_kind==="exception"));
  check("30 athlètes gardent des modules réellement différents",!moduleRows.error&&new Set(athletes.map(athlete=>moduleRows.data.filter(row=>row.athlete_id===athlete.id&&row.enabled).map(row=>row.module_key).sort().join("|"))).size===3);
  const operationalCounts={stageAthletes:events.data?.[0]?.planning_event_athletes.length??0,competitionAthletes:competitions.data?.[0]?.competition_athletes.length??0,feedbacks:feedbacks.data?.length??0,messages:messages.data?.length??0,alerts:alerts.data?.length??0,documents:documents.data?.length??0};
  check("objets opérationnels présents dans le même club",operationalCounts.stageAthletes===10&&operationalCounts.competitionAthletes===10&&operationalCounts.feedbacks===1&&operationalCounts.messages===1&&operationalCounts.alerts===1&&operationalCounts.documents===1,JSON.stringify(operationalCounts));
  check("aucune duplication Storage malgré les multiples usages",!objects.error&&objects.data.filter(object=>object.name.includes(String(runId))).length===1);
  check("notifications documentaires limitées aux groupes concernés",!notifications.error&&new Set(notifications.data.map(row=>row.athlete_id)).size===30);
} finally {
  if(storagePaths.length)await admin.storage.from("session-pdfs").remove(storagePaths).catch(()=>{});
  if(club)await admin.from("clubs").delete().eq("id",club.id);
  for(const id of authIds)await admin.auth.admin.deleteUser(id).catch(()=>{});
}
const failures=checks.filter(result=>!result.pass);
console.log(`\n${checks.length-failures.length}/${checks.length} validations scalabilité 30 athlètes OK`);
if(failures.length)process.exit(1);
