import { field, Record, type } from "@/data/model/Record";

@type("api_permissions")
export class ApiPermissionRecord extends Record {
  @field() public name!: string;
  @field() public title!: string;
  @field() public description!: string;
}
