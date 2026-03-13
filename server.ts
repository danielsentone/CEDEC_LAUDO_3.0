import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resend } from "resend";
import fs from "fs";
import path from "path";

dotenv.config();

async function startServer() {
  // Global error handlers
  process.on('uncaughtException', (err) => {
    console.error('[SYSTEM] Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[SYSTEM] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Multer for file uploads with increased limits
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
  });

  // R2 Client Getter (Lazy initialization to prevent crashes if env vars are missing)
  let _s3Client: S3Client | null = null;
  const getS3Client = () => {
    if (!_s3Client) {
      if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_ACCESS_KEY_ID || !process.env.CLOUDFLARE_SECRET_ACCESS_KEY) {
        throw new Error("Configuração do Cloudflare R2 incompleta");
      }
      _s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
          secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
        },
        forcePathStyle: false,
      });
    }
    return _s3Client;
  };

  // Resend Client
  const resend = new Resend(process.env.RESEND_API_KEY);

  const app = express();
  const PORT = 3000;

  // Global request logger for debugging
  app.use((req, res, next) => {
    console.log(`[SYSTEM] ${new Date().toISOString()} ${req.method} ${req.url}`);
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
      vercel: !!process.env.VERCEL,
      env: {
        r2: !!process.env.CLOUDFLARE_ACCOUNT_ID,
        resend: !!process.env.RESEND_API_KEY,
        email: !!process.env.EMAIL_TO_INSTITUTIONAL,
        supabase: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL
      }
    });
  });

  apiRouter.post("/upload", (req, res, next) => {
    console.log("[UPLOAD] Iniciando processamento de multipart/form-data...");
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error("[UPLOAD] Erro do Multer:", err);
        return res.status(400).json({ error: `Erro no upload: ${err.message}`, code: err.code });
      } else if (err) {
        console.error("[UPLOAD] Erro desconhecido no Multer:", err);
        return res.status(500).json({ error: "Erro interno no processamento do arquivo" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      console.log("[UPLOAD] Recebendo pedido de upload após processamento Multer...");
      
      if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_ACCESS_KEY_ID || !process.env.CLOUDFLARE_SECRET_ACCESS_KEY) {
          console.error("[UPLOAD] Erro: Credenciais R2 incompletas");
          return res.status(500).json({ error: "Configuração de armazenamento (R2) incompleta no servidor" });
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

      const s3Client = getS3Client();
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

  // New endpoint for Presigned URLs (Bypasses Vercel Payload Limits)
  apiRouter.post("/presigned-url", async (req, res) => {
    try {
      const { fileName, contentType } = req.body;
      console.log(`[PRESIGNED] Gerando URL para: ${fileName}, Tipo: ${contentType}`);

      if (!fileName) {
        return res.status(400).json({ error: "fileName é obrigatório" });
      }

      if (!process.env.CLOUDFLARE_PUBLIC_URL) {
        console.error("[PRESIGNED] Erro: CLOUDFLARE_PUBLIC_URL não configurado");
        return res.status(500).json({ error: "Configuração de URL pública do R2 ausente no servidor" });
      }

      const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || "laudosdefesacivil";
      const s3Client = getS3Client();

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        ContentType: contentType || "application/pdf",
      });

      // URL expires in 15 minutes
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      const publicUrl = `${process.env.CLOUDFLARE_PUBLIC_URL}/${fileName}`;

      console.log(`[PRESIGNED] URL gerada com sucesso. URL Pública: ${publicUrl}`);
      res.json({ uploadUrl: signedUrl, publicUrl });
    } catch (error: any) {
      console.error("[PRESIGNED] Erro ao gerar URL:", error);
      res.status(500).json({ error: error.message });
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

      const s3Client = getS3Client();
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
      const { subject, html, fileName, fileBufferBase64, fileUrl } = req.body;
      console.log(`[EMAIL] Recebido pedido de envio. Assunto: ${subject}, Arquivo: ${fileName}`);

      if (fileUrl) {
        console.log(`[EMAIL] Usando URL do arquivo para anexo: ${fileUrl}`);
      } else if (!fileBufferBase64) {
        console.warn("[EMAIL] Aviso: Nenhum conteúdo de arquivo (base64 ou URL) recebido.");
      } else {
        console.log(`[EMAIL] Tamanho do anexo (Base64): ${fileBufferBase64.length} caracteres`);
      }

      const attachments = [];
      if (fileName) {
        if (fileUrl) {
          // Resend supports URLs in attachments
          attachments.push({
            filename: fileName,
            path: fileUrl,
          });
        } else if (fileBufferBase64) {
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

  // Vite middleware for development or fallback if dist is missing
  const isProduction = process.env.NODE_ENV === "production";
  const isVercel = !!process.env.VERCEL;
  const distExists = fs.existsSync(path.resolve("dist"));

  if (!isVercel && (!isProduction || !distExists)) {
    console.log(`[SYSTEM] Usando middleware Vite (Produção: ${isProduction}, Dist existe: ${distExists})`);
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.error("[SYSTEM] Erro ao carregar Vite middleware:", viteErr);
      app.get("*", (req, res) => {
        res.status(500).send("Erro do Servidor: Falha ao carregar o ambiente de desenvolvimento (Vite).");
      });
    }
  } else if (distExists) {
    console.log("[SYSTEM] Servindo arquivos estáticos da pasta 'dist'");
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  // Only start the server if this file is run directly (not as a serverless function)
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[SYSTEM] Servidor rodando em http://0.0.0.0:${PORT}`);
      console.log(`[SYSTEM] NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`[SYSTEM] R2 Configurado: ${!!process.env.CLOUDFLARE_ACCOUNT_ID}`);
      console.log(`[SYSTEM] Resend Configurado: ${!!process.env.RESEND_API_KEY}`);
    });
  }

  return app;
}

const appPromise = startServer();
export default await appPromise;
