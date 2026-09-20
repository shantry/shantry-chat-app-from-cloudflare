export type Room = {
  id: string;
  name: string;
  private: boolean;
  createdAt: number;
};

export type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "assistant";
};

export type Message =
  | ({ type: "add" } & ChatMessage)
  | { type: "all"; messages: ChatMessage[] }
  | { type: "error"; error: string };
