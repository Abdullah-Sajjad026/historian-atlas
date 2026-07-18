import type { NextConfig } from "next";

const config: NextConfig = {
  /** Standalone output: .next/standalone is a self-contained server with a
   *  pruned node_modules — what the Docker runtime stage ships. */
  output: "standalone",
};

export default config;
