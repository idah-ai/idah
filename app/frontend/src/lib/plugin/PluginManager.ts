import type { IActivityContext, IActivityView } from "./interface/Activity";

export class PluginManager {
  private plugins: Map<string, IActivityView> = new Map();

  private context: IActivityContext;

  constructor(context: IActivityContext) {
    this.context = context;
  }

  PLUGIN_LOCAL_PATH = "../../plugins";

  load(config: { name: string; src: string }): Promise<IActivityView> {
    let plugin: IActivityView;

    return new Promise<IActivityView>(async (resolve, reject) => {
      switch (config.src) {
        case "local":
          plugin = (await import([this.PLUGIN_LOCAL_PATH, config.name].join("/"))).default;
          break;
        case "npm":
          reject(console.error("todo"));
          break;
        default:
          reject(console.error("undefined src type for plugin:", config));
      }

      if (!plugin) {
        return reject(console.error("no plugin found for ", config));
      }

      if (this.plugins.has(config.name)) {
        return reject(console.warn(`Plugin ${config.name} already registered`));
      }

      this.plugins.set(plugin.name, plugin); // type <> name/id

      resolve(plugin);
    });
  }

  getPlugin(id: string): IActivityView | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): IActivityView[] {
    return Array.from(this.plugins.values());
  }

  unload(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin && plugin.close) {
      plugin.close();
    }
    this.plugins.delete(id);
  }
}
