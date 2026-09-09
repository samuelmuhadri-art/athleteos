import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmailConfirmationNotice from "./EmailConfirmationNotice";
const resend=vi.hoisted(() => vi.fn());
vi.mock("../../utils/supabaseClient", () => ({supabase:{auth:{resend}}}));
afterEach(() => { cleanup();vi.clearAllMocks(); });
describe("Confirmation email", () => {
  it("renvoie le lien sans recréer de compte et borne les clics répétés", async () => {
    resend.mockResolvedValue({error:null});
    render(<EmailConfirmationNotice email="athlete@example.be" />);
    fireEvent.click(screen.getByRole("button",{name:"Renvoyer le lien de confirmation"}));
    await waitFor(() => expect(resend).toHaveBeenCalledWith({type:"signup",email:"athlete@example.be",options:{emailRedirectTo:window.location.origin}}));
    expect((await screen.findByRole("button",{name:"Renvoyer dans 60 s"})).disabled).toBe(true);
    expect(resend).toHaveBeenCalledTimes(1);
  });
  it("conserve un parcours de réessai si le SMTP échoue", async () => {
    resend.mockResolvedValue({error:new Error("SMTP secret diagnostic")});
    render(<EmailConfirmationNotice email="athlete@example.be" />);
    fireEvent.click(screen.getByRole("button",{name:"Renvoyer le lien de confirmation"}));
    expect((await screen.findByRole("alert")).textContent).toContain("Ton compte n’est pas supprimé");
    expect(screen.queryByText(/SMTP secret/)).toBeNull();
  });
});
