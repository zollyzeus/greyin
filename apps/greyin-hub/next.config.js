// Next.js 14.x still gates instrumentation.ts (src/instrumentation.ts's
// register() -- the periodic platform_score_means refresh timer, 122)
// behind this flag; it isn't default-on until Next 15. Same gotcha
// already documented in greymatters-blog/next.config.js.
module.exports = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
}
