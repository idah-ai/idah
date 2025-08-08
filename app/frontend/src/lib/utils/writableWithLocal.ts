// See:
// browser as BROWSER
// -----
// https://kit.svelte.dev/docs/modules#$app-environment-browser
// https://dev.to/thepassle/the-javascript-ecosystem-for-the-dazed-and-confused-36il
//
// Svelte Store with Local Storage
// -----
// https://www.skeleton.dev/utilities/local-storage-stores
// https://github.com/skeletonlabs/skeleton/blob/master/packages/skeleton/src/lib/utilities/LocalStorageStore/LocalStorageStore.ts

import { browser as BROWSER } from "$app/environment"
import { writable, get, type Writable } from "svelte/store"

export type Updater<T> = (value: T) => T
export type StoreDict<T> = { [key: string]: Writable<T> }

type StorageType = "local" | "session"

interface Serializer<T> {
  parse(text: string): T
  stringify(object: T): string
}

interface Options<T> {
  serializer?: Serializer<T>
  storage?: StorageType
}

export default function writableWithLocal<T>(
  key: string,
  initialValue: T,
  options?: Options<T>
): Writable<T> {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const stores: StoreDict<any> = {}

  const serializer = options?.serializer ?? JSON
  const storageType = options?.storage ?? "local"

  function getStorage(type: StorageType) {
    return type === "local" ? localStorage : sessionStorage
  }

  function updateStorage(key: string, value: T) {
    if (!BROWSER) return

    getStorage(storageType).setItem(key, serializer.stringify(value))
  }

  if (!stores[key]) {
    const store = writable(initialValue, (set) => {
      const json = BROWSER ? getStorage(storageType).getItem(key) : null

      if (json) {
        set(<T>serializer.parse(json))
      }

      if (BROWSER) {
        const handleStorage = (event: StorageEvent) => {
          if (event.key === key)
            set(event.newValue ? serializer.parse(event.newValue) : null)
        }

        window.addEventListener("storage", handleStorage)

        return () => window.removeEventListener("storage", handleStorage)
      }
    })

    const { subscribe, set } = store

    stores[key] = {
      set(value: T) {
        updateStorage(key, value)
        set(value)
      },
      update(updater: Updater<T>) {
        const value = updater(get(store))

        updateStorage(key, value)
        set(value)
      },
      subscribe
    }
  }

  return stores[key]
}
