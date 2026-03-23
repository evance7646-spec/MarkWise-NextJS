import { resolveRoomScope } from "@/lib/roomAuth";
import { subscribeRoomEvents } from "@/lib/roomEvents";

export const runtime = "nodejs";

const encoder = new TextEncoder();

const toSseChunk = (event: string, data: unknown) => {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

export async function GET(request: Request) {
  const scope = await resolveRoomScope(request);
  if (!scope.ok) {
    return Response.json(
      {
        apiVersion: "v1",
        error: {
          code: "UNAUTHORIZED",
          message: scope.error,
        },
      },
      { status: scope.status },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        toSseChunk("ready", {
          apiVersion: "v1",
          role: scope.role,
          connectedAt: new Date().toISOString(),
        }),
      );

      const unsubscribe = subscribeRoomEvents((payload) => {
        controller.enqueue(toSseChunk("room.status.changed", { apiVersion: "v1", ...payload }));
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(toSseChunk("heartbeat", { ts: new Date().toISOString() }));
      }, 20000);

      const handleAbort = () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", handleAbort);
    },
    cancel() {
      return undefined;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
