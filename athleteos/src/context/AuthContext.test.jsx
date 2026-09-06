import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContext } from "react";
const mocks = vi.hoisted(() => ({ callback: null, getSession: vi.fn(), query: vi.fn(), from: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../utils/supabaseClient", () => ({ supabase: {
  auth: { getSession: mocks.getSession, onAuthStateChange: callback => { mocks.callback = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; } },
  from: mocks.from,
} }));
import { AuthProvider } from "./AuthContext";
import { AuthContext } from "./authContextValue";
const session = { user: { id: "account-a" } };
const profile = { id: 1, club_id: 4, role: "head_coach", name: "Coach" };
const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.query.mockResolvedValue({ data: profile, error: null });
  mocks.from.mockImplementation(() => { const query = { select: () => query, eq: () => query, maybeSingle: () => query, abortSignal: mocks.query }; return query; });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("résolution de session et accès au club", () => {
  it("ne lance aucune requête métier et ne retourne aucune promesse dans le callback Auth", async () => {
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      expect(mocks.callback("SIGNED_IN", session)).toBeUndefined();
      expect(mocks.from).not.toHaveBeenCalled();
    });
    await waitFor(() => expect(result.current.profile).toEqual(profile));
    expect(result.current.loading).toBe(false);
  });
  it("termine le chargement si le profil manque et peut le recharger sans créer de club", async () => {
    mocks.getSession.mockResolvedValue({ data: { session } });
    mocks.query.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await waitFor(() => expect(result.current.profileError).toContain("introuvable"));
    expect(result.current.loading).toBe(false);
    act(() => result.current.retryProfile());
    await waitFor(() => expect(result.current.profile).toEqual(profile));
    expect(result.current.profileError).toBeNull();
  });
  it("ignore une ancienne session résolue après une nouvelle connexion", async () => {
    const old = deferred(); mocks.getSession.mockReturnValue(old.promise);
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await act(async () => { mocks.callback("SIGNED_IN", session); });
    await act(async () => old.resolve({ data: { session: null } }));
    expect(result.current.user.id).toBe("account-a");
    expect(result.current.profile).toEqual(profile);
  });
  it("ne restaure pas un profil arrivé après la déconnexion", async () => {
    const pending = deferred(); mocks.query.mockReturnValue(pending.promise);
    mocks.getSession.mockResolvedValue({ data: { session } });
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await waitFor(() => expect(mocks.query).toHaveBeenCalled());
    act(() => mocks.callback("SIGNED_OUT", null));
    await act(async () => pending.resolve({ data: profile, error: null }));
    expect(result.current.user).toBeNull(); expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
  });
  it("borne le chargement du profil et ignore une réponse tardive après timeout", async () => {
    vi.useFakeTimers();
    const pending = deferred(); mocks.query.mockReturnValue(pending.promise);
    mocks.getSession.mockResolvedValue({ data: { session } });
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(12000));
    expect(result.current.loading).toBe(false); expect(result.current.profileError).toContain("trop de temps");
    await act(async () => pending.resolve({ data: profile }));
    expect(result.current.profile).toBeNull();
  });
  it("rend récupérables une erreur de session et une erreur de lecture du profil", async () => {
    mocks.getSession.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await waitFor(() => expect(result.current.profileError).toContain("session"));
    expect(result.current.loading).toBe(false);
    mocks.getSession.mockResolvedValue({ data: { session } });
    mocks.query.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    act(() => result.current.retryProfile());
    await waitFor(() => expect(result.current.profileError).toContain("accès au club"));
    expect(result.current.loading).toBe(false);
  });
  it("actualise le profil au renouvellement du token et préserve le parcours de récupération", async () => {
    mocks.getSession.mockResolvedValue({ data: { session } });
    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    await waitFor(() => expect(result.current.profile).toEqual(profile));
    mocks.query.mockResolvedValue({ data: { ...profile, name: "Nom actualisé" }, error: null });
    act(() => mocks.callback("TOKEN_REFRESHED", session));
    await waitFor(() => expect(result.current.profile.name).toBe("Nom actualisé"));
    act(() => mocks.callback("PASSWORD_RECOVERY", session));
    expect(result.current.passwordRecovery).toBe(true);
    act(() => mocks.callback("SIGNED_OUT", null));
    expect(result.current.passwordRecovery).toBe(false);
  });
});
