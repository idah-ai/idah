/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Constructor<T> = new (...args: any[]) => T;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Hash<T = any> = { [key: string]: T };
