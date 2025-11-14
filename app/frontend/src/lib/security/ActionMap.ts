import type { Action, Resource } from "@/security/types";

export class ActionMap {
  map: {
    [resource: string]: {
      [action: string]: string[];
    };
  };

  constructor(rawActions: string[]) {
    this.map = {};

    rawActions.forEach((rawAction) => {
      const [resource, action, scope] = rawAction.split(".");

      if (!this.map[resource]) {
        this.map[resource] = {};
      }

      this.map[resource][action] ||= [];
      this.map[resource][action].push(scope);
    });
  }

  public get(action: Action, resource: Resource): string[] | null {
    const child = this.map[resource];

    if (!child) return null;

    return child[action] || child["*"];
  }
}
