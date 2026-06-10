// @ts-nocheck
// Vercel serverless function — wraps the pre-built Express app bundle.
// The bundle is produced by esbuild during the build step (see vercel.json).

let _handler: any = null;

export default async function handler(req: any, res: any): Promise<void> {
  if (!_handler) {
    // Dynamic string import avoids TS module resolution at compile time.
    // Vercel's bundler includes the dist files via includeFiles in vercel.json.
    const distPath = "../artifacts/api-server/dist/index.mjs";
    const mod = await import(distPath);
    _handler = mod.default;
  }
  _handler(req, res);
}
