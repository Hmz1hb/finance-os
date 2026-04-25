export type ZodIssueSummary = { path: string; message: string };

export class HttpError extends Error {
  status: number;
  issues?: ZodIssueSummary[];

  constructor(status: number, message: string, issues?: ZodIssueSummary[]) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}
