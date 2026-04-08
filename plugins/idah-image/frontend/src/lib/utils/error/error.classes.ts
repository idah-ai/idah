import type { ErrorClasses } from "$lib/utils/error/error.classes.types";

export const errorClasses: ErrorClasses = {
  "Verse::Error::Authorization": {
    title: "Unauthorized",
    fallbackMessage: "Sorry, you're not authorized to access the data you were trying to reach."
  },
  "Verse::Error::BadRequest": {
    title: "Sorry, something went wrong!",
    fallbackMessage: "Please try again later."
  },
  "Verse::Error::CannotCreateRecord": {
    title: "Cannot create record",
    fallbackMessage: "Sorry, you don't have permission to access the data you were trying to reach."
  },
  "Verse::Error::NotFound": {
    title: "Data not found;",
    fallbackMessage: "Sorry, we can't seem to find the data you're looking for."
  },
  "Verse::Error::RecordNotFound": {
    title: "Record not found",
    fallbackMessage: "Sorry, we can't seem to find the data you're looking for."
  },
  "Verse::Error::ValidationFailed": {
    title: "Data validation failed",
    fallbackMessage: "Please fill in all required fields and ensure the provided data is valid."
  },
  "Verse::Error::Unauthorized": {
    title: "No permission to access the data",
    fallbackMessage: "Sorry, you don't have permission to access the data you were trying to reach."
  }
};
