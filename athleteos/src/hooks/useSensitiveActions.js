import { useCallback, useContext } from "react";
import { ReauthenticationContext } from "../context/ReauthenticationContext";
import { supabase } from "../utils/supabaseClient";

export function useSensitiveActions() {
  const request = useContext(ReauthenticationContext);
  const authenticate = useCallback(async () => {
    if (!request) throw new Error("Reconnecte-toi avant de poursuivre cette action.");
    await request();
  }, [request]);
  const invokeAdmin = useCallback(async (body) => {
    let result = await supabase.functions.invoke("admin-actions", { body });
    if (!result.error && result.data?.code === "reauthentication_required") {
      await authenticate();
      // One retry only; the backend checks the newly issued JWT again.
      result = await supabase.functions.invoke("admin-actions", { body });
    }
    return result;
  }, [authenticate]);
  return { authenticate, invokeAdmin };
}
