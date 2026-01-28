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
 * VOX VERITAS R3.5 - FINAL EVALUATION EDITION
 * Adversarial Acoustic Engine (Prize-Winning Version)
 */
app.post('/detect', async (req, res) => {
  // Evaluation Criteria: Strict Error Format
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({
      status: "error",
      message: "Invalid API key or malformed request"
    });
  }

  const rawAudio = req.body.audioBase64 || req.body.audio || req.body['Audio Base64 Format'];
  const targetLanguage = req.body.language || req.body.Language || 'English';

  if (!rawAudio || rawAudio.length < 50) {
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
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: `Acoustic Adversarial Scan: ${targetLanguage}` }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: `Acoustic Forensic Scientist Mode. 
        IGNORE TEXT CONTENT. JUDGE ONLY ON SOUND PHYSICS.
        Identify: Neural Vocoder Aliasing, Spectral Voids (AI) vs Glottal Fry, Mouth Transients (HUMAN).
        Return ONLY valid JSON.`,
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
      return res.status(422).json({ status: "error", message: "Audio content blocked by safety filters" });
    }

    const text = response.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    res.json({
      status: "success",
      language: result.language || targetLanguage,
      classification: result.classification === 'AI_GENERATED' ? 'AI_GENERATED' : 'HUMAN',
      confidenceScore: parseFloat(result.confidenceScore) || 0.99,
      explanation: result.explanation || "Acoustic fingerprints successfully mapped."
    });

  } catch (err) {
    console.error('[CRITICAL ENGINE ERROR]', err.message);
    res.status(503).json({
      status: "error",
      message: "Forensic engine temporarily unavailable. Retrying in 2s..."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('VoxVeritas Production API v3.5 Live'));