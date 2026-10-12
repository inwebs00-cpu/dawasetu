import { describe, expect, it } from "vitest";

import {
  PRIVATE_UPLOAD_MAX_BYTES,
  validatePrivateUpload,
} from "@/lib/files/validate-private-upload";

describe("private upload validation", () => {
  it("identifies supported file formats from their signatures", async () => {
    const pdf = await validatePrivateUpload(
      new File(["%PDF-1.7\n"], "anything.bin", { type: "text/plain" }),
    );
    const png = await validatePrivateUpload(
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "photo.png",
      ),
    );
    const jpeg = await validatePrivateUpload(
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg"),
    );

    expect(pdf).toEqual({
      valid: true,
      file: { extension: "pdf", contentType: "application/pdf" },
    });
    expect(png).toEqual({
      valid: true,
      file: { extension: "png", contentType: "image/png" },
    });
    expect(jpeg).toEqual({
      valid: true,
      file: { extension: "jpg", contentType: "image/jpeg" },
    });
  });

  it("rejects spoofed and oversized files", async () => {
    const spoofed = await validatePrivateUpload(
      new File(["not a PDF"], "statement.pdf", { type: "application/pdf" }),
    );
    const oversized = await validatePrivateUpload(
      new File([new Uint8Array(PRIVATE_UPLOAD_MAX_BYTES + 1)], "large.pdf"),
    );

    expect(spoofed).toEqual({
      valid: false,
      error: "Attach a valid PDF, JPEG, or PNG file.",
    });
    expect(oversized).toEqual({
      valid: false,
      error: "Files must be 768 KB or smaller.",
    });
  });
});
