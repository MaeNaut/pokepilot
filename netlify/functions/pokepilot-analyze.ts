import type { Config, Context } from "@netlify/functions";
import { handleWebPokePilotApi } from "../../server/webPokePilotApi.js";

export default async (request: Request, context: Context) =>
  handleWebPokePilotApi(request, { requesterIp: context.ip });

export const config: Config = {
  path: "/api/pokepilot/analyze",
};
