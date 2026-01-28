const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'my_voice_key_123';
const GEMINI_API_KEY = process.env.API_KEY;

// Reliability: Helper for Exponential Backoff
const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function callGeminiWithRetry(ai, payload, retries = 3) {
  try {
    const response = await ai.models.generateContent(payload);
    return JSON.parse(response.text.replace(/\`\`\`json|\`\`\`/g, ''));
  } catch (err) {
    const isOverloaded = err.message.includes('503') || err.message.includes('429');
    if (isOverloaded && retries > 0) {
      console.log(`[RETRY] Model busy, waiting ${(4 - retries) * 2}s...`);
      await wait(2000 * (4 - retries));
      return callGeminiWithRetry(ai, payload, retries - 1);
    }
    throw err;
  }
}

app.post('/detect', async (req, res) => {
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ error: "Invalid x-api-key" });
  }

  const audioBase64 = req.body['Audio Base64 Format'] || req.body.audio;
  const language = req.body['Language'] || 'English';

  if (!audioBase64) return res.status(400).json({ error: "No audio data" });

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });
    const result = await callGeminiWithRetry(ai, {
      model: "gemini-3-flash-preview",
      contents: [
        { inlineData: { data: audioBase64, mimeType: "audio/mp3" } },
        { text: "Forensic analysis for " + language }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            languageDetected: { type: Type.STRING },
            artifactsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['classification', 'confidenceScore', 'explanation', 'languageDetected', 'artifactsFound'],
        }
      }
    });

    res.json(result);
  } catch (err) {
    const status = err.message.includes('503') ? 503 : 500;
    res.status(status).json({
      error: "Service unavailable: The AI model is currently overloaded. Please try again.",
      details: err.message
    });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Reliable API Active"));