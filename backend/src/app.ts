import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { router } from "./routes";
import { errorHandler, notFound } from "./middleware/error";

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", router);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
