const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

app.post('/detect', async (req, res) => {
  // Evaluation Requirement: Strict Error Protocol
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({
      status: "error",
      message: "Invalid API key or malformed request"
    });
  }

  const rawAudio = req.body.audioBase64 || req.body.audio || req.body['Audio Base64 Format'];
  const targetLanguage = req.body.language || req.body.Language || 'English';

  if (!rawAudio || rawAudio.length < 100) {
    return res.status(400).json({
      status: "error",
      message: "Invalid API key or malformed request"
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const cleanBase64 = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: "Forensic Accuracy Audit: " + targetLanguage }
        ]
      }],
      config: {
        systemInstruction: "Detect synthetic artifacts. Focus on South Asian retroflex consonants and breath patterns. Return valid JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            artifactsFound: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['classification', 'confidenceScore', 'explanation', 'artifactsFound']
        }
      }
    });

    const result = JSON.parse(response.text);

    // Evaluation Requirement: Correct Response Format
    res.json({
      status: "success",
      language: targetLanguage,
      classification: result.classification,
      confidenceScore: result.confidenceScore,
      explanation: result.explanation,
      artifactsFound: result.artifactsFound
    });

  } catch (err) {
    res.status(503).json({
      status: "error",
      message: "Invalid API key or malformed request"
    });
  }
});

app.listen(3000, () => console.log('VoxVeritas Production API Live'));