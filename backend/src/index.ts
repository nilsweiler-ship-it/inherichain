import express from "express";
import cors from "cors";
import multer from "multer";
import { pinFile } from "./pinata";
import { encryptDocument, decryptDocument } from "./encryption";
import { anonymizeDocument } from "./anonymize";

const app = express();
const PORT = 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Original upload endpoint (unencrypted, backwards compatible)
app.post("/api/ipfs/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const ipfsHash = await pinFile(req.file.buffer, req.file.originalname);

    res.json({ IpfsHash: ipfsHash });
  } catch (err) {
    console.error("IPFS upload failed:", err);
    res.status(500).json({ error: "Failed to pin file to IPFS" });
  }
});

// Encrypted upload endpoint
app.post("/api/ipfs/upload-encrypted", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    // Encrypt the file
    const { encryptedBuffer, encryptionKey, iv, authTag } = encryptDocument(req.file.buffer);

    // Pin encrypted version to IPFS
    const ipfsHash = await pinFile(encryptedBuffer, `encrypted_${req.file.originalname}`);

    res.json({
      IpfsHash: ipfsHash,
      encrypted: true,
      encryptionKey,
      iv,
      authTag,
    });
  } catch (err) {
    console.error("Encrypted IPFS upload failed:", err);
    res.status(500).json({ error: "Failed to encrypt and pin file to IPFS" });
  }
});

// Decrypt endpoint - takes encrypted buffer + key material, returns decrypted data
app.post("/api/ipfs/decrypt", async (req, res) => {
  try {
    const { ipfsHash, encryptionKey, iv, authTag } = req.body;

    if (!ipfsHash || !encryptionKey || !iv || !authTag) {
      res.status(400).json({ error: "Missing required fields: ipfsHash, encryptionKey, iv, authTag" });
      return;
    }

    // Fetch encrypted content from IPFS
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
      res.status(404).json({ error: "Failed to fetch from IPFS" });
      return;
    }

    const encryptedBuffer = Buffer.from(await response.arrayBuffer());

    // Decrypt
    const decrypted = decryptDocument({
      encryptedBuffer,
      encryptionKey,
      iv,
      authTag,
    });

    res.setHeader("Content-Type", "application/octet-stream");
    res.send(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    res.status(500).json({ error: "Failed to decrypt document" });
  }
});

// Anonymize and upload endpoint - for fallback verifiers
app.post("/api/ipfs/anonymize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const { anonymizedBuffer, wasRedacted } = anonymizeDocument(
      req.file.buffer,
      req.file.originalname
    );

    // Pin anonymized version to IPFS
    const ipfsHash = await pinFile(anonymizedBuffer, `anonymized_${req.file.originalname}`);

    res.json({
      IpfsHash: ipfsHash,
      anonymized: true,
      wasRedacted,
    });
  } catch (err) {
    console.error("Anonymization failed:", err);
    res.status(500).json({ error: "Failed to anonymize and pin file" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
