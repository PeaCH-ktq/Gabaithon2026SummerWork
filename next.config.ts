import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Cloudflare Workers（OpenNext）向け: `next dev` 中でも Workers ランタイムの
// バインディングにアクセスできるようにする。
// Vercel など Cloudflare 以外のビルドでは実行しない（wrangler 設定が無く失敗するため）。
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
