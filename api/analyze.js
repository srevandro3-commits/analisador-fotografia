export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
    }

    const systemPrompt = `Você é um fotógrafo profissional experiente e instrutor de fotografia didático.
Analise a imagem enviada sob quatro aspectos:

1. TÉCNICA E ILUMINAÇÃO: Avalie nitidez, uso da luz, profundidade de campo e controle de ruído.
2. COMPOSIÇÃO E ENQUADRAMENTO: Analise o equilíbrio visual, pontos de interesse e a intenção do enquadramento.
3. FORÇA VISUAL E IMPACTO: Avalie a intenção narrativa, escolha do assunto e contexto.
4. GUIA DE EDIÇÃO: Dê passos concretos de pós-processamento no Lightroom/Photoshop.

IMPORTANTE PARA O REENQUADRAMENTO:
No final da sua resposta, forneça OBRIGATORIAMENTE um bloco JSON com a sugestão do retângulo de corte ideal (crop) em percentual em relação à foto original, no seguinte formato exato:
\`\`\`json
{
  "crop": {
    "topPercent": 10,
    "leftPercent": 15,
    "widthPercent": 70,
    "heightPercent": 80
  }
}
\`\`\`
Forneça a análise detalhada em HTML limpo (usando divs com as classes 'section-title' e 'feedback-block'). Mantenha um tom encorajador, instrutivo e direto ao ponto.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro ao conectar com a API do Gemini');
    }

    const resultHtml = data.candidates[0].content.parts[0].text;
    return res.status(200).json({ analysis: resultHtml });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao processar a análise da imagem.' });
  }
}