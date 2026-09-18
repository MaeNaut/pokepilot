import type { Config, Context } from "@netlify/functions";
import { verifyRequestOrigin } from "@netlify/identity";
import { handleWebPokePilotApi } from "../../server/webPokePilotApi.js";
import { accountErrorResponse, accountUsageId, verifyAccount } from "../../server/accountAuth.js";

export default async (request: Request, context: Context) => {
  let authenticatedAccountId: string | undefined;
  if (process.env.POKEPILOT_AUTH_REQUIRED === "true") {
    try {
      verifyRequestOrigin(request);
      authenticatedAccountId = accountUsageId(await verifyAccount(request, process.env.POKEPILOT_IDENTITY_URL));
    } catch (error) { return accountErrorResponse(error); }
  }
  return handleWebPokePilotApi(request, { requesterIp: context.ip, authenticatedAccountId });
};

export const config: Config = {
  path: "/api/pokepilot/analyze",
};
