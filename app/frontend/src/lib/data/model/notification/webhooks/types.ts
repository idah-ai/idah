export interface TestWebhookResponse {
  success: boolean;
  http_code: number | null;
  response: string;
}
