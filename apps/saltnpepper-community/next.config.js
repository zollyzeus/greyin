/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  // Next.js 14.x still gates instrumentation.ts (src/instrumentation.ts's
  // register() -- the periodic AI-quality sweep timer) behind this flag;
  // it isn't default-on until Next 15. Confirmed the hard way: without
  // this, the file builds with no error but register() is never called.
  experimental: {
    instrumentationHook: true,
  },
}
