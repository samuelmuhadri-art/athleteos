#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

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
async function account(clubId,role,label){const email=`planning-${label}-${runId}@example.invalid`,password=`Planning-${runId}-Aa!`;const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;authIds.push(created.data.user.id);const user=await insert("users",{club_id:clubId,role,name:label,email,auth_uid:created.data.user.id});const client=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;return{user,client};}
async function session(client,athleteIds,date,title="Séance source"){const result=await client.rpc("create_session_with_athletes",{p_session:{title,sessionDate:date,day:"Lundi",week:5,time:"09:00",type:"Sprint",category:"sprint",trainingFocus:"acceleration",durationMinutes:60,loadWeight:1,description:"Contenu"},p_athlete_ids:athleteIds,p_idempotency_key:crypto.randomUUID()});if(result.error)throw result.error;return result.data.sessionId;}

let clubA,clubB;
try {
  clubA=await insert("clubs",{name:`Planning A ${runId}`}); clubB=await insert("clubs",{name:`Planning B ${runId}`});
  const coach=await account(clubA.id,"head_coach","coach");
  const assistantCoach=await account(clubA.id,"coach","assistant");
  const athleteAccount=await account(clubA.id,"athlete","assigned");
  const unassignedAccount=await account(clubA.id,"athlete","unassigned");
  const otherAccount=await account(clubB.id,"athlete","other");
  const a1=await insert("athletes",{club_id:clubA.id,name:"Athlète 1",group_name:"Sprint",user_id:athleteAccount.user.id});
  const a2=await insert("athletes",{club_id:clubA.id,name:"Athlète 2",group_name:"Sprint"});
  await insert("athletes",{club_id:clubA.id,name:"Non assigné",user_id:unassignedAccount.user.id});
  await insert("athletes",{club_id:clubB.id,name:"Autre club",user_id:otherAccount.user.id});

  const createdSeries=await coach.client.rpc("create_session_series_with_occurrences",{p_series:{title:"Série sprint",type:"Sprint",category:"sprint",trainingFocus:"acceleration",durationMinutes:60,time:"10:00",startsOn:"2027-01-04",occurrenceCount:4,intervalWeeks:1,weekdays:[1,3],targetGroup:"Sprint"},p_athlete_ids:[a1.id,a2.id],p_idempotency_key:crypto.randomUUID()});
  check("récurrence multi-jours créée atomiquement",!createdSeries.error&&createdSeries.data?.occurrenceCount===4,createdSeries.error?.message);
  const seriesId=createdSeries.data?.seriesId;
  let {data:occurrences}=await admin.from("sessions").select("id,title,session_date,source_kind").eq("series_id",seriesId).order("session_date");
  check("occurrences datées sans doublon",occurrences?.length===4&&new Set(occurrences.map(row=>row.session_date)).size===4);

  const a3=await insert("athletes",{club_id:clubA.id,name:"Athlète ajouté",group_name:"Sprint"});
  const refreshed=await coach.client.rpc("refresh_series_group_members",{p_series_id:seriesId,p_from_date:"2027-01-01"});
  const {count:newMemberLinks}=await admin.from("session_athletes").select("session_id",{count:"exact",head:true}).eq("athlete_id",a3.id).in("session_id",occurrences.map(row=>row.id));
  check("un nouveau membre du groupe rejoint seulement les occurrences futures",!refreshed.error&&newMemberLinks===4,refreshed.error?.message);

  const updated=await coach.client.rpc("update_recurring_session",{p_session_id:occurrences[1].id,p_scope:"future",p_patch:{title:"Série sprint ajustée"},p_athlete_ids:[a1.id,a2.id,a3.id]});
  const {data:titles}=await admin.from("sessions").select("id,title").eq("series_id",seriesId).order("session_date");
  check("édition « celle-ci et suivantes » respecte la portée",!updated.error&&titles[0].title==="Série sprint"&&titles.slice(1).every(row=>row.title==="Série sprint ajustée"),updated.error?.message);

  const singleException=await coach.client.rpc("update_recurring_session",{p_session_id:occurrences[0].id,p_scope:"single",p_patch:{title:"Exception technique"},p_athlete_ids:[a1.id,a2.id,a3.id]});
  const {data:exceptionRow}=await admin.from("sessions").select("source_kind,title,session_athletes(athlete_id)").eq("id",occurrences[0].id).single();
  check("exception individuelle ne modifie qu’une occurrence",!singleException.error&&exceptionRow.source_kind==="exception"&&exceptionRow.title==="Exception technique"&&exceptionRow.session_athletes.length===3,singleException.error?.message);

  const feedbackUpdate=await athleteAccount.client.from("session_athletes").update({status:"done",rpe:6,actual_duration_minutes:60,duration_source:"reported",feedback_submitted_at:new Date().toISOString()}).eq("session_id",occurrences[0].id).eq("athlete_id",a1.id);
  const deleted=await coach.client.rpc("delete_recurring_session",{p_session_id:occurrences[0].id,p_scope:"all"});
  const {data:preserved}=await admin.from("sessions").select("id").eq("series_id",seriesId);
  check("suppression de série préserve l’historique avec feedback",!feedbackUpdate.error&&!deleted.error&&preserved.length===1&&preserved[0].id===occurrences[0].id,feedbackUpdate.error?.message??deleted.error?.message??JSON.stringify({deleted:deleted.data,preserved}));

  const sourceId=await session(coach.client,[a1.id,a2.id],"2027-02-01");
  await admin.from("session_athletes").update({comment:"source uniquement"}).eq("session_id",sourceId).eq("athlete_id",a1.id);
  const duplicate=await coach.client.rpc("duplicate_session_transactional",{p_session_id:sourceId,p_session_date:"2027-02-08",p_athlete_ids:[a1.id,a2.id]});
  const {data:duplicateLinks}=await admin.from("session_athletes").select("comment,rpe").eq("session_id",duplicate.data?.sessionId);
  check("duplication conserve le contenu mais pas les feedbacks",!duplicate.error&&duplicateLinks.length===2&&duplicateLinks.every(row=>row.comment==null&&row.rpe==null),duplicate.error?.message);

  const groupSession=await coach.client.rpc("create_session_with_athletes",{p_session:{title:"Groupe Sprint",sessionDate:"2027-02-20",day:"Samedi",week:7,time:"15:00",type:"Sprint",category:"sprint",trainingFocus:"acceleration",durationMinutes:50,loadWeight:1,targetGroup:"Sprint"},p_athlete_ids:[a1.id,a2.id,a3.id],p_idempotency_key:crypto.randomUUID()});
  const {data:groupRow}=await admin.from("sessions").select("source_kind,target_group").eq("id",groupSession.data?.sessionId).single();
  check("séance de groupe conserve sa provenance",!groupSession.error&&groupRow.source_kind==="group"&&groupRow.target_group==="Sprint",groupSession.error?.message);

  const template=await coach.client.rpc("save_session_template",{p_name:"Sprint type",p_session_id:sourceId});
  const fromTemplate=await coach.client.rpc("create_session_from_template",{p_template_id:template.data,p_schedule:{sessionDate:"2027-02-15",day:"Lundi",week:7,time:"11:00"},p_athlete_ids:[a1.id],p_idempotency_key:crypto.randomUUID()});
  const {data:templated}=await admin.from("sessions").select("title,source_kind").eq("id",fromTemplate.data?.sessionId).single();
  check("modèle de séance réutilisable",!template.error&&!fromTemplate.error&&templated.source_kind==="template"&&templated.title==="Séance source",fromTemplate.error?.message);

  const personalTemplate=await coach.client.rpc("upsert_session_template",{p_template_id:null,p_template:{name:"Prépa personnelle",title:"Départs personnels",category:"sprint",type:"Sprint",trainingFocus:"acceleration",durationMinutes:45,description:"4 × 30 m",scope:"personal",tags:["départs","100 m"]},p_document_ids:[]});
  const personalId=personalTemplate.data?.templateId;
  const assistantPersonalView=await assistantCoach.client.from("session_templates").select("id").eq("id",personalId);
  const assistantPersonalDuplicate=await assistantCoach.client.rpc("duplicate_session_template",{p_template_id:personalId,p_name:"Copie interdite",p_scope:"personal"});
  check("modèle personnel invisible aux autres coachs",!personalTemplate.error&&assistantPersonalView.data?.length===0&&!!assistantPersonalDuplicate.error,personalTemplate.error?.message??assistantPersonalView.error?.message);

  const clubTemplate=await coach.client.rpc("upsert_session_template",{p_template_id:null,p_template:{name:"Technique club",title:"Rythme haies",category:"haies",type:"Haies",trainingFocus:"hurdles_rhythm",durationMinutes:55,description:"Passages techniques",scope:"club",tags:["haies"]},p_document_ids:[]});
  const clubTemplateId=clubTemplate.data?.templateId;
  const assistantClubView=await assistantCoach.client.from("session_templates").select("id,scope,tags").eq("id",clubTemplateId);
  const assistantCopy=await assistantCoach.client.rpc("duplicate_session_template",{p_template_id:clubTemplateId,p_name:"Technique club — copie",p_scope:"personal"});
  const assistantEditOther=await assistantCoach.client.rpc("upsert_session_template",{p_template_id:clubTemplateId,p_template:{name:"Technique club modifiée",title:"Rythme haies",category:"haies",type:"Haies",trainingFocus:"hurdles_rhythm",durationMinutes:60,scope:"club",tags:[]},p_document_ids:[]});
  check("modèle club visible et duplicable sans devenir modifiable par tous",!clubTemplate.error&&assistantClubView.data?.length===1&&!assistantCopy.error&&!!assistantEditOther.error,clubTemplate.error?.message??assistantClubView.error?.message??assistantCopy.error?.message);

  const headEdit=await coach.client.rpc("upsert_session_template",{p_template_id:clubTemplateId,p_template:{name:"Technique club",title:"Rythme haies ajusté",category:"haies",type:"Haies",trainingFocus:"hurdles_rhythm",durationMinutes:60,scope:"club",tags:["haies","rythme"]},p_document_ids:[]});
  const headDelete=await coach.client.rpc("delete_session_template",{p_template_id:clubTemplateId});
  check("head coach administre les modèles partagés",!headEdit.error&&!headDelete.error,headEdit.error?.message??headDelete.error?.message);

  const event=await coach.client.rpc("upsert_planning_event_with_athletes",{p_event_id:null,p_event:{kind:"stage",name:"Stage national",startsOn:"2027-03-01",endsOn:"2027-03-03",time:"08:30",location:"Namur",targetGroup:"Sprint"},p_athlete_ids:[a1.id,a2.id]});
  const assignedView=await athleteAccount.client.from("planning_events").select("id").eq("id",event.data?.eventId);
  const unassignedView=await unassignedAccount.client.from("planning_events").select("id").eq("id",event.data?.eventId);
  const otherView=await otherAccount.client.from("planning_events").select("id").eq("id",event.data?.eventId);
  check("stage visible uniquement aux athlètes assignés",!event.error&&assignedView.data?.length===1&&unassignedView.data?.length===0&&otherView.data?.length===0,event.error?.message??assignedView.error?.message);

  const competition=await coach.client.rpc("create_competition_with_athletes",{p_name:"Meeting",p_date:"2027-04-01",p_location:"Liège",p_type:"préparation",p_athlete_entries:[{athleteId:a1.id,plannedEvent:"100m"}],p_idempotency_key:crypto.randomUUID()});
  const competitionId=competition.data?.competitionId;
  const competitionUpdate=await coach.client.rpc("update_competition_with_athletes",{p_competition_id:competitionId,p_name:"Meeting édité",p_date:"2027-04-02",p_location:"Bruxelles",p_type:"objectif A",p_notes:"Bloc A",p_athlete_entries:[{athleteId:a1.id,plannedEvent:"200m"},{athleteId:a2.id,plannedEvent:"100m"}]});
  const {data:editedCompetition}=await admin.from("competitions").select("name,date,notes,competition_athletes(athlete_id)").eq("id",competitionId).single();
  const competitionDelete=await coach.client.rpc("delete_competition_transactional",{p_competition_id:competitionId});
  const {data:afterDelete}=await admin.from("competitions").select("id").eq("id",competitionId);
  check("CRUD compétition complet",!competition.error&&!competitionUpdate.error&&editedCompetition.name==="Meeting édité"&&editedCompetition.competition_athletes.length===2&&!competitionDelete.error&&afterDelete.length===0,competitionUpdate.error?.message??competitionDelete.error?.message);
} finally {
  if(clubA)await admin.from("clubs").delete().eq("id",clubA.id);
  if(clubB)await admin.from("clubs").delete().eq("id",clubB.id);
  for(const id of authIds)await admin.auth.admin.deleteUser(id).catch(()=>{});
}
const failed=checks.filter(result=>!result.pass);console.log(`\n${checks.length-failed.length}/${checks.length} validations planning OK`);if(failed.length)process.exit(1);
