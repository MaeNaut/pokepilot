import type { IncomingMessage, ServerResponse } from "node:http";
import { handleNodePokePilotApi } from "../../server/nodePokepilotApi.js";

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  await handleNodePokePilotApi(request, response);
}
