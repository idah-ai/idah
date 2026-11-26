// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  interface Window {
    /** UMD global set by the loaded annotation plugin bundle (see plugins/<name>/frontend/vite.config.ts). */
    idah_plugin?: unknown;
  }
}

export {};
