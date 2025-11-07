import type { SvelteComponent } from "svelte";

import { Record } from "@/data/model/Record";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Constructor<T> = new (...args: any[]) => T;
export type SvelteComponentClass = Constructor<SvelteComponent>;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Hash<T = any> = { [key: string]: T };

export const identity = <T>(x: T): T => x;

export interface HumanizeOption {
  capitalize: boolean;
  capitalizeFirstWord: boolean;
}

export type LabelValue<Value, T extends Record = Record> = {
  label: string;
  value: Value;
  data?: T;
  [key: string]: unknown;
};

type ASTValue = string | number | string[] | boolean | undefined;
type ASTNodeValue = ASTValue | ASTNode | [ASTValue];
export type ASTNode = [string, ASTNodeValue[]];
