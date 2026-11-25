import { defineConfig, sessionDrivers } from "astro/config";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import emdash from "emdash/astro";
import { libsql, sqlite } from "emdash/db";
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

const emdashDb = process.env.TURSO_AUTH_TOKEN
  ? libsql({
      url: process.env.TURSO_DATABASE_URL || "libsql://gfsql-askhope.aws-ap-south-1.turso.io",
      authToken: process.env.TURSO_AUTH_TOKEN
    })
  : sqlite({ url: "file:./data/emdash.sqlite" });

export default defineConfig({
  output: "server",
  adapter: vercel(),
  session: { driver: sessionDrivers.memory() },
  integrations: [sqlitePersistenceIntegration(), react(), emdash({ database: emdashDb })]
});
