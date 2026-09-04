#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

function loadDotEnv(filePath) {
  try {
    for (const raw of readFileSync(filePath, "utf8").split("\n")) {
      const match = raw.replace(/\r$/u, "").match(/^([A-Z0-9_]+)=(.*)$/u);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
    }
  } catch { /* variables fournies par l'environnement */ }
}
loadDotEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("Variables Supabase locales manquantes.");

const admin = createClient(url, serviceKey, { auth:{ autoRefreshToken:false, persistSession:false } });
const runId = Date.now();
const checks = [];
const authUsers = [];
const storagePaths = [];
const check = (name, pass, detail = "") => {
  checks.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
async function insert(table, value) {
  const { data, error } = await admin.from(table).insert(value).select().single();
  if (error) throw error;
  return data;
}
async function account(clubId, role, label) {
  const email = `docs-${label}-${runId}@example.invalid`;
  const password = `Docs-${runId}-Aa!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm:true });
  if (error) throw error;
  authUsers.push(data.user.id);
  const user = await insert("users", { club_id:clubId, role, name:label, email, auth_uid:data.user.id });
  const client = createClient(url, anonKey, { auth:{ autoRefreshToken:false, persistSession:false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { user, client };
}
async function createSession(client, athleteIds, dayOffset, title) {
  const date = new Date(Date.UTC(2026, 8, 10 + dayOffset)).toISOString().slice(0, 10);
  const { data, error } = await client.rpc("create_session_with_athletes", {
    p_session:{ title, sessionDate:date, day:"Jeudi", week:37, time:"10:00", type:"Sprint", category:"sprint", trainingFocus:"acceleration", durationMinutes:60, loadWeight:1 },
    p_athlete_ids:athleteIds,
    p_idempotency_key:crypto.randomUUID(),
  });
  if (error) throw error;
  return data.sessionId;
}
async function addDocument(coach, clubId, name) {
  const storagePath = `${clubId}/${runId}-${name}.pdf`;
  const bytes = Buffer.from("%PDF-1.4\n%AthleteOS integration\n", "utf8");
  const uploaded = await coach.client.storage.from("session-pdfs").upload(storagePath, bytes, { contentType:"application/pdf" });
  if (uploaded.error) throw uploaded.error;
  storagePaths.push(storagePath);
  const { data, error } = await coach.client.rpc("register_training_document", { p_name:`${name}.pdf`, p_storage_path:storagePath, p_mime_type:"application/pdf", p_size_bytes:bytes.length, p_category:"Entraînement", p_tags:[] });
  if (error) throw error;
  return data;
}

let clubA;
let clubB;
try {
  clubA = await insert("clubs", { name:`Docs club A ${runId}` });
  clubB = await insert("clubs", { name:`Docs club B ${runId}` });
  const coach = await account(clubA.id, "head_coach", "coach-a");
  const assignedAccount = await account(clubA.id, "athlete", "assigned-a");
  const unassignedAccount = await account(clubA.id, "athlete", "unassigned-a");
  const otherClubAccount = await account(clubB.id, "athlete", "athlete-b");
  const assignedAthlete = await insert("athletes", { club_id:clubA.id, name:"Assigned 1", group_name:"Sprint", user_id:assignedAccount.user.id });
  const unassignedAthlete = await insert("athletes", { club_id:clubA.id, name:"Unassigned", user_id:unassignedAccount.user.id });
  await insert("athletes", { club_id:clubB.id, name:"Other club", user_id:otherClubAccount.user.id });
  const synthetic = [];
  for (let index = 2; index <= 30; index += 1) synthetic.push({ club_id:clubA.id, name:`Assigned ${index}`, group_name:index <= 10 ? "Sprint" : "Fond" });
  const { data:syntheticRows, error:syntheticError } = await admin.from("athletes").insert(synthetic).select("id, group_name");
  if (syntheticError) throw syntheticError;
  const athleteIds = [assignedAthlete.id, ...syntheticRows.map(row => row.id)];
  const sprintIds = [assignedAthlete.id, ...syntheticRows.filter(row => row.group_name === "Sprint").map(row => row.id)];

  const document = await addDocument(coach, clubA.id, "sprint-s4");
  const sessionOne = await createSession(coach.client, [assignedAthlete.id], 0, "Document individuel");
  const one = await coach.client.rpc("publish_session_documents", { p_session_id:sessionOne, p_document_ids:[document.id], p_athlete_ids:null, p_notification_key:`one-${runId}` });
  check("1 document → 1 athlète", !one.error && one.data?.recipientCount === 1 && one.data?.associationCount === 1, one.error?.message);

  const sessionThirty = await createSession(coach.client, athleteIds, 1, "Document collectif");
  const thirty = await coach.client.rpc("publish_session_documents", { p_session_id:sessionThirty, p_document_ids:[document.id], p_athlete_ids:null, p_notification_key:`thirty-${runId}` });
  check("1 document → 30 athlètes en un RPC", !thirty.error && thirty.data?.recipientCount === 30 && thirty.data?.associationCount === 30, thirty.error?.message);

  const sessionGroup = await createSession(coach.client, sprintIds, 2, "Document groupe Sprint");
  const group = await coach.client.rpc("publish_session_documents", { p_session_id:sessionGroup, p_document_ids:[document.id], p_athlete_ids:null, p_notification_key:`group-${runId}` });
  check("1 document → groupe", !group.error && group.data?.recipientCount === sprintIds.length, group.error?.message);

  const document2 = await addDocument(coach, clubA.id, "technique");
  const document3 = await addDocument(coach, clubA.id, "programme");
  const multi = await coach.client.rpc("publish_session_document_distribution", {
    p_session_id:sessionGroup,
    p_distribution:[
      { documentId:document.id, athleteIds:null },
      { documentId:document2.id, athleteIds:sprintIds.slice(0, 2) },
      { documentId:document3.id, athleteIds:sprintIds.slice(-3) },
    ],
    p_notification_key:`multi-${runId}`,
  });
  const { data:recipientRows, error:recipientRowsError } = await admin.from("session_document_recipients")
    .select("document_id, athlete_id").eq("session_id", sessionGroup);
  check("plusieurs documents → ciblages différents en un batch", !multi.error && !recipientRowsError
    && multi.data?.documentCount === 3 && multi.data?.associationCount === sprintIds.length + 5
    && recipientRows.filter(row => row.document_id === document2.id).length === 2
    && recipientRows.filter(row => row.document_id === document3.id).length === 3,
  multi.error?.message ?? recipientRowsError?.message);
  const athleteLinks = await assignedAccount.client.from("session_documents")
    .select("document_id").eq("session_id", sessionGroup);
  const athleteRecipientRows = await assignedAccount.client.from("session_document_recipients")
    .select("document_id, athlete_id").eq("session_id", sessionGroup);
  check("les liens et destinataires restent cloisonnés par athlète", !athleteLinks.error && !athleteRecipientRows.error
    && athleteLinks.data.length === 2
    && athleteLinks.data.every(link => [document.id, document2.id].includes(link.document_id))
    && athleteRecipientRows.data.length === 1
    && athleteRecipientRows.data[0].athlete_id === assignedAthlete.id,
  athleteLinks.error?.message ?? athleteRecipientRows.error?.message);

  const { data:objects } = await admin.storage.from("session-pdfs").list(String(clubA.id), { limit:100, search:String(runId) });
  check("aucun doublon physique dans Storage", (objects ?? []).filter(object => object.name.startsWith(String(runId))).length === 3, `${objects?.length ?? 0} objet(s)`);

  const immediate = await assignedAccount.client.from("documents").select("id").eq("id", document.id).maybeSingle();
  const signed = await assignedAccount.client.storage.from("session-pdfs").createSignedUrl(document.storage_path, 60);
  check("accès athlète immédiat après publication", !immediate.error && immediate.data?.id === document.id && !signed.error, immediate.error?.message ?? signed.error?.message);

  const unassignedRead = await unassignedAccount.client.from("documents").select("id").eq("id", document.id);
  const unassignedSigned = await unassignedAccount.client.storage.from("session-pdfs").createSignedUrl(document.storage_path, 60);
  check("athlète non assigné refusé", !unassignedRead.error && unassignedRead.data.length === 0 && !!unassignedSigned.error);
  const otherRead = await otherClubAccount.client.from("documents").select("id").eq("id", document.id);
  const otherSigned = await otherClubAccount.client.storage.from("session-pdfs").createSignedUrl(document.storage_path, 60);
  check("autre club refusé", !otherRead.error && otherRead.data.length === 0 && !!otherSigned.error);

  const { count:targetNotifications } = await admin.from("athlete_notifications").select("id", { count:"exact", head:true }).eq("type", "training_document").in("athlete_id", athleteIds);
  const { count:unassignedNotifications } = await admin.from("athlete_notifications").select("id", { count:"exact", head:true }).eq("type", "training_document").eq("athlete_id", unassignedAthlete.id);
  check("notifications uniquement aux destinataires", targetNotifications > 0 && unassignedNotifications === 0, `${targetNotifications} destinataire(s), ${unassignedNotifications} hors cible`);

  const stageDocument = await addDocument(coach, clubA.id, "stage-tenerife");
  const stage = await coach.client.rpc("upsert_planning_event_with_athletes", {
    p_event_id:null,
    p_event:{ kind:"stage", name:"Stage Tenerife", startsOn:"2027-04-12", endsOn:"2027-04-18", location:"Tenerife" },
    p_athlete_ids:sprintIds,
  });
  const stagePublish = await coach.client.rpc("publish_planning_event_documents", {
    p_event_id:stage.data?.eventId, p_document_ids:[stageDocument.id], p_notification_key:`stage-${runId}`,
  });
  const stageRead = await assignedAccount.client.from("documents").select("id").eq("id", stageDocument.id).maybeSingle();
  const stageSigned = await assignedAccount.client.storage.from("session-pdfs").createSignedUrl(stageDocument.storage_path, 60);
  const stageDenied = await unassignedAccount.client.from("documents").select("id").eq("id", stageDocument.id);
  const { count:stageNotifications } = await admin.from("athlete_notifications").select("id", { count:"exact", head:true })
    .eq("type", "training_document").eq("dedupe_key", `event-documents-${stage.data?.eventId}-stage-${runId}`);
  check("document de stage → groupe en un batch sécurisé", !stage.error && !stagePublish.error
    && stagePublish.data?.recipientCount === sprintIds.length && stageRead.data?.id === stageDocument.id
    && !stageSigned.error && stageDenied.data?.length === 0 && stageNotifications === sprintIds.length,
  stage.error?.message ?? stagePublish.error?.message ?? stageRead.error?.message);
} finally {
  if (storagePaths.length) await admin.storage.from("session-pdfs").remove(storagePaths).catch(() => {});
  if (clubA) await admin.from("clubs").delete().eq("id", clubA.id);
  if (clubB) await admin.from("clubs").delete().eq("id", clubB.id);
  for (const id of authUsers) await admin.auth.admin.deleteUser(id).catch(() => {});
}

const failures = checks.filter(result => !result.pass);
console.log(`\n${checks.length - failures.length}/${checks.length} validations documentaires OK`);
if (failures.length) process.exit(1);
