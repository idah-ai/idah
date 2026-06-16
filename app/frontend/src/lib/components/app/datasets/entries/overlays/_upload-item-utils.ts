import { pluralizeUnit } from "@/utils/unit";
import type { UploadItem } from "./upload-item.types";

export function getStatusLabel(item: UploadItem, maxRetries: number): string {
  const { status, isZip, errorMessage, retryCount, uploadedMedias, skippedMedias } = item;

  const totalUploaded = uploadedMedias.length;
  const totalSkipped = skippedMedias.length;

  if (isZip) {
    switch (status) {
      case "uploading": {
        return "Uploading archive...";
      }
      case "retrying": {
        return `Retrying... (Attempt ${retryCount} of ${maxRetries})`;
      }
      case "completed": {
        return `${totalUploaded} ${pluralizeUnit(totalUploaded, "file")} uploaded`;
      }
      default: {
        return "";
      }
    }
  }

  switch (status) {
    case "uploading": {
      return "Uploading...";
    }
    case "retrying": {
      return `Retrying... (Attempt ${retryCount} of ${maxRetries})`;
    }
    case "completed": {
      if (errorMessage) return errorMessage;
      if (totalSkipped > 0) return skippedMedias.at(0)?.message ?? "Skipped";
      if (totalUploaded > 0) return "Uploaded";
      return "";
    }
    default: {
      return "";
    }
  }
}
