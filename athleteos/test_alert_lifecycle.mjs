#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
try { for(const raw of readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),".env"),"utf8").split("\n")){const m=raw.replace(/\r$/u,"").match(/^([A-Z0-9_]+)=(.*)$/u);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim();} } catch { /* CI */ }
const url=process.env.VITE_SUPABASE_URL,anon=process.env.VITE_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!anon||!service)throw new Error("Variables Supabase locales manquantes.");
const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}}),runId=Date.now(),authIds=[],checks=[];
const check=(name,pass,detail="")=>{checks.push({name,pass});console.log(`${pass?"✓":"✗"} ${name}${detail?` — ${detail}`:""}`);};
async function insert(table,value){const {data,error}=await admin.from(table).insert(value).select().single();if(error)throw error;return data;}
async function account(clubId,role,label){const email=`alert-${label}-${runId}@example.invalid`,password=`Alert-${runId}-Aa!`;const auth=await admin.auth.admin.createUser({email,password,email_confirm:true});if(auth.error)throw auth.error;authIds.push(auth.data.user.id);const user=await insert("users",{club_id:clubId,role,name:label,email,auth_uid:auth.data.user.id});const client=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;return{user,client};}
let clubA,clubB;
try{
  clubA=await insert("clubs",{name:`Alert A ${runId}`});clubB=await insert("clubs",{name:`Alert B ${runId}`});
  const coach1=await account(clubA.id,"head_coach","coach-1"),coach2=await account(clubA.id,"coach","coach-2"),other=await account(clubB.id,"head_coach","other");
  const created=await coach1.client.from("alerts").insert({club_id:clubA.id,type:"charge",title:"À traiter",description:"Test",severity:"info",is_read:false}).select().single();
  if(created.error)throw created.error;const alertId=created.data.id;
  const read=await coach1.client.rpc("mark_alerts_read",{p_alert_ids:[alertId]});
  const state1=await coach1.client.from("alert_read_states").select("alert_id").eq("alert_id",alertId);
  const state2=await coach2.client.from("alert_read_states").select("alert_id").eq("alert_id",alertId);
  check("lecture personnelle au coach",!read.error&&state1.data.length===1&&state2.data.length===0,read.error?.message);
  const resolved=await coach2.client.rpc("set_alert_resolution",{p_alert_id:alertId,p_resolved:true,p_archived:false});
  const visibleResolved=await coach1.client.from("alerts").select("resolved_at,archived_at").eq("id",alertId).single();
  check("résolution métier partagée sans suppression",!resolved.error&&!!visibleResolved.data.resolved_at&&!visibleResolved.data.archived_at,resolved.error?.message);
  const archived=await coach1.client.rpc("set_alert_resolution",{p_alert_id:alertId,p_resolved:true,p_archived:true});
  const history=await coach2.client.from("alerts").select("archived_at").eq("id",alertId).single();
  check("archivage conservé dans l’historique",!archived.error&&!!history.data.archived_at,archived.error?.message);
  const forbidden=await other.client.rpc("set_alert_resolution",{p_alert_id:alertId,p_resolved:false,p_archived:false});
  check("autre club ne peut pas modifier l’alerte",!!forbidden.error,forbidden.error?"refusé, OK":"AUTORISÉ");
}finally{if(clubA)await admin.from("clubs").delete().eq("id",clubA.id);if(clubB)await admin.from("clubs").delete().eq("id",clubB.id);for(const id of authIds)await admin.auth.admin.deleteUser(id).catch(()=>{});}
const failed=checks.filter(item=>!item.pass);console.log(`\n${checks.length-failed.length}/${checks.length} validations alertes OK`);if(failed.length)process.exit(1);
