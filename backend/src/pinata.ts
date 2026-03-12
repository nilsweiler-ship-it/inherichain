import pinataSDK from "@pinata/sdk";
import { Readable } from "stream";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
  throw new Error("Missing PINATA_API_KEY or PINATA_SECRET_API_KEY environment variables");
}

const pinata = new pinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_SECRET_API_KEY
);

export async function pinFile(
  fileBuffer: Buffer,
  fileName: string
): Promise<string> {
  const stream = Readable.from(fileBuffer);
  // @pinata/sdk expects a readable stream with a `path` property for the filename
  (stream as any).path = fileName;

  const result = await pinata.pinFileToIPFS(stream, {
    pinataMetadata: { name: fileName },
  });

  return result.IpfsHash;
}
