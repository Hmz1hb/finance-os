import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { streamAdvisorResponse, type ChatMessage } from "@/lib/server/bedrock";
import { jsonError, parseJson, requireSession } from "@/lib/server/http";

const schema = z.object({
  conversationId: z.string().optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).min(1),
});

function isBedrockUnavailable(message: string) {
  return (
    message.includes("Model use case details have not been submitted") ||
    message.includes("ModelStreamErrorException") ||
    message.includes("AccessDeniedException") ||
    message.includes("ValidationException: Could not access model")
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseJson(request, schema);
    let stream;
    try {
      stream = await streamAdvisorResponse(parsed.messages as ChatMessage[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isBedrockUnavailable(message)) {
        return NextResponse.json(
          { error: "AI advisor is unavailable", code: "AI_UNAVAILABLE" },
          { status: 503 },
        );
      }
      throw error;
    }

    await prisma.aIConversation.upsert({
      where: { id: parsed.conversationId ?? "new" },
      create: {
        title: parsed.messages[0]?.content.slice(0, 60) || "Finance chat",
        messages: parsed.messages,
      },
      update: { messages: parsed.messages },
    }).catch(async () => {
      await prisma.aIConversation.create({
        data: {
          title: parsed.messages[0]?.content.slice(0, 60) || "Finance chat",
          messages: parsed.messages,
        },
      });
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
