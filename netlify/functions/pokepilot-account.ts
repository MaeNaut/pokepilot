import { admin, verifyRequestOrigin } from "@netlify/identity";
import type { Config } from "@netlify/functions";
import { accountErrorResponse, verifyAccount } from "../../server/accountAuth.js";

export default async (request: Request) => {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (request.method !== "GET" && request.method !== "DELETE") {
    return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, DELETE" } });
  }
  if (process.env.POKEPILOT_AUTH_REQUIRED !== "true") {
    return Response.json({ enabled: false }, { headers });
  }
  try {
    if (request.method === "DELETE") verifyRequestOrigin(request);
    const user = await verifyAccount(request, process.env.POKEPILOT_IDENTITY_URL);
    if (request.method === "DELETE") {
      await admin.deleteUser(user.id);
      return new Response(null, { status: 204, headers });
    }
    return Response.json({ enabled: true, user }, { headers });
  } catch (error) { return accountErrorResponse(error); }
};

export const config: Config = { path: "/api/pokepilot/account" };
