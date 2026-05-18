// Vercel serverless entry. @vercel/node runs the exported Express app as the
// request handler. All paths are rewritten here (see backend/vercel.json) and
// Express routes them internally (/api/* and /health).
import { createApp } from "../src/app";

export default createApp();
