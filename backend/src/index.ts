import { createApp } from "./app";
import { env } from "./config/env";

createApp().listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
