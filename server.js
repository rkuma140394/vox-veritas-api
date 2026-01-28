const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
// 1. INCREASE LIMITS: Essential for Base64 strings which are large
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function callGemini(ai, model, contents, config, retries = 3) {
  try {
    const response = await ai.models.generateContent({ model, contents, config });
    return JSON.parse(response.text);
  } catch (err) {
    if ((err.message.includes('503') || err.message.includes('429')) && retries > 0) {
      console.log(`Forensic Engine busy. Retrying... (${retries} attempts left)`);
      await wait(2000 * (4 - retries));
      return callGemini(ai, model, contents, config, retries - 1);
    }
    throw err;
  }
}

app.post('/detect', async (req, res) => {
  // 1. Authentication Check
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ error: "Invalid API Key" });
  }

  // 2. ULTRA-FLEXIBLE DATA EXTRACTION
  // We check every common field name to prevent "No audio data" errors
  const rawAudio = req.body.audio ||
    req.body.audioData ||
    req.body['Audio Base64 Format'] ||
    req.body.file ||
    req.body.data ||
    req.body.base64;

  const language = req.body.language || req.body.Language || 'English';

  if (!rawAudio || rawAudio.length < 100) {
    return res.status(400).json({
      error: "No audio data",
      message: "Validation failed: Please send a JSON body with the 'audio' key containing a Base64 string. Ensure you use 'Content-Type: application/json'."
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // 3. AUTO-CLEANING: Remove Data URI prefix if the user included it (e.g. data:audio/mp3;base64,...)
    const base64Data = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    const result = await callGemini(
      ai,
      "gemini-3-flash-preview",
      {
        parts: [
          { inlineData: { data: base64Data, mimeType: "audio/mp3" } },
          { text: "Forensic linguistic classification for: " + language }
        ]
      },
      {
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
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Analysis engine failed", detail: err.message });
  }
});

app.listen(3000, () => console.log("FIXED API LIVE: http://localhost:3000"));