import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Resend } from "resend";

dotenv.config();

// Multer for file uploads with increased limits
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

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

// Resend Client
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
const PORT = 3000;

// Global request logger for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// API Routes
const apiRouter = express.Router();

apiRouter.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: {
      r2: !!process.env.CLOUDFLARE_ACCOUNT_ID,
      resend: !!process.env.RESEND_API_KEY,
      email: !!process.env.EMAIL_TO_INSTITUTIONAL
    }
  });
});

apiRouter.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("[UPLOAD] Recebendo pedido de upload...");
    
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
        throw new Error("CLOUDFLARE_ACCOUNT_ID não configurado no servidor");
    }

    if (!req.file) {
      console.error("[UPLOAD] Erro: Nenhum arquivo no request");
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const fileName = req.body.fileName || `${Date.now()}-${req.file.originalname}`;
    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || "laudosdefesacivil";

    console.log(`[UPLOAD] Iniciando upload de ${fileName} para o bucket ${bucketName}...`);
    console.log(`[UPLOAD] Endpoint: https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    console.log(`[UPLOAD] Tamanho do arquivo: ${req.file.size} bytes`);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: "application/pdf",
    });

    const s3Response = await s3Client.send(command);
    console.log("[UPLOAD] Upload R2 concluído com sucesso:", s3Response.$metadata.requestId);

    // Construct public URL
    const publicUrl = `${process.env.CLOUDFLARE_PUBLIC_URL}/${fileName}`;
    console.log("[UPLOAD] URL Pública gerada:", publicUrl);

    res.json({ url: publicUrl, fileName });
  } catch (error: any) {
    console.error("[UPLOAD] Erro CRÍTICO no upload R2:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      requestId: error.$metadata?.requestId,
      bucket: process.env.CLOUDFLARE_BUCKET_NAME || "laudosdefesacivil"
    });
    res.status(500).json({ error: error.message, code: error.code });
  }
});

apiRouter.delete("/storage", async (req, res) => {
  try {
    const { fileNames } = req.body;
    console.log("[STORAGE] Recebendo pedido de exclusão para:", fileNames);
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
    console.log("[STORAGE] Exclusão concluída com sucesso");
    res.json({ success: true });
  } catch (error: any) {
    console.error("[STORAGE] Erro ao deletar do R2:", {
      message: error.message,
      code: error.code,
      requestId: error.$metadata?.requestId
    });
    res.status(500).json({ error: error.message, code: error.code });
  }
});

apiRouter.post("/send-email", async (req, res) => {
  try {
    const { subject, html, fileName, fileBufferBase64 } = req.body;
    console.log(`[EMAIL] Recebido pedido de envio. Assunto: ${subject}, Arquivo: ${fileName}`);

    if (!fileBufferBase64) {
      console.warn("[EMAIL] Aviso: Nenhum conteúdo de arquivo (base64) recebido.");
    } else {
      console.log(`[EMAIL] Tamanho do anexo (Base64): ${fileBufferBase64.length} caracteres`);
    }

    const attachments = [];
    if (fileName && fileBufferBase64) {
      try {
        attachments.push({
          filename: fileName,
          content: Buffer.from(fileBufferBase64, 'base64'),
        });
      } catch (bufErr) {
        console.error("[EMAIL] Erro ao converter base64 para Buffer:", bufErr);
        return res.status(400).json({ error: "Falha ao processar anexo do e-mail" });
      }
    }

    const institutionalEmail = process.env.EMAIL_TO_INSTITUTIONAL;
    if (!institutionalEmail) {
      console.error("[EMAIL] Erro: EMAIL_TO_INSTITUTIONAL não configurado");
      return res.status(400).json({ error: "E-mail institucional não configurado" });
    }

    console.log(`[EMAIL] Enviando para: ${institutionalEmail}`);

    if (!process.env.RESEND_API_KEY) {
      console.error("[EMAIL] Erro: RESEND_API_KEY não configurado");
      return res.status(500).json({ error: "Serviço de e-mail não configurado no servidor (API Key ausente)" });
    }

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: [institutionalEmail],
      subject: subject || "Laudo Técnico de Imóvel - Defesa Civil",
      html: html || "<p>Segue em anexo o laudo técnico solicitado.</p>",
      attachments,
    });

    if (error) {
      console.error("[EMAIL] Erro retornado pelo Resend:", error);
      return res.status(400).json({ error });
    }

    console.log("[EMAIL] E-mail enviado com sucesso via Resend:", data?.id);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("[EMAIL] Erro CRÍTICO ao enviar e-mail:", error);
    res.status(500).json({ error: error.message });
  }
});

app.use("/api", apiRouter);

// Verify R2 Config on startup
if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_ACCESS_KEY_ID || !process.env.CLOUDFLARE_SECRET_ACCESS_KEY) {
  console.warn("AVISO: Configurações do Cloudflare R2 incompletas no .env");
}

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
  console.log(`[SYSTEM] Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`[SYSTEM] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[SYSTEM] R2 Configurado: ${!!process.env.CLOUDFLARE_ACCOUNT_ID}`);
  console.log(`[SYSTEM] Resend Configurado: ${!!process.env.RESEND_API_KEY}`);
});
