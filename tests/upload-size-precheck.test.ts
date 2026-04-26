import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock auth so requireSession passes without a real NextAuth session.
vi.mock("../auth", () => ({
  auth: () => Promise.resolve({ user: { id: "test-user" } }),
}));

// Mock the Bedrock dependency so importing the OCR route does NOT pull in AWS SDK.
vi.mock("../src/lib/server/bedrock", () => ({
  extractReceiptJson: vi.fn(async () => ({})),
}));

// Mock prisma + aws helpers for the attachments/upload route import.
vi.mock("../src/lib/server/db", () => ({
  prisma: {
    attachment: { create: vi.fn(async () => ({ id: "att_test" })) },
  },
}));
vi.mock("../src/lib/server/aws", () => ({
  uploadReceiptObject: vi.fn(async () => ({ key: "k", thumbnailKey: null, contentType: "image/png", size: 1 })),
  attachmentTypeFromContentType: vi.fn(() => "RECEIPT"),
}));

import { POST as ocrPOST } from "../src/app/api/ai/receipt-ocr/route";
import { POST as uploadPOST } from "../src/app/api/attachments/upload/route";

const ELEVEN_MB = 11 * 1024 * 1024;

function makeOversizeMultipartReq(url: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=----test",
      "content-length": String(ELEVEN_MB),
    },
    // body is irrelevant; the pre-check fires before formData() is called
    body: "----test\r\n",
  });
}

describe("POST /api/ai/receipt-ocr — content-length pre-check (R9-AI-001)", () => {
  it("returns 413 (not 415) when content-length exceeds 10 MB", async () => {
    const res = await ocrPOST(makeOversizeMultipartReq("http://localhost/api/ai/receipt-ocr"));
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/10MB/i);
  });

  it("still returns 415 for genuine non-multipart payloads under the size cap", async () => {
    const req = new NextRequest("http://localhost/api/ai/receipt-ocr", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "12" },
      body: '{"x":1}',
    });
    const res = await ocrPOST(req);
    expect(res.status).toBe(415);
  });
});

describe("POST /api/attachments/upload — content-length pre-check", () => {
  it("returns 413 when content-length exceeds 10 MB", async () => {
    const res = await uploadPOST(makeOversizeMultipartReq("http://localhost/api/attachments/upload"));
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/10MB/i);
  });
});
