import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Lakukan pencarian Google Search dengan query: "site:youtube.com react js tutorial". Ambil 5 hasil pencarian video YouTube teratas.`,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });

  console.log("Text:", response.text);
  console.log("Grounding Chunks:", JSON.stringify(response.candidates?.[0]?.groundingMetadata?.groundingChunks, null, 2));
}

test();
