import type { IActivityView } from "./interface/Activity";

type PluginConfig = { name: string; src: string };
type PluginsConfig = { plugins: PluginConfig[] };
export class PluginManager {
  private plugins: Map<string, IActivityView> = new Map();
  loadedPromise: Promise<void>;
  PLUGINS_PATH = "../../plugins";

  constructor(config: PluginsConfig = { plugins: [] }) {
    this.loadedPromise = new Promise<void>((resolve, reject) => {
      console.debug("loading plugins");
      Promise.all(
        config.plugins.map((plugin_config: { name: string; src: string }) => {
          return new Promise<IActivityView>((plugin_resolve, plugin_reject) => {
            this.register(plugin_config).then((plugin) => plugin_resolve(plugin), plugin_reject);
          });
        }),
      ).then(
        (plugins) => resolve(console.log({ this: this, plugins })),
        () => reject(console.error),
      );
    });
  }

  register(config: PluginConfig): Promise<IActivityView> {
    console.debug("register", config);
    let plugin: IActivityView;

    return new Promise<IActivityView>(async (resolve, reject) => {
      switch (config.src) {
        case "local":
          plugin = (await import([this.PLUGINS_PATH, config.name].join("/"))).default;
          break;
        case "npm":
          return reject(console.error("todo"));
          break;
        default:
          return reject(console.error("undefined src type for plugin:", config));
      }

      if (!plugin) {
        return reject(console.error("no plugin found for ", config));
      }

      if (this.plugins.has(config.name)) {
        return reject(console.warn(`Plugin ${config.name} already registered`));
      }

      this.plugins.set(plugin.name, plugin); // type <> name/id

      console.log({ resolved: { plugin } });
      resolve(plugin);
    });
  }

  getPlugin(id: string): IActivityView | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): IActivityView[] {
    return Array.from(this.plugins.values());
  }

  getPluginsForType(type: string): IActivityView[] {
    return Array.from(this.plugins.values().filter((p) => p.type == type));
  }

  unregister(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin && plugin.close) {
      plugin.close();
    }
    this.plugins.delete(id);
  }
}
