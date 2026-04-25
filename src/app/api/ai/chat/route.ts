import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { streamAdvisorResponse, type ChatMessage } from "@/lib/server/bedrock";
import { jsonError, requireSession } from "@/lib/server/http";

const schema = z.object({
  conversationId: z.string().optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
});

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = schema.parse(await request.json());
    const stream = await streamAdvisorResponse(parsed.messages as ChatMessage[]);

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
