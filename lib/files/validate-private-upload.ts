export const PRIVATE_UPLOAD_MAX_BYTES = 786432;

export interface ValidatedPrivateUpload {
  extension: "pdf" | "jpg" | "png";
  contentType: "application/pdf" | "image/jpeg" | "image/png";
}

export type PrivateUploadValidation =
  | { valid: true; file: ValidatedPrivateUpload }
  | { valid: false; error: string };

export async function validatePrivateUpload(
  upload: File,
): Promise<PrivateUploadValidation> {
  if (upload.size < 1) {
    return { valid: false, error: "Choose a non-empty file to upload." };
  }
  if (upload.size > PRIVATE_UPLOAD_MAX_BYTES) {
    return { valid: false, error: "Files must be 768 KB or smaller." };
  }

  const bytes = new Uint8Array(await upload.arrayBuffer());
  if (
    bytes.length >= 5 &&
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
  ) {
    return {
      valid: true,
      file: { extension: "pdf", contentType: "application/pdf" },
    };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return {
      valid: true,
      file: { extension: "png", contentType: "image/png" },
    };
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return {
      valid: true,
      file: { extension: "jpg", contentType: "image/jpeg" },
    };
  }
  return {
    valid: false,
    error: "Attach a valid PDF, JPEG, or PNG file.",
  };
}
