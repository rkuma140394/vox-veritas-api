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
 * VOX VERITAS R3.1 - HACKATHON EDITION
 * Adversarial Forensic Engine
 */
app.post('/detect', async (req, res) => {
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ status: "error", message: "Unauthorized." });
  }

  const rawAudio = req.body.audioBase64 || req.body.audio || req.body['Audio Base64 Format'];
  const targetLanguage = req.body.language || req.body.Language || 'English';

  if (!rawAudio) return res.status(400).json({ status: "error", message: "No audio." });

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const cleanBase64 = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: `Forensic adversarial scan for ${targetLanguage}.` }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: `Perform ADVERSARIAL analysis. 
        PROSECUTE for AI artifacts: High-freq spectral voids, vocoder jitter, perfect cadence.
        DEFEND for Human traces: Glottal fry, room impulse, mouth transients, natural breath.
        Only classify as AI_GENERATED if specific synthetic seams are found.
        The "language" field MUST be "${targetLanguage}".`,
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

    const text = response.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    res.json({
      status: "success",
      language: result.language || targetLanguage,
      classification: result.classification === 'AI_GENERATED' ? 'AI_GENERATED' : 'HUMAN',
      confidenceScore: parseFloat(result.confidenceScore) || 0.95,
      explanation: result.explanation || "Scan successful."
    });

  } catch (err) {
    res.status(503).json({ status: "error", message: "Engine busy." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('VoxVeritas Production API Live'));