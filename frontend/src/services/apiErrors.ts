import type { ApiValidationIssue } from "../types/api";

export class ApiValidationError extends Error {
  issues: ApiValidationIssue[];

  constructor(issues: ApiValidationIssue[]) {
    super("API validation failed");
    this.name = "ApiValidationError";
    this.issues = issues;
  }
}

export class ApiRequestError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = "ApiRequestError";
    this.retryable = retryable;
  }
}
