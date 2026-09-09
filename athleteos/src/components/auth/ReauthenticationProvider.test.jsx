import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ReauthenticationProvider from "./ReauthenticationProvider";
import { useSensitiveActions } from "../../hooks/useSensitiveActions";
const mocks=vi.hoisted(() => ({invoke:vi.fn(),signIn:vi.fn()}));
vi.mock("../../hooks/useAuth", () => ({useAuth:() => ({user:{id:"uid-1",email:"coach@example.be"}})}));
vi.mock("../../utils/supabaseClient", () => ({supabase:{auth:{signInWithPassword:mocks.signIn},functions:{invoke:mocks.invoke}}}));
function Fixture() {
  const { invokeAdmin }=useSensitiveActions();const [message,setMessage]=useState("");
  return <><button onClick={async () => {try {const result=await invokeAdmin({action:"export_personal_data",idempotencyKey:"same-key"});setMessage(result.data.success?"Terminé":"Refusé");}catch(error){setMessage(error.message);}}}>Exporter</button><p>{message}</p></>;
}
afterEach(() => {cleanup();vi.resetAllMocks();});
describe("Vérification sensible", () => {
  it("ne demande rien si la session est déjà récente", async () => {
    mocks.invoke.mockResolvedValue({data:{success:true},error:null});
    render(<ReauthenticationProvider><Fixture /></ReauthenticationProvider>);
    fireEvent.click(screen.getByRole("button",{name:"Exporter"}));await screen.findByText("Terminé");
    expect(mocks.signIn).not.toHaveBeenCalled();expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("vérifie l’identité puis réessaie exactement une fois la même action", async () => {
    mocks.invoke.mockResolvedValueOnce({data:{success:false,code:"reauthentication_required"}}).mockResolvedValueOnce({data:{success:true}});
    mocks.signIn.mockResolvedValue({data:{user:{id:"uid-1"}},error:null});
    render(<ReauthenticationProvider><Fixture /></ReauthenticationProvider>);
    fireEvent.click(screen.getByRole("button",{name:"Exporter"}));await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"),{target:{value:"Password-123!"}});
    fireEvent.click(screen.getByRole("button",{name:"Confirmer et poursuivre"}));await screen.findByText("Terminé");
    expect(mocks.invoke.mock.calls[1]).toEqual(mocks.invoke.mock.calls[0]);
    expect(mocks.signIn).toHaveBeenCalledWith({email:"coach@example.be",password:"Password-123!"});
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("annuler ne rejoue pas l’action", async () => {
    mocks.invoke.mockResolvedValue({data:{success:false,code:"reauthentication_required"}});
    render(<ReauthenticationProvider><Fixture /></ReauthenticationProvider>);
    fireEvent.click(screen.getByRole("button",{name:"Exporter"}));await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button",{name:"Annuler"}));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.invoke).toHaveBeenCalledTimes(1);expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("un mauvais mot de passe conserve la fenêtre sans exécuter l’action", async () => {
    mocks.invoke.mockResolvedValue({data:{success:false,code:"reauthentication_required"}});
    mocks.signIn.mockResolvedValue({data:{user:null},error:new Error("Invalid login credentials")});
    render(<ReauthenticationProvider><Fixture /></ReauthenticationProvider>);
    fireEvent.click(screen.getByRole("button",{name:"Exporter"}));await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"),{target:{value:"wrong"}});
    fireEvent.click(screen.getByRole("button",{name:"Confirmer et poursuivre"}));await screen.findByRole("alert");
    expect(mocks.invoke).toHaveBeenCalledTimes(1);expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
