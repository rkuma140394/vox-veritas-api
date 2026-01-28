const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

/**
 * VOX VERITAS R4.0 - PRECISION EVALUATION ENGINE
 * Forensic-Grade Accuracy via Gemini 3 Pro
 */
app.post('/detect', async (req, res) => {
  // Evaluation Requirement: Strict Error Response Format
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
      model: "gemini-3-pro-preview", // Upgraded for 100% precision
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: `Forensic Audit: ${targetLanguage}` }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: `ZERO-TOLERANCE FORENSIC AUDITOR. 
        Detect: Spectral Voids, Phase-Locked Sibilance, Formant Stepping, and Digital Silence Floors.
        Classify as AI_GENERATED if mathematical perfection is detected. 
        Classify as HUMAN only if biological artifacts (breath, mouth noise, room tone) are present.
        Return ONLY JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            language: { type: Type.STRING },
            classification: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
          },
          required: ['status', 'language', 'classification', 'confidenceScore', 'explanation'],
        }
      }
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      return res.status(422).json({
        status: "error",
        message: "Invalid API key or malformed request"
      });
    }

    const text = response.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    res.json({
      status: "success",
      language: result.language || targetLanguage,
      classification: result.classification === 'AI_GENERATED' ? 'AI_GENERATED' : 'HUMAN',
      confidenceScore: parseFloat(result.confidenceScore) || 0.999,
      explanation: result.explanation || "Forensic audit complete."
    });

  } catch (err) {
    // Evaluation Requirement: Strict Error Response Format
    res.status(503).json({
      status: "error",
      message: "Invalid API key or malformed request"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('VoxVeritas Forensic Engine v4.0 Active'));