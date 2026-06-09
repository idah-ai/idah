import { pluralizeUnit } from "@/utils/unit";
import type { UploadItem } from "./upload-item.types";

export function getStatusLabel(item: UploadItem, maxRetries: number): string {
  const { status, isZip, errorMessage, retryCount, uploadedMedias, skippedMedias, errorMedias } = item;

  const totalUploaded = uploadedMedias.length;
  const totalSkipped = skippedMedias.length;
  const totalErrors = errorMedias.length;

  if (isZip) {
    switch (status) {
      case "uploading": {
        return "Uploading archive...";
      }
      case "retrying": {
        return `Retrying... (Attempt ${retryCount} of ${maxRetries})`;
      }
      case "completed": {
        const parts = [];
        if (totalUploaded > 0) parts.push(`${totalUploaded} ${pluralizeUnit(totalUploaded, "item")} uploaded`);
        if (totalSkipped > 0) parts.push(`${totalSkipped} skipped`);
        if (totalErrors > 0) parts.push(`${totalErrors} failed`);
        return parts.join(", ");
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
      const parts = [];
      if (totalUploaded > 0) parts.push(`${totalUploaded} ${pluralizeUnit(totalUploaded, "item")} uploaded`);
      if (totalSkipped > 0) parts.push(`${totalSkipped} skipped`);
      return parts.join(", ") || "Uploaded";
    }
    default: {
      return "";
    }
  }
}
