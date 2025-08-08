import type { Writable } from "svelte/store"

export function get<T>(store : Writable<T>) : T {
  let $val : any // eslint-disable-line @typescript-eslint/no-explicit-any
  store.subscribe($ => $val = $)()

  // Force cast since we know it's not undefined as of now.
  return $val as T
}