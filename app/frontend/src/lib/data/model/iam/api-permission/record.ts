import { field, Record } from "@/data/model/Record";

export class ApiPermissionRecord extends Record {
  @field() public name!: string;
  @field() public title!: string;
  @field() public description!: string;
}