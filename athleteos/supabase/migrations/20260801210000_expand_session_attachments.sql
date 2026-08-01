BEGIN;

-- Le bucket garde son identifiant historique pour préserver tous les chemins
-- déjà stockés dans sessions.pdf_url. Il devient un bucket de pièces jointes
-- de séance : privé, limité à 30 Mo et restreint aux images/documents usuels.
-- Les policies RLS par club existantes continuent de s'appliquer sans changement.
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 31457280,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/rtf', 'text/plain', 'text/csv'
  ]
WHERE id = 'session-pdfs';

COMMIT;
