import { generateKeyPairSync } from "node:crypto";

// Paire P-256 éphémère, exclusivement destinée à l'instance Supabase
// jetable du pipeline. Rien n'est enregistré et aucune clé de production
// n'est lue.
const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const publicJwk = publicKey.export({ format: "jwk" });
const privateJwk = privateKey.export({ format: "jwk" });

if (!publicJwk.x || !publicJwk.y || !privateJwk.d) {
  throw new Error("Impossible de générer la paire VAPID de test.");
}

const publicBytes = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(publicJwk.x, "base64url"),
  Buffer.from(publicJwk.y, "base64url"),
]);

console.log(`VAPID_PUBLIC_KEY=${publicBytes.toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${privateJwk.d}`);
