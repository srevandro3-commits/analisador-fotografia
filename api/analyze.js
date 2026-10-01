export default async function handler(req, res) {
  // Configuração dos cabeçalhos CORS
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Chave GEMINI_API_KEY não configurada na Vercel.' });
    }

    // Trata se a string vier com ou sem o prefixo data:image/...;base64,
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

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType || 'image/jpeg',
                data: cleanBase64
              }
            }
          ]
        }
      ]
    };

    // Tenta primeiro com gemini-1.5-flash e como fallback gemini-1.5-pro
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];
    let lastError = null;

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim()
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.status(200).json({ 
          analysis: data.candidates[0].content.parts[0].text 
        });
      }

      lastError = data.error?.message || JSON.stringify(data);
    }

    return res.status(500).json({ 
      error: `Erro na API do Gemini: ${lastError}` 
    });

  } catch (error) {
    console.error('Erro no processamento interno:', error);
    return res.status(500).json({ 
      error: `Erro no servidor interno: ${error.message}` 
    });
  }
}
