// ---------------------------------------------------------------------------
// state/magnetic-snap.svelte.ts — Plugin-local magnetic snap toggle
//
// Exports a reactive boolean that both the toolbar toggle and ShapesContainer
// read from. Wrapped in an object with a getter/setter so Vite's lib mode
// doesn't complain about reassigning an imported binding.
// ---------------------------------------------------------------------------

class MagneticSnap {
  #enabled = $state(false);

  get enabled(): boolean {
    return this.#enabled;
  }

  set enabled(val: boolean) {
    this.#enabled = val;
  }

  toggle(): void {
    this.#enabled = !this.#enabled;
  }
}

export const magneticSnap = new MagneticSnap();
