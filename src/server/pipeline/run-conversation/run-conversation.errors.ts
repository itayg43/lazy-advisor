import { InternalError } from "#errors";

export class ConversationBudgetExhaustedError extends InternalError {
  constructor(budget: number) {
    super(`runConversation: budget of ${budget} turns exhausted without resolution`);
    this.name = "ConversationBudgetExhaustedError";
  }
}

export const isConversationBudgetExhaustedError = (
  error: unknown,
): error is ConversationBudgetExhaustedError =>
  error instanceof ConversationBudgetExhaustedError;
