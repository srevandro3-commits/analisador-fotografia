module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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
    const { imageBase64, mimeType, studentInfo } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Imagem não fornecida.' });
    }

    let apiKey = process.env.GEMINI_API_KEY || '';
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave GEMINI_API_KEY não configurada na Vercel.' });
    }

    const cleanBase64 = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;

    const promptText = `
Você é um mentor especialista em fotografia profissional e professor técnico.
Analise a imagem enviada considerando os 4 pilares:
1. Composição e Enquadramento (Regra dos terços, linhas guia, respiro, cortes).
2. Iluminação e Exposição (Altas luzes, sombras, contraste, direção da luz).
3. Foco e Nitidez (Ponto de foco, profundidade de campo, nitidez no assunto).
4. Cores e Pós-processamento (Balanço de branco, saturação, tom de pele).

Aluno/Turma: ${studentInfo || 'Não informado'}.
Forneça um laudo didático, direto, construtivo e altamente técnico.
    `;

    // Chamada oficial v1 com gemini-2.5-flash
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.8-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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
      })
    });

    const data = await response.json();

    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ 
        analysis: data.candidates[0].content.parts[0].text 
      });
    }

    const errorMessage = data.error?.message || 'Falha ao processar com a API do Gemini.';
    return res.status(500).json({ error: errorMessage });

  } catch (error) {
    console.error('Erro interno:', error);
    return res.status(500).json({ error: `Erro no servidor: ${error.message}` });
  }
};
