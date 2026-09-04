import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatThread } from "./Messaging";

afterEach(cleanup);

describe("envoi d'un message coach", () => {
  it("conserve le brouillon et affiche une erreur quand l'envoi echoue", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onSend = vi.fn().mockRejectedValue(new Error("Reseau indisponible"));
    const contact = { id:"athlete-1", userId:2, name:"Nora Martin", type:"athlete" };

    render(
      <ChatThread
        conv={{ contactId:contact.id, messages:[], unread:0 }}
        contact={contact}
        contacts={[contact]}
        onSend={onSend}
        onBack={vi.fn()}
        coachUserId={1}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target:{ value:"Garde ce message" } });
    fireEvent.click(screen.getByRole("button", { name:"Envoyer le message" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith("Garde ce message"));
    expect((await screen.findByRole("alert")).textContent).toContain("Réessaie sans perdre ton texte");
    expect(input.value).toBe("Garde ce message");
  });
});
