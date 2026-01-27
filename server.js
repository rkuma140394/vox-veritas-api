const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'my_voice_key_123';
const GEMINI_API_KEY = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

app.get('/', (req, res) => {
  res.send('<h1>API Status: Online</h1><p>Auth Key: ' + AUTH_KEY + '</p>');
});

app.post('/detect', async (req, res) => {
  // 1. Auth Check
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ error: "Invalid x-api-key" });
  }

  // 2. Flexible Key Detection (Looks for 'audio', 'audioBase64', or 'Audio Base64 Format')
  const audioBase64 = req.body['Audio Base64 Format'] || req.body.audio || req.body.audioBase64;
  const language = req.body['Language'] || req.body.language || 'English';

  if (!audioBase64) {
    return res.status(400).json({
      error: "No audio data provided",
      received_keys: Object.keys(req.body),
      required_format: '{ "Audio Base64 Format": "...", "Language": "English" }'
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { inlineData: { data: audioBase64, mimeType: "audio/mp3" } },
        { text: "Forensic analysis: Is this " + language + " voice AI or Human?" }
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

    res.json(JSON.parse(response.text.replace(/\`\`\`json|\`\`\`/g, '')));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API Active"));