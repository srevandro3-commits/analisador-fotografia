module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Resposta para preflight do navegador
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Somente POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido.'
    });
  }

  try {
    const {
      imageBase64,
      mimeType,
      studentInfo
    } = req.body || {};

    // ---------------------------------------------------------
    // 1. VALIDAÇÃO DA IMAGEM
    // ---------------------------------------------------------
    if (!imageBase64) {
      return res.status(400).json({
        error: 'Imagem não fornecida.'
      });
    }

    // ---------------------------------------------------------
    // 2. CHAVE DA API
    // ---------------------------------------------------------
    let apiKey = process.env.GEMINI_API_KEY || '';

    apiKey = apiKey
      .trim()
      .replace(/^["']|["']$/g, '');

    if (!apiKey) {
      return res.status(500).json({
        error: 'Chave GEMINI_API_KEY não configurada na Vercel.'
      });
    }

    // ---------------------------------------------------------
    // 3. LIMPEZA DO BASE64
    // ---------------------------------------------------------
    const cleanBase64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    // ---------------------------------------------------------
    // 4. MIME TYPE
    // ---------------------------------------------------------
    const finalMimeType =
      mimeType ||
      'image/jpeg';

    // ---------------------------------------------------------
    // 5. CONTEXTO DO ALUNO
    // ---------------------------------------------------------
    const finalStudentInfo =
      studentInfo && String(studentInfo).trim()
        ? String(studentInfo).trim()
        : 'Não informado';

    // ---------------------------------------------------------
    // 6. PROMPT DA ANÁLISE
    // ---------------------------------------------------------
    const promptText = `
Você é um especialista e mentor crítico em fotografia profissional.

Analise a imagem enviada considerando estes 4 pilares:

1. Composição e Enquadramento
- Regra dos terços quando aplicável
- Linhas guias
- Respiro
- Cortes
- Distribuição dos elementos
- Equilíbrio visual
- Enquadramento

2. Iluminação e Exposição
- Altas luzes
- Sombras
- Contraste
- Direção da luz
- Qualidade da luz
- Exposição geral
- Possíveis problemas de iluminação

3. Foco e Nitidez
- Ponto de foco
- Nitidez do assunto principal
- Profundidade de campo
- Desfoque
- Possíveis problemas técnicos de foco

4. Cores e Pós-processamento
- Balanço de branco
- Saturação
- Contraste
- Tons
- Tom de pele, quando houver
- Aspecto geral da edição

Aluno/Contexto:
${finalStudentInfo}

OBJETIVO DA ANÁLISE:

Faça um diagnóstico direto, didático e construtivo.

Não trate regras fotográficas como verdades absolutas.
Explique quando uma escolha pode ser intencional e quando ela parece prejudicar a fotografia.

A análise deve ajudar o aluno a:
- perceber o que está acontecendo na fotografia;
- entender por que determinado resultado aconteceu;
- identificar o que poderia ser melhorado;
- aprender a tomar decisões fotográficas melhores.

Sempre que possível, diferencie:
- problema técnico;
- escolha estética;
- escolha criativa;
- oportunidade de melhoria.

Estruture a resposta de maneira clara, com títulos e parágrafos curtos.

Não invente informações que não possam ser observadas na imagem.
`;

    // ---------------------------------------------------------
    // 7. PAYLOAD GEMINI
    // ---------------------------------------------------------
    const payload = {
      contents: [
        {
          parts: [
            {
              text: promptText
            },
            {
              inline_data: {
                mime_type: finalMimeType,
                data: cleanBase64
              }
            }
          ]
        }
      ]
    };

    // ---------------------------------------------------------
    // 8. URL DA API GEMINI
    // ---------------------------------------------------------
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    // ---------------------------------------------------------
    // 9. RETRY AUTOMÁTICO
    //
    // O Gemini pode retornar:
    // 408 - timeout
    // 429 - excesso de requisições
    // 500 - erro interno
    // 502 - gateway
    // 503 - serviço temporariamente indisponível
    // 504 - timeout
    //
    // Esses erros podem ser temporários.
    // ---------------------------------------------------------
    const maxAttempts = 4;

    let response = null;
    let data = null;
    let lastErrorMessage = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        // Tenta interpretar a resposta como JSON
        const responseText = await response.text();

        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          data = {
            error: {
              message: responseText || 'Resposta inválida da API Gemini.'
            }
          };
        }

        // -----------------------------------------------------
        // SUCESSO
        // -----------------------------------------------------
        if (
          response.ok &&
          data.candidates?.[0]?.content?.parts?.[0]?.text
        ) {
          return res.status(200).json({
            analysis:
              data.candidates[0].content.parts[0].text
          });
        }

        // -----------------------------------------------------
        // ERRO
        // -----------------------------------------------------
        lastErrorMessage =
          data.error?.message ||
          JSON.stringify(data);

        const status = response.status;

        // Erros que podem ser temporários
        const retryableStatusCodes = [
          408,
          429,
          500,
          502,
          503,
          504
        ];

        const shouldRetry =
          retryableStatusCodes.includes(status);

        // Se não é um erro temporário, não adianta repetir
        if (!shouldRetry) {
          break;
        }

        // Se ainda existem tentativas, aguarda antes de repetir
        if (attempt < maxAttempts) {

          // Espera exponencial:
          // aproximadamente 1s
          // aproximadamente 2s
          // aproximadamente 4s
          const baseDelay =
            Math.pow(2, attempt - 1) * 1000;

          // Pequeno jitter para evitar várias requisições
          // exatamente no mesmo momento
          const jitter =
            Math.floor(Math.random() * 500);

          const delay =
            baseDelay + jitter;

          await new Promise(resolve =>
            setTimeout(resolve, delay)
          );
        }

      } catch (networkError) {

        // Erro de rede/fetch também pode ser temporário
        lastErrorMessage =
          networkError.message ||
          'Erro de comunicação com a API Gemini.';

        if (attempt < maxAttempts) {

          const baseDelay =
            Math.pow(2, attempt - 1) * 1000;

          const jitter =
            Math.floor(Math.random() * 500);

          const delay =
            baseDelay + jitter;

          await new Promise(resolve =>
            setTimeout(resolve, delay)
          );

        } else {

          return res.status(500).json({
            error:
              `Erro de comunicação com a API Gemini: ${lastErrorMessage}`
          });
        }
      }
    }

    // ---------------------------------------------------------
    // 10. ERRO FINAL
    // ---------------------------------------------------------

    if (response && response.status === 503) {
      return res.status(503).json({
        error:
          'O Gemini está temporariamente com alta demanda. ' +
          'O sistema tentou novamente automaticamente, mas o serviço continuou indisponível. ' +
          'Aguarde alguns instantes e tente gerar a análise novamente.'
      });
    }

    if (response && response.status === 429) {
      return res.status(429).json({
        error:
          'O limite temporário de solicitações do Gemini foi atingido. ' +
          'Aguarde alguns instantes e tente novamente.'
      });
    }

    if (response && response.status >= 500) {
      return res.status(response.status).json({
        error:
          `O serviço Gemini apresentou um erro temporário após várias tentativas. ${lastErrorMessage}`
      });
    }

    return res.status(500).json({
      error:
        `Erro na API do Gemini: ${lastErrorMessage}`
    });

  } catch (error) {

    console.error('Erro interno no analisador:', error);

    return res.status(500).json({
      error:
        `Erro interno no servidor: ${error.message}`
    });
  }
};
