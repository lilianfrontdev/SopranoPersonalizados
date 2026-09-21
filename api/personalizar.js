import OpenAI, { toFile } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ALLOWED_ORIGINS = [
  "https://revenda.soprano.com.br",
  "https://www.revenda.soprano.com.br"
];

function configurarCors(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function converterDataUrl(dataUrl, nomePadrao) {
  const resultado = dataUrl.match(
    /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/
  );

  if (!resultado) {
    throw new Error("Imagem em formato inválido.");
  }

  const mimeType = resultado[1];
  const base64 = resultado[2];

  return {
    buffer: Buffer.from(base64, "base64"),
    mimeType,
    fileName: nomePadrao
  };
}

export default async function handler(req, res) {
  configurarCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const origin = req.headers.origin;

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({
      error: "Origem não autorizada."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  try {
    const {
      produto,
      logo,
      nomeProduto,
      tipoAplicacao = "serigrafia"
    } = req.body ?? {};

    if (!produto || !logo) {
      return res.status(400).json({
        error: "O produto e a logo são obrigatórios."
      });
    }

    const produtoConvertido = converterDataUrl(
      produto,
      "produto.png"
    );

    const logoConvertida = converterDataUrl(
      logo,
      "logo.png"
    );

    const limite = 4 * 1024 * 1024;

    if (
      produtoConvertido.buffer.length > limite ||
      logoConvertida.buffer.length > limite
    ) {
      return res.status(413).json({
        error: "Cada imagem deve ter no máximo 4 MB."
      });
    }

    const produtoFile = await toFile(
      produtoConvertido.buffer,
      produtoConvertido.fileName,
      {
        type: produtoConvertido.mimeType
      }
    );

    const logoFile = await toFile(
      logoConvertida.buffer,
      logoConvertida.fileName,
      {
        type: logoConvertida.mimeType
      }
    );

    const prompt = `
Use a primeira imagem como referência obrigatória do produto
${nomeProduto ? `"${nomeProduto}"` : "Soprano"}.

Use a segunda imagem exclusivamente como o logotipo enviado pelo cliente.

Aplique o logotipo na área frontal personalizável do produto,
simulando uma aplicação profissional por ${tipoAplicacao}.

Regras obrigatórias:
- preserve exatamente o formato do produto;
- não altere a cor do produto;
- não altere tampa, alça, bico, bordas ou componentes;
- preserve o ângulo e a proporção;
- não distorça o produto;
- não invente componentes;
- não altere o fundo original;
- preserve o desenho e as proporções do logotipo;
- não invente letras ou símbolos;
- centralize a logo na área frontal disponível;
- produza uma visualização realista de personalização;
- mantenha a marca Soprano original do produto, quando existente.

Entregue somente a imagem final do produto personalizado.
    `.trim();

    const resultado = await openai.images.edit({
      model: "gpt-image-1.5",
      image: [produtoFile, logoFile],
      prompt,
      input_fidelity: "high",
      quality: "high",
      size: "1024x1024",
      output_format: "png"
    });

    const imagemBase64 = resultado.data?.[0]?.b64_json;

    if (!imagemBase64) {
      throw new Error("A OpenAI não retornou uma imagem.");
    }

    return res.status(200).json({
      image: `data:image/png;base64,${imagemBase64}`
    });
  } catch (error) {
    console.error("Erro na personalização:", error);

    return res.status(500).json({
      error: "Não foi possível gerar a personalização.",
      detail:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
}