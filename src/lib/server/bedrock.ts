import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { financialContextSnapshot } from "@/lib/server/analytics";

const region = process.env.AWS_REGION ?? "eu-west-2";
const modelId = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-sonnet-4-20250514-v1:0";

export const bedrock = new BedrockRuntimeClient({ region });

const decoder = new TextDecoder();

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function buildAdvisorSystemPrompt() {
  const snapshot = await financialContextSnapshot();
  return `You are Finance OS, a direct financial advisor for a Moroccan freelancer and entrepreneur managing personal and business finances across MAD, GBP, USD, and EUR.

Rules:
- Be specific, numerical, and conservative.
- Distinguish must-pay obligations, should-fund priorities, optional spending, and leftover allocation.
- Preserve the boundary between business and personal money.
- Never claim to execute financial actions unless the application confirms a mutation.
- For taxes, provide estimates and explain assumptions.

Current compact financial context:
${JSON.stringify(snapshot, null, 2)}`;
}

function anthropicPayload(system: string, messages: ChatMessage[], maxTokens = 1600) {
  return {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    system,
    messages: messages.map((message) => ({
      role: message.role,
      content: [{ type: "text", text: message.content }],
    })),
  };
}

export async function streamAdvisorResponse(messages: ChatMessage[]) {
  const system = await buildAdvisorSystemPrompt();
  const command = new InvokeModelWithResponseStreamCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(anthropicPayload(system, messages)),
  });

  const response = await bedrock.send(command);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!response.body) {
          controller.close();
          return;
        }

        for await (const event of response.body) {
          if (!event.chunk?.bytes) continue;
          const json = JSON.parse(decoder.decode(event.chunk.bytes));
          const text = json?.delta?.text ?? json?.content_block?.text ?? json?.content_block_delta?.delta?.text;
          if (text) controller.enqueue(new TextEncoder().encode(text));
        }
      } catch (error) {
        controller.enqueue(new TextEncoder().encode(`\n\nAI stream failed: ${(error as Error).message}`));
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

export async function extractReceiptJson(input: { buffer: Buffer; contentType: string }) {
  if (!input.contentType.startsWith("image/")) {
    throw new Error("AI receipt OCR currently supports image uploads. Store PDFs as attachments and enter transaction details manually.");
  }

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 900,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.contentType,
              data: input.buffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Extract merchant, date, total amount, currency, readable line items, and category suggestion from this receipt. Return strict JSON only.",
          },
        ],
      },
    ],
  };

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    }),
  );
  const text = decoder.decode(response.body);
  const parsed = JSON.parse(text);
  const content = parsed?.content?.[0]?.text ?? "{}";
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return { raw: content };
  return JSON.parse(content.slice(jsonStart, jsonEnd + 1));
}
