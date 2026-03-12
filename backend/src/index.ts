import express from "express";
import cors from "cors";
import multer from "multer";
import { pinFile } from "./pinata";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));

const upload = multer({ storage: multer.memoryStorage() });

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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
