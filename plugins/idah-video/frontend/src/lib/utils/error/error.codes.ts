export function getResponseErrorCode(errorCode: string | null): { title: string; description: string; image: string } {
  switch (errorCode) {
    case null:
      return {
        title: "Sorry, something went wrong!",
        description: "Please try again later.",
        image: "invalid-credentials"
      };
    case "no_role_active":
      return {
        title: "Unauthorized Access",
        description:
          "Your account currently lacks the necessary roles to access Pulse.<br>Please contact Ingedata Support if you believe this is an error or if your access needs to be provisioned.",
        image: "invalid-credentials"
      };
    case "account_not_registered":
      return {
        title: "Account not found",
        description:
          "Please contact Ingedata Support if you believe this is an error or if your access needs to be provisioned.",
        image: "invalid-credentials"
      };
    default:
      return {
        title: "Invalid credentials",
        description:
          "Please contact Ingedata Support if you believe this is an error or if your access needs to be provisioned.",
        image: "invalid-credentials"
      };
  }
}
