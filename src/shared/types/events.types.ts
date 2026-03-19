export type ServerEvent =
  | { type: "clarification"; questions: string[] }
  | { type: "search_progress"; query: string }
  | {
      type: "step_created";
      stepId: string;
      action: string;
      reasoning: string;
      phase: number;
    }
  | {
      type: "step_updated";
      stepId: string;
      action?: string;
      reasoning?: string;
      phase?: number;
    }
  | { type: "step_removed"; stepId: string }
  | { type: "plan_complete"; summary: string }
  | { type: "message"; content: string }
  | { type: "error"; message: string };

export type ClientEvent =
  | { type: "goal"; text: string }
  | { type: "answer"; text: string }
  | { type: "feedback"; text: string };
