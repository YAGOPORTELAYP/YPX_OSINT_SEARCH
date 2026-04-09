import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function performFaceAnalysis(imageBase64: string, highThinking: boolean = false) {
  const prompt = `
    Perform a Level 9 Cognitive Biometric Analysis on the provided image.
    1. Detect all faces in the image.
    2. For each face, provide:
       - Estimated age and gender.
       - Emotional state.
       - Distinctive features (scars, tattoos, glasses, etc.).
       - Potential identification (if the person is a public figure or found in public records).
    3. Provide a detailed forensic report in Markdown.
    4. Return a JSON object with the analysis data.
  `;

  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: imageBase64.split(',')[1] || imageBase64,
    },
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          faces: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                age: { type: Type.STRING },
                gender: { type: Type.STRING },
                emotion: { type: Type.STRING },
                features: { type: Type.ARRAY, items: { type: Type.STRING } },
                identification: { type: Type.STRING },
                box: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.NUMBER },
                    left: { type: Type.NUMBER },
                    bottom: { type: Type.NUMBER },
                    right: { type: Type.NUMBER }
                  }
                }
              }
            }
          },
          report: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text);
}
