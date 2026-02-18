import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/Button";
import { uploadToIPFS } from "../../utils/ipfs";
import toast from "react-hot-toast";

interface DocumentUploadProps {
  onUpload: (cid: string) => void;
}

export function DocumentUpload({ onUpload }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setFileName(file.name);
    try {
      const cid = await uploadToIPFS(file);
      onUpload(cid);
      toast.success("Document uploaded to IPFS");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      <Button
        variant="secondary"
        onClick={() => fileRef.current?.click()}
        loading={uploading}
      >
        <Upload className="w-4 h-4 mr-2" />
        {uploading ? "Uploading..." : "Upload Document"}
      </Button>
      {fileName && <p className="text-sm text-gray-400">{fileName}</p>}
    </div>
  );
}
