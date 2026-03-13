import { BACKEND_URL } from "./constants";

export async function uploadToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/api/ipfs/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload to IPFS");
  }

  const data = await response.json();
  return data.IpfsHash;
}

export async function uploadEncryptedToIPFS(file: File): Promise<{
  ipfsHash: string;
  encryptionKey: string;
  iv: string;
  authTag: string;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/api/ipfs/upload-encrypted`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload encrypted document");
  }

  return response.json();
}

export async function decryptFromIPFS(
  ipfsHash: string,
  encryptionKey: string,
  iv: string,
  authTag: string
): Promise<Blob> {
  const response = await fetch(`${BACKEND_URL}/api/ipfs/decrypt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ipfsHash, encryptionKey, iv, authTag }),
  });

  if (!response.ok) {
    throw new Error("Failed to decrypt document");
  }

  return response.blob();
}

export async function anonymizeDocument(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/api/ipfs/anonymize`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to anonymize document");
  }

  const data = await response.json();
  return data.ipfsHash;
}
