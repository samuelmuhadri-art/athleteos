import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import ResetPasswordPage from "./ResetPasswordPage";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  sendPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  signOut: vi.fn(),
  invoke: vi.fn(),
  rpc: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    signIn: mocks.signIn,
    sendPasswordReset: mocks.sendPasswordReset,
    updatePassword: mocks.updatePassword,
    signOut: mocks.signOut,
  }),
}));

vi.mock("../utils/supabaseClient", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
    auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.sendPasswordReset.mockResolvedValue({ error: null });
  mocks.updatePassword.mockResolvedValue({ error: null });
  mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
  mocks.rpc.mockResolvedValue({ data: { status: "active", clubName: "Club ami" }, error: null });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("LoginPage", () => {
  it("associe les labels, permet d'afficher le mot de passe et traduit l'erreur de connexion", async () => {
    mocks.signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginPage onSignupClick={vi.fn()} />);

    const email = screen.getByLabelText("Adresse email");
    const password = screen.getByLabelText("Mot de passe");
    expect(password.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(password.getAttribute("type")).toBe("text");

    fireEvent.change(email, { target: { value: "coach@club.be" } });
    fireEvent.change(password, { target: { value: "mot-de-passe" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Email ou mot de passe incorrect.");
  });

  it("conserve l'email et confirme l'envoi du lien de réinitialisation", async () => {
    render(<LoginPage onSignupClick={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Adresse email"), { target: { value: "coach@club.be" } });
    fireEvent.click(screen.getByRole("button", { name: "Mot de passe oublié ?" }));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien de réinitialisation" }));

    await waitFor(() => expect(mocks.sendPasswordReset).toHaveBeenCalledWith("coach@club.be"));
    expect(screen.getByRole("status").textContent).toContain("Email envoyé");
  });

  it("vérifie l'invitation après la connexion d'un compte existant", async () => {
    render(<LoginPage inviteCode="0IL012A3" onSignupClick={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Adresse email"), { target: { value: "athlete@club.be" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "mot-de-passe" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("admin-actions", {
      body: { action: "accept_club_invitation", inviteCode: "0IL012A3" },
    }));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});

describe("SignupPage", () => {
  it("préremplit et vérifie le club lorsqu’un athlète ouvre un lien d’invitation", async () => {
    render(<SignupPage onBack={vi.fn()} initialInviteCode="ab12cd34" />);

    expect(screen.getByRole("button", { name: /Athlète.*Rejoindre mon club/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Code d’invitation").value).toBe("AB12CD34");
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("inspect_club_invitation", { p_code: "AB12CD34" }));
    expect(await screen.findByText("Invitation valide pour Club ami.")).toBeTruthy();
  });

  it("rend le choix de rôle explicite et conserve le payload athlète existant", async () => {
    render(<SignupPage onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Athlète.*Rejoindre mon club/i }));

    fireEvent.change(screen.getByLabelText("Code d’invitation"), { target: { value: "a3f7k9p2" } });
    fireEvent.change(screen.getByLabelText("Prénom et nom"), { target: { value: "Alice Martin" } });
    fireEvent.change(screen.getByLabelText("Adresse email"), { target: { value: "alice@club.be" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "AthleteOS2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Rejoindre mon club" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(mocks.invoke.mock.calls[0][0]).toBe("signup");
    expect(mocks.invoke.mock.calls[0][1].body).toMatchObject({
      mode: "join_club",
      name: "Alice Martin",
      email: "alice@club.be",
      password: "AthleteOS2026!",
      inviteCode: "A3F7K9P2",
    });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "alice@club.be",
      password: "AthleteOS2026!",
    });
    expect(mocks.invoke).toHaveBeenLastCalledWith("admin-actions", {
      body: { action: "accept_club_invitation", inviteCode: "A3F7K9P2" },
    });
  });
});

describe("ResetPasswordPage", () => {
  it("bloque les mots de passe différents puis confirme la mise à jour", async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "AthleteOS2026!" } });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), { target: { value: "different" } });
    expect(screen.getByText("Les deux mots de passe ne correspondent pas.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), { target: { value: "AthleteOS2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Définir le nouveau mot de passe" }));

    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith("AthleteOS2026!"));
    expect(screen.getByRole("status").textContent).toContain("mis à jour");
  });
});
