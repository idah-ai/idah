import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";

export function createIconDriver() {
  return {
    async get(iconName: string) {
      const messageCircleIconRes = await pluginsBackendDataSource.serveAsset("idah-video", `${iconName}.svg`);
      return await messageCircleIconRes.text();
    },
  };
}
