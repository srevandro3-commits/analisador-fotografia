module.exports = async function handler(req, res) {
  // Configuração dos cabeçalhos CORS
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

    let apiKey = process.env.GROQ_API_KEY || '';
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave GROQ_API_KEY não configurada na Vercel.' });
    }

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

    // Payload compatível com a API da Groq (Llama 3.2 Vision)
    const payload = {
      model: "llama-3.2-11b-vision-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType || 'image/jpeg'};base64,${cleanBase64}`
              }
            }
          ]
        }
      ],
      temperature: 0.2
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok && data.choices?.[0]?.message?.content) {
      return res.status(200).json({ 
        analysis: data.choices[0].message.content 
      });
    }

    const errorMessage = data.error?.message || JSON.stringify(data);
    return res.status(500).json({ 
      error: `Erro na API da Groq: ${errorMessage}` 
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return res.status(500).json({ 
      error: `Erro no servidor interno: ${error.message}` 
    });
  }
};
