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
    const existResource = this.map[resource];

    if (!existResource) {
      /**
       * If the resource does not exist in the map
       * Check if logged in account is an admin with rights of "*.*.*"
       */
      if (this.map["*"]) {
        return this.map["*"]["*"];
      }

      return null;
    }

    return existResource[action] || existResource["*"];
  }
}
