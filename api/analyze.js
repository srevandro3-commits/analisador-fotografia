export default async function handler(req, res) {
  // Configuração dos cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
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
      return res.status(500).json({ error: 'Chave de API do Gemini não configurada no servidor.' });
    }

    // Modelo oficial e estável para processamento multimídia rápido
    const MODEL_NAME = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const promptText = `
Você é um especialista e mentor crítico em fotografia.
Analise a imagem enviada considerando os seguintes pilares técnicos e estéticos:
1. Composição e Enquadramento (Regra dos terços, linhas guias, respiro, cortes).
2. Iluminação e Exposição (Altas luzes, sombras, contraste, direção da luz).
3. Foco e Nitidez (Ponto de foco, profundidade de campo).
4. Cores e Pós-processamento (Balanço de branco, saturação, tom de pele).

Forneça um diagnóstico estruturado, didático e construtivo. Aluno/Contexto: ${studentInfo || 'Não informado'}.
    `;

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType || 'image/jpeg',
                data: imageBase64
              }
            }
          ]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro retornado pela API do Gemini:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Erro de comunicação com a API do Gemini.'
      });
    }

    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      return res.status(500).json({ error: 'A API não retornou o texto da análise.' });
    }

    return res.status(200).json({ analysis: analysisText });

  } catch (error) {
    console.error('Erro no processamento interno:', error);
    return res.status(500).json({ error: 'Erro interno ao processar a análise da imagem.' });
  }
}
