import { defineConfig } from "astro/config";
import { handleSqliteApiRequest } from "./src/server/sqlite-db.js";

/** Attaches persistent node:sqlite API middleware (/api/db/health, /api/db/state, /api/db/reset). */
function sqlitePersistenceIntegration() {
  const attach = (middlewares) => {
    middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith("/api/db/")) {
        handleSqliteApiRequest(req, res);
        return;
      }
      next();
    });
  };

  return {
    name: "godflow-sqlite-persistence",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            server: {
              watch: {
                ignored: ["**/data/**"]
              }
            },
            plugins: [
              {
                name: "godflow-sqlite-vite-middleware",
                configureServer(server) {
                  attach(server.middlewares);
                },
                configurePreviewServer(server) {
                  attach(server.middlewares);
                }
              }
            ]
          }
        });
      }
    }
  };
}

export default defineConfig({
  integrations: [sqlitePersistenceIntegration()]
});
