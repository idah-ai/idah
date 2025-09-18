import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
// import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";
import type { Hash } from "@/utils/types";

@type("media:medias")
export class MediaRecord extends Record {
  @field() public resource!: string;
  @field() public key!: string;

  @field() public size!: number;
  @field() public mime_type!: string;

  @field() public filename!: string;

  @field() public created_by!: number;
  @field() public created_at!: Date;
  @field() public updated_at!: Date;
}

RecordFactory.registerTypes(MediaRecord);

export const mediaBackendDataSource = createBackendDataSource(
  MediaRecord,
  "https://idah.localhost:8443/api/v1/media/medias",
);
