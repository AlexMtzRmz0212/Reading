import type { NextConfig } from "next";

const config: NextConfig = {
  // Stops `next dev` from writing an AGENTS.md into the project.
  agentRules: false,
  // NEXT_DIST_DIR lets a second dev server run beside the first (it refuses to share a build folder).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // A package-lock.json higher up the tree would otherwise be picked as the workspace root.
  turbopack: { root: process.cwd() },
  // No framing (the owner tools can’t be clickjacked), no MIME sniffing, and other sites only learn the origin.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default config;
