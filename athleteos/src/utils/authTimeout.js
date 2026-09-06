// Une attente bornée n'annule pas une écriture déjà reçue par le serveur.
// Le message doit donc inviter à vérifier la connexion, pas à recréer un club.
export async function withAuthTimeout(operation, message, milliseconds = 20000) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => { timer = globalThis.setTimeout(() => reject(new Error(message)), milliseconds); }),
    ]);
  } finally { globalThis.clearTimeout(timer); }
}
