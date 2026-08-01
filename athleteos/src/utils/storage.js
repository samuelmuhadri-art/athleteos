// ============================================================
// AthleteOS — pièces jointes privées des séances.
// Le bucket conserve son identifiant historique `session-pdfs` pour ne pas
// casser les fichiers existants, mais accepte désormais plusieurs formats.
// ============================================================

import { supabase } from "./supabaseClient";

const SIGNED_URL_TTL_SECONDS = 60;
export const SESSION_ATTACHMENT_MAX_BYTES = 30 * 1024 * 1024;

const ATTACHMENT_FORMATS = [
  { extensions: ["pdf"], mime: "application/pdf", signature: "pdf" },
  { extensions: ["jpg", "jpeg"], mime: "image/jpeg", signature: "jpeg" },
  { extensions: ["png"], mime: "image/png", signature: "png" },
  { extensions: ["webp"], mime: "image/webp", signature: "webp" },
  { extensions: ["gif"], mime: "image/gif", signature: "gif" },
  { extensions: ["heic"], mime: "image/heic", signature: "heif" },
  { extensions: ["heif"], mime: "image/heif", signature: "heif" },
  { extensions: ["avif"], mime: "image/avif", signature: "avif" },
  { extensions: ["bmp"], mime: "image/bmp", signature: "bmp" },
  { extensions: ["tif", "tiff"], mime: "image/tiff", signature: "tiff" },
  { extensions: ["doc"], mime: "application/msword", signature: "compound" },
  { extensions: ["docx"], mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: "zip" },
  { extensions: ["xls"], mime: "application/vnd.ms-excel", signature: "compound" },
  { extensions: ["xlsx"], mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: "zip" },
  { extensions: ["ppt"], mime: "application/vnd.ms-powerpoint", signature: "compound" },
  { extensions: ["pptx"], mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", signature: "zip" },
  { extensions: ["odt"], mime: "application/vnd.oasis.opendocument.text", signature: "zip" },
  { extensions: ["ods"], mime: "application/vnd.oasis.opendocument.spreadsheet", signature: "zip" },
  { extensions: ["odp"], mime: "application/vnd.oasis.opendocument.presentation", signature: "zip" },
  { extensions: ["rtf"], mime: "application/rtf", signature: "rtf" },
  { extensions: ["txt"], mime: "text/plain", signature: "text" },
  { extensions: ["csv"], mime: "text/csv", signature: "text" },
];

export const SESSION_ATTACHMENT_ACCEPT = ATTACHMENT_FORMATS
  .flatMap(format => format.extensions.map(extension => `.${extension}`))
  .join(",");

const ALLOWED_DECLARED_MIMES = new Set([
  ...ATTACHMENT_FORMATS.map(format => format.mime),
  "application/octet-stream",
  "application/zip",
  "application/csv",
  "text/rtf",
  "image/pjpeg",
]);

function extensionOf(name = "") {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

function startsWith(bytes, expected) {
  return expected.every((value, index) => bytes[index] === value);
}

function hasIsoBrand(bytes, brands) {
  const header = new TextDecoder("latin1").decode(bytes.slice(4, 32));
  return brands.some(brand => header.includes(brand));
}

function hasExpectedSignature(bytes, signature) {
  switch (signature) {
    case "pdf": return new TextDecoder("latin1").decode(bytes).includes("%PDF-");
    case "jpeg": return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "png": return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "webp": return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && new TextDecoder("latin1").decode(bytes.slice(8, 12)) === "WEBP";
    case "gif": return ["GIF87a", "GIF89a"].includes(new TextDecoder("latin1").decode(bytes.slice(0, 6)));
    case "heif": return hasIsoBrand(bytes, ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);
    case "avif": return hasIsoBrand(bytes, ["avif", "avis"]);
    case "bmp": return startsWith(bytes, [0x42, 0x4d]);
    case "tiff": return startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]);
    case "compound": return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "zip": return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
    case "rtf": return new TextDecoder("latin1").decode(bytes.slice(0, 5)) === "{\\rtf";
    case "text": return !bytes.includes(0);
    default: return false;
  }
}

export async function validateSessionAttachment(file) {
  if (!file) return null;
  if (file.size > SESSION_ATTACHMENT_MAX_BYTES) return "Fichier trop volumineux (30 Mo max).";

  const format = ATTACHMENT_FORMATS.find(candidate => candidate.extensions.includes(extensionOf(file.name)));
  if (!format) return "Format non accepté. Utilise une image, un PDF ou un document bureautique.";

  const declaredType = file.type?.toLowerCase();
  if (declaredType && !ALLOWED_DECLARED_MIMES.has(declaredType)) {
    return "Ce type de fichier n'est pas accepté.";
  }

  try {
    const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    if (!hasExpectedSignature(header, format.signature)) return "Le fichier sélectionné semble invalide ou corrompu.";
  } catch {
    return "Impossible de lire le fichier sélectionné.";
  }

  return null;
}

export async function uploadSessionAttachment(clubId, file) {
  if (!clubId) throw new Error("Club introuvable : impossible d'envoyer le fichier.");
  const validationError = await validateSessionAttachment(file);
  if (validationError) throw new Error(validationError);

  const extension = extensionOf(file.name);
  const format = ATTACHMENT_FORMATS.find(candidate => candidate.extensions.includes(extension));
  const uniqueId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${clubId}/${uniqueId}.${extension}`;
  const { error } = await supabase.storage.from("session-pdfs").upload(path, file, {
    contentType: format.mime,
  });
  if (error) throw error;
  return path;
}

export async function openSessionAttachment(path) {
  if (!path) return false;
  const win = window.open("about:blank", "_blank");
  if (win) win.opener = null;
  const { data, error } = await supabase.storage.from("session-pdfs").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("Erreur génération URL de pièce jointe :", error);
    win?.close();
    return false;
  }
  if (win) win.location.replace(data.signedUrl);
  else window.location.assign(data.signedUrl);
  return true;
}

// Compatibilité avec les anciens imports et fichiers PDF déjà enregistrés.
export const validateSessionPdf = validateSessionAttachment;
export const uploadSessionPdf = uploadSessionAttachment;
export const openSessionPdf = openSessionAttachment;
