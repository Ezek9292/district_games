import type { Request, RequestHandler, Response } from "express";

// Server-Sent Events: every open page gets a "change" event after any successful edit,
// and refetches the public state.
const clients = new Set<Response>();

export function streamHandler(req: Request, res: Response) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  clients.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

export function broadcastChange() {
  for (const res of clients) res.write("event: change\ndata: {}\n\n");
}

/** Broadcast once a mutating request has finished successfully. */
export const broadcastOnSuccess: RequestHandler = (req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode < 400) broadcastChange();
    });
  }
  next();
};
