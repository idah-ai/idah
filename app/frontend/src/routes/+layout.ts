// This app renders entirely on the client: all data is fetched client-side from
// VITE_IDAH_HOST and auth is handled in the browser, so there are no server
// `load` functions. Server-side rendering the protected routes therefore has no
// benefit and previously hung (the SSR pass would stall with no response), which
// surfaced downstream as nginx 504s. Run as a client-rendered SPA.
export const ssr = false;
