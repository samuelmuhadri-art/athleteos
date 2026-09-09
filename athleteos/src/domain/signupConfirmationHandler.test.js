// @vitest-environment node
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const source=stripTypeScriptTypes(readFileSync("supabase/functions/signup/index.ts","utf8").replace(/^import .*;\r?\n/gm,""));
function fixture({required=true,autoconfirm=false,deliveryError=null,creationError=null,rpcError=null}={}) {
  const createUser=vi.fn(async()=>({data:{user:{id:"11111111-1111-4111-8111-111111111111"}},error:creationError}));
  const deleteUser=vi.fn(async()=>({error:null}));
  const resend=vi.fn(async()=>({error:deliveryError}));
  const rpc=vi.fn(async()=>({data:{userId:1,clubId:1},error:rpcError}));
  const from=()=>{
    const query={select:()=>query,delete:()=>query,insert:()=>query,lt:()=>query,eq:()=>query,gte:()=>query,maybeSingle:()=>query,then:resolve=>resolve({data:null,error:null,count:0})};return query;
  };
  const fetch=vi.fn(async()=>new Response(JSON.stringify({mailer_autoconfirm:autoconfirm}),{status:200}));
  const env={SUPABASE_URL:"http://127.0.0.1:54321",SUPABASE_SERVICE_ROLE_KEY:"server-only-test",SIGNUP_REQUIRE_EMAIL_CONFIRMATION:String(required),APP_URL:"https://app.example.test"};
  let handler;
  runInNewContext(source,{serve:callback=>{handler=callback;},createClient:()=>({from,rpc,auth:{admin:{createUser,deleteUser},resend}}),signupFormProblem:()=>null,Deno:{env:{get:key=>env[key]}},crypto:webcrypto,fetch,Response,TextEncoder,AbortSignal,console:{error:vi.fn()}});
  const request=()=>handler(new Request("http://127.0.0.1:54321/functions/v1/signup",{method:"POST",body:JSON.stringify({mode:"create_club",name:"Coach",email:"coach@example.invalid",password:"Valid-Password-123!",clubName:"Test club"})}));
  return {request,createUser,deleteUser,resend,rpc,fetch};
}
describe("Confirmation : exécution du handler signup réel",()=>{
  it("crée un compte non confirmé puis demande le mail après la transaction",async()=>{
    const f=fixture();const response=await f.request();expect(response.status).toBe(200);
    expect((await response.json()).confirmationRequired).toBe(true);
    expect(f.createUser).toHaveBeenCalledWith(expect.objectContaining({email_confirm:false}));
    expect(f.resend).toHaveBeenCalledWith({type:"signup",email:"coach@example.invalid",options:{emailRedirectTo:"https://app.example.test"}});
    expect(f.rpc.mock.invocationCallOrder[0]).toBeLessThan(f.resend.mock.invocationCallOrder[0]);
    expect(f.deleteUser).not.toHaveBeenCalled();
  });
  it("garde le pilote sans SMTP tant que la confirmation n’est pas activée",async()=>{
    const f=fixture({required:false});expect((await (await f.request()).json()).confirmationRequired).toBe(false);
    expect(f.createUser).toHaveBeenCalledWith(expect.objectContaining({email_confirm:true}));
    expect(f.resend).not.toHaveBeenCalled();expect(f.fetch).not.toHaveBeenCalled();
  });
  it("refuse une activation incohérente avant toute création",async()=>{
    const f=fixture({autoconfirm:true});expect((await f.request()).status).toBe(503);
    expect(f.createUser).not.toHaveBeenCalled();expect(f.rpc).not.toHaveBeenCalled();
  });
  it("ne supprime pas Auth quand l’envoi échoue après création du profil",async()=>{
    const f=fixture({deliveryError:new Error("SMTP unavailable")});expect((await (await f.request()).json()).success).toBe(true);
    expect(f.deleteUser).not.toHaveBeenCalled();expect(f.resend).toHaveBeenCalledTimes(1);
  });
  it("ne révèle pas une adresse déjà inscrite",async()=>{
    const f=fixture({creationError:{code:"email_exists"}});const response=await f.request();
    expect(response.status).toBe(200);expect(await response.json()).toEqual({success:true,confirmationRequired:true,correlationId:expect.any(String)});
    expect(f.rpc).not.toHaveBeenCalled();expect(f.resend).not.toHaveBeenCalled();
  });
  it("compense Auth si la transaction échoue et n’envoie pas de mail",async()=>{
    const f=fixture({rpcError:new Error("transaction failed")});expect((await f.request()).status).toBe(500);
    expect(f.deleteUser).toHaveBeenCalledTimes(1);expect(f.resend).not.toHaveBeenCalled();
  });
});
