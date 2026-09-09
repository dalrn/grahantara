import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Run the existing serverless handlers locally, with the same fallback behaviour.
// This plugin is development-only; no server module or private key enters the client bundle.
function localApi() {
  const endpoints = new Set(["parse-preference", "explain-score", "compare"]);
  return {
    name: "grahantara-local-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const endpoint = req.url?.split("?")[0].replace(/^\/api\//, "");
        if (!req.url?.startsWith("/api/") || !endpoints.has(endpoint))
          return next();
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (value) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(value));
        };
        try {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 100000) {
              res.status(413).json({ galat: "Permintaan terlalu besar." });
              return;
            }
          }
          req.body = body ? JSON.parse(body) : {};
          const { default: handler } = await server.ssrLoadModule(
            `/api/${endpoint}.js`,
          );
          await handler(req, res);
        } catch {
          if (!res.writableEnded)
            res.status(500).json({ galat: "Permintaan belum dapat diproses." });
        }
      });
    },
  };
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY;
  return { plugins: [react(), localApi()] };
});
