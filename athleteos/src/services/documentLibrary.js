import { supabase } from "../utils/supabaseClient";
import { removeSessionAttachment, uploadSessionAttachment, validateSessionAttachment } from "../utils/storage";

export async function runDocumentUploadQueue(files, { upload, concurrency = 4, onProgress = () => {} }) {
  const entries = files.map((file, index) => ({ index, file, status:"waiting", result:null, error:null }));
  let cursor = 0;
  const emit = () => onProgress(entries.map(entry => ({ ...entry })));
  emit();

  async function worker() {
    while (cursor < entries.length) {
      const index = cursor++;
      const entry = entries[index];
      entry.status = "uploading";
      emit();
      try {
        entry.result = await upload(entry.file, index);
        entry.status = "done";
      } catch (error) {
        entry.error = error;
        entry.status = "error";
      }
      emit();
    }
  }

  await Promise.all(Array.from({ length:Math.min(Math.max(1, concurrency), entries.length) }, worker));
  return entries;
}

export async function listClubDocuments(clubId) {
  if (!clubId) return [];
  const { data, error } = await supabase.from("documents").select("*")
    .eq("club_id", clubId).order("created_at", { ascending:false });
  if (error) throw error;
  return (data ?? []).map(mapDocument);
}

export function mapDocument(row) {
  if (!row) return null;
  return {
    id:row.id,
    name:row.name,
    storagePath:row.storage_path,
    mimeType:row.mime_type,
    sizeBytes:Number(row.size_bytes ?? 0),
    category:row.category,
    tags:row.tags ?? [],
    createdAt:row.created_at,
  };
}

export async function uploadLibraryDocument({ clubId, file, category = null }) {
  const validationError = await validateSessionAttachment(file);
  if (validationError) throw new Error(validationError);
  const storagePath = await uploadSessionAttachment(clubId, file);
  const { data, error } = await supabase.rpc("register_training_document", {
    p_name:file.name, p_storage_path:storagePath,
    p_mime_type:file.type || "application/octet-stream", p_size_bytes:file.size,
    p_category:category || null, p_tags:[],
  });
  if (error) {
    await removeSessionAttachment(storagePath).catch(() => {});
    throw error;
  }
  return mapDocument(data);
}

export async function publishSessionDocuments({ sessionId, documentIds, athleteIds = null, notificationKey }) {
  const { data, error } = await supabase.rpc("publish_session_documents", {
    p_session_id:sessionId,
    p_document_ids:[...new Set((documentIds ?? []).map(Number))],
    p_athlete_ids:athleteIds?.length ? [...new Set(athleteIds.map(Number))] : null,
    p_notification_key:notificationKey,
  });
  if (error) throw error;
  return data;
}

export function buildSessionDocumentDistribution(documents = []) {
  const unique = new Map();
  documents.forEach(document => {
    const documentId = Number(document?.id);
    if (!Number.isInteger(documentId) || documentId <= 0) return;
    const athleteIds = document.visibility === "selected"
      ? [...new Set((document.athleteIds ?? []).map(Number).filter(Number.isInteger))]
      : null;
    unique.set(documentId, { documentId, athleteIds });
  });
  return [...unique.values()];
}

export async function publishSessionDocumentDistribution({ sessionId, documents, notificationKey }) {
  const { data, error } = await supabase.rpc("publish_session_document_distribution", {
    p_session_id:sessionId,
    p_distribution:buildSessionDocumentDistribution(documents),
    p_notification_key:notificationKey,
  });
  if (error) throw error;
  return data;
}
