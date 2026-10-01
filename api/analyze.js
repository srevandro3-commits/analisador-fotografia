import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // Cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { imageBase64, mimeType, studentInfo } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Imagem não fornecida.' });
    }

    let apiKey = process.env.GEMINI_API_KEY || '';
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave GEMINI_API_KEY não configurada na Vercel.' });
    }

    // Inicializa o cliente oficial da SDK
    const ai = new GoogleGenAI({ apiKey });

    // Trata o Base64
    const cleanBase64 = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;

    const promptText = `
Você é um especialista e mentor crítico em fotografia profissional.
Analise a imagem enviada considerando estes 4 pilares:
1. Composição e Enquadramento (Regra dos terços, linhas guias, respiro, cortes).
2. Iluminação e Exposição (Altas luzes, sombras, contraste, direção da luz).
3. Foco e Nitidez (Ponto de foco, profundidade de campo).
4. Cores e Pós-processamento (Balanço de branco, saturação, tom de pele).

Aluno/Contexto: ${studentInfo || 'Não informado'}.
Forneça um diagnóstico direto, didático e construtivo.
    `;

    // Chamada usando o modelo atual recomendado
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64
              }
            }
          ]
        }
      ]
    });

    if (response && response.text) {
      return res.status(200).json({ 
        analysis: response.text 
      });
    }

    return res.status(500).json({ 
      error: 'Não foi possível obter a resposta da IA.' 
    });

  } catch (error) {
    console.error('Erro na API do Gemini:', error);
    return res.status(500).json({ 
      error: `Erro na API do Gemini: ${error.message || error}` 
    });
  }
}
