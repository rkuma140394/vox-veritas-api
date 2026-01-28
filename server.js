const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());

// Support JSON and Form data with large limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

app.post('/detect', async (req, res) => {
  console.log('--- Incoming Forensic Request ---');
  console.log('Keys Received:', Object.keys(req.body));

  // 1. Auth Check
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid X-API-KEY header." });
  }

  // 2. EXTRACTION FIX: Added 'audioBase64' to the search list
  let rawAudio = req.body.audio ||
    req.body.audioBase64 ||
    req.body.audioData ||
    req.body['Audio Base64 Format'] ||
    req.body.file ||
    req.body.data;

  const language = req.body.language || req.body.Language || 'English';

  if (!rawAudio || rawAudio.length < 100) {
    console.error('FAIL: No audio data found in keys:', Object.keys(req.body));
    return res.status(400).json({
      error: "No audio data",
      receivedKeys: Object.keys(req.body),
      tip: "Please ensure your JSON body uses the key 'audio' or 'audioBase64'."
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Auto-strip base64 data URIs
    const cleanBase64 = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: `Forensic analysis for ${language} voice. Detect Deepfake vs Human.` }
        ]
      },
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

    console.log('SUCCESS: Analysis Complete');
    res.json(JSON.parse(response.text));
  } catch (err) {
    console.error('SYSTEM ERROR:', err.message);
    res.status(500).json({ error: "Analysis failed", detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('=========================================');
  console.log(`VOXVERITAS API LIVE: http://localhost:${PORT}`);
  console.log('Listening for audio or audioBase64 keys...');
  console.log('=========================================');
});