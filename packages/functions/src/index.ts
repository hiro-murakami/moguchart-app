import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import app from "./server.js";

setGlobalOptions({
  region: "asia-northeast1",
  memory: "512MiB",
  timeoutSeconds: 60,
  maxInstances: 10,
});

export const api = onRequest(app);
