import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Resend } from "resend";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// R2 Client
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: false,
});

// Verify R2 Config on startup
if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_ACCESS_KEY_ID || !process.env.CLOUDFLARE_SECRET_ACCESS_KEY) {
  console.warn("AVISO: Configurações do Cloudflare R2 incompletas no .env");
}

// Resend Client
const resend = new Resend(process.env.RESEND_API_KEY);

// API Routes
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("Recebendo pedido de upload...");
    
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
        throw new Error("CLOUDFLARE_ACCOUNT_ID não configurado no servidor");
    }

    if (!req.file) {
      console.error("Erro: Nenhum arquivo no request");
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const fileName = req.body.fileName || `${Date.now()}-${req.file.originalname}`;
    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || "laudosdefesacivil";

    console.log(`Fazendo upload de ${fileName} para o bucket ${bucketName}...`);
    console.log(`Endpoint: https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: "application/pdf",
    });

    const s3Response = await s3Client.send(command);
    console.log("Upload R2 concluído com sucesso:", s3Response.$metadata.requestId);

    // Construct public URL
    const publicUrl = `${process.env.CLOUDFLARE_PUBLIC_URL}/${fileName}`;
    console.log("URL Pública gerada:", publicUrl);

    res.json({ url: publicUrl, fileName });
  } catch (error: any) {
    console.error("Erro CRÍTICO no upload R2:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      requestId: error.$metadata?.requestId,
      bucket: process.env.CLOUDFLARE_BUCKET_NAME || "laudosdefesacivil"
    });
    res.status(500).json({ error: error.message, code: error.code });
  }
});

app.delete("/api/storage", async (req, res) => {
  try {
    const { fileNames } = req.body;
    console.log("Recebendo pedido de exclusão para:", fileNames);
    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return res.status(400).json({ error: "Lista de arquivos inválida" });
    }

    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || "laudosdefesacivil";

    const deletePromises = fileNames.map(fileName => {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });
      return s3Client.send(command);
    });

    await Promise.all(deletePromises);
    console.log("Exclusão concluída com sucesso");
    res.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao deletar do R2:", {
      message: error.message,
      code: error.code,
      requestId: error.$metadata?.requestId
    });
    res.status(500).json({ error: error.message, code: error.code });
  }
});

app.post("/api/send-email", async (req, res) => {
  try {
    const { subject, html, fileName, fileBufferBase64 } = req.body;
    console.log("Iniciando envio de e-mail institucional...");

    const attachments = [];
    if (fileName && fileBufferBase64) {
      attachments.push({
        filename: fileName,
        content: Buffer.from(fileBufferBase64, 'base64'),
      });
    }

    const institutionalEmail = process.env.EMAIL_TO_INSTITUTIONAL;
    if (!institutionalEmail) {
      console.error("Erro: EMAIL_TO_INSTITUTIONAL não configurado");
      return res.status(400).json({ error: "E-mail institucional não configurado" });
    }

    console.log(`Enviando para: ${institutionalEmail}`);

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: [institutionalEmail],
      subject: subject || "Laudo Técnico de Imóvel - Defesa Civil",
      html: html || "<p>Segue em anexo o laudo técnico solicitado.</p>",
      attachments,
    });

    if (error) {
      console.error("Erro retornado pelo Resend:", error);
      return res.status(400).json({ error });
    }

    console.log("E-mail enviado com sucesso via Resend:", data?.id);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Erro CRÍTICO ao enviar e-mail:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
  app.get("*", (req, res) => {
    res.sendFile("dist/index.html", { root: "." });
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
