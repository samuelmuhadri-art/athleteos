import { describe, expect, it } from "vitest";
import { sanitizeMonitoringEvent } from "./monitoringPrivacy";
describe("Rapports techniques sans contenus personnels", () => {
  it("exclut les données, jetons et chemins privés en conservant les lignes de code", () => {
    const event={user:{email:"private@example.be"},request:{headers:{Authorization:"SECRET"}},extra:{wellness:"sommeil",message:"privé"},breadcrumbs:[{message:"private@example.be"}],exception:{values:[{type:"TypeError",value:"private@example.be SECRET",stacktrace:{frames:[{filename:"https://app.test/assets/app-A123.js?token=SECRET",lineno:42,colno:3,vars:{password:"SECRET"},pre_context:["sommeil"]},{filename:"C:/Users/private/doc.js",lineno:1}]}}]}};
    const result=sanitizeMonitoringEvent(event), serialized=JSON.stringify(result);
    for(const secret of ["private", "SECRET", "sommeil", "privé", "Users", "vars"]) expect(serialized).not.toContain(secret);
    expect(result.exception.values[0].stacktrace.frames[0]).toEqual({filename:"/assets/app-A123.js",lineno:42,colno:3});
    expect(event.user.email).toBe("private@example.be");
  });
});
