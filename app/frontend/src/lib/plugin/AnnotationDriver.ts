import { annotationsBackendDataSource } from "@/data/model/dataset/annotationRecord";
import { JsonRpcDatasource } from "../../plugins/idah-video/video-annotation-activity/jsonrpc";
import type { IAnnotation, IAnnotationDriver } from "./interface/Activity";
import { sleep } from "@/utils/delayed";

const annotations_rpc = new JsonRpcDatasource("https://idah.localhost:8443/api/v1/dataset/annotations/_rpc", 50);

export function createAnnotationDriver(entry_id: string): IAnnotationDriver {
  return {
    create(id, dimensions, annotation) {
      return annotations_rpc.call({
        method: "create",
        params: {
          id,
          entry_id,
          dimensions,
          annotation,
        },
      });
    },
    list(filter, pagination) {
      return new Promise<IAnnotation[]>((resolve, reject) => {
        sleep(2000).then(() => {
          // test purpose
          annotationsBackendDataSource
            .list({
              filters: { ...filter, entry_id },
              pagination,
            })
            .then(
              (v) => resolve(v.data),
              (v) => reject(v.error),
            );
        });
      });
    },
    update({ id, dimensions, annotation }) {
      return new Promise<void>((resolve, reject) => {
        annotations_rpc
          .call({
            method: "update",
            params: { id, entry_id, dimensions, annotation },
          })
          .then(
            (r) => resolve(r.data),
            (r) => reject(r.error),
          );
      });
    },
    delete(id) {
      return annotations_rpc.call({ method: "delete", params: { id } });
    },
  };
}
