import { GoogleGenAI, Type, ThinkingLevel, Modality } from "@google/genai";
import { IntelligenceData, ChatMessage } from "../types";

const BRAZIL_OSINT_RESOURCES = `
Brazilian OSINT Resources & Knowledge Base:
- OSINT Brazuca (osintbrazuca/osint-brazuca): Primary repository for Brazilian public data (CNPJ, TSE, Receita Federal, government portals).
- OSINTKit-Brasil (sudo-flgr/OSINTKit-Brasil): Curated collection of 1,600+ Brazilian OSINT links and tools.
- OSINT-Tools-Brazil (bgmello/OSINT-Tools-Brazil): Reorganized Brazilian OSINT resources.
- Capivara OSINT (rafabez/OSINT-Framework-BRFork): Brazilian fork of the OSINT Framework (capivaraosint.cc).
- br-acc (World Transparency Graph): Robust ETL for Brazilian transparency data (CNPJ, Portal da Transparência, TSE).
- Blackbird: Tool for username searches with strong Brazilian community adoption.
- Local Tools: Sherlock, Maigret, SpiderFoot, Recon-ng (optimized for .br domains).
- Data Sources: Registro.br, IBGE, TSE (Electoral data), Sancionados, Wigle.net (Wi-Fi data in BR).
`;

function getApiKey() {
  // Try platform-provided key first, then fallback to environment variables
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY;
  console.log("Intelligence Engine: Retrieving API key...", key ? "Key found (length: " + key.length + ")" : "No key found");
  if (!key || key === "undefined" || key === "null" || key === "") return "";
  return key;
}

function getAI() {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey });
}

async function callGemini(
  prompt: string | any,
  config: any = {},
  systemInstruction?: string
): Promise<any> {
  const ai = getAI();
  // Use gemini-3-flash-preview as the absolute base model
  const model = "gemini-3-flash-preview";

  // Define tool configurations: try with tools first, then without
  const toolConfigs = [];
  if (config.tools && config.tools.length > 0) {
    toolConfigs.push({ tools: config.tools });
  }
  toolConfigs.push({ tools: [] });

  let lastError: any = null;

  for (const toolConfig of toolConfigs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: typeof prompt === 'string' ? prompt : prompt,
          config: {
            ...config,
            ...toolConfig,
            systemInstruction: systemInstruction || config.systemInstruction,
          }
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = err.message || "";
        console.warn(`Gemini call attempt failed (Tools: ${toolConfig.tools?.length > 0}):`, err);

        // If it's an API key error, it might be tool-specific or general
        if (msg.includes("API key not valid") || msg.includes("Invalid API key")) {
          // If we still have tool configurations to try, continue to the next one (which might be no tools)
          if (toolConfig.tools && toolConfig.tools.length > 0) {
            break; // Break attempt loop to try next toolConfig
          }
          // If we're already at no tools and still getting API key error, it's a real key issue
          throw new Error("Intelligence Engine: Connection Error. Please verify your connection or key status.");
        }

        // If it's a tool-related error or permission error, break to try next config
        if (msg.includes("tool") || msg.includes("permission") || msg.includes("not authorized") || msg.includes("403")) {
          break; 
        }

        // Wait before retry
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Intelligence engine call failed.");
}

export async function performIntelligenceSearch(query: string, highThinking: boolean = false, brazilLayer: boolean = false): Promise<IntelligenceData> {
  const prompt = `
    Perform a deep OSINT, Security Intelligence, and World Transparency Graph analysis for the target: "${query}".
    
    CRITICAL DATA POINTS TO IDENTIFY:
    - CPF (Brazilian Tax ID) and CNPJ (Corporate Tax ID).
    - Full Names and Birth Dates.
    - Physical Addresses and Phone Numbers.
    - Family Connections: Parents, Children, and Spouses.
    - Corporate Structures and Political Connections.
    
    ${brazilLayer ? `BRAZIL LAYER ENABLED:
    Use the following Brazilian OSINT knowledge base to enrich the search:
    ${BRAZIL_OSINT_RESOURCES}
    Focus on Brazilian-specific entities: CNPJ, CPF, TSE, Portal da Transparência, and .br domains.
    ` : 'Focus on global OSINT and Transparency Graph logic.'}

    1. Search for public data, social media profiles, associated domains, and mentions in known data leaks.
    2. Identify relationships between these entities.
    3. Format the output as a JSON object with:
       - nodes: Array of { id, label, type } where type is one of: 'target', 'email', 'domain', 'social', 'leak', 'public_data', 'person', 'company', 'political', 'financial'.
       - links: Array of { source, target, label }.
       - report: A detailed Markdown report summarizing the findings, including a specific "Transparency & Risk Assessment" section.
    
    Structure the graph data to show how the target is connected to other entities found, emphasizing corporate, political, and family links.
  `;

  const response = await callGemini(prompt, {
    tools: [{ googleSearch: {} }],
    responseMimeType: "application/json",
    thinkingConfig: highThinking ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['target', 'email', 'domain', 'social', 'leak', 'public_data', 'person', 'company', 'political', 'financial'] }
            },
            required: ['id', 'label', 'type']
          }
        },
        links: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              source: { type: Type.STRING },
              target: { type: Type.STRING },
              label: { type: Type.STRING }
            },
            required: ['source', 'target']
          }
        },
        report: { type: Type.STRING }
      },
      required: ['nodes', 'links', 'report']
    }
  });

  const rawText = response.text || "{}";
  const data = JSON.parse(rawText);
  
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    uri: chunk.web?.uri || "",
    title: chunk.web?.title || "Source"
  })).filter((s: any) => s.uri) || [];

  return {
    ...data,
    sources,
    context: rawText
  };
}

export async function performMapsSearch(query: string, lat?: number, lng?: number): Promise<any> {
  const response = await callGemini(
    `Locate and analyze geographic data for: "${query}". Provide details about locations, nearby entities, and spatial intelligence.`,
    {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: lat && lng ? {
          latLng: { latitude: lat, longitude: lng }
        } : undefined
      }
    }
  );

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    uri: chunk.maps?.uri || "",
    title: chunk.maps?.title || "Map Location"
  })).filter((s: any) => s.uri) || [];

  return {
    report: response.text,
    sources
  };
}

export async function generateIntelligenceImage(prompt: string, size: "1K" | "2K" | "4K" = "1K"): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Generate a high-quality intelligence visualization or evidence reconstruction for: ${prompt}` }],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    },
  });

  for (const part of response.candidates?.[0]?.content.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
}

export async function generateIntelligenceVideo(prompt: string, imageBase64?: string): Promise<string> {
  const ai = getAI();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-lite-generate-preview',
    prompt: `Animate this intelligence scenario: ${prompt}`,
    image: imageBase64 ? {
      imageBytes: imageBase64.split(',')[1],
      mimeType: 'image/png',
    } : undefined,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");

  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: { 'x-goog-api-key': getApiKey() },
  });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function analyzeMedia(prompt: string, fileBase64: string, mimeType: string): Promise<string> {
  const response = await callGemini(
    {
      parts: [
        { inlineData: { data: fileBase64.split(',')[1], mimeType } },
        { text: prompt }
      ]
    },
    {
      systemInstruction: "You are an expert forensic media analyst. Analyze the provided image or video for key intelligence, objects, text, and metadata."
    }
  );
  return response.text || "Analysis failed.";
}

export async function textToSpeech(text: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this intelligence report with a professional, serious tone: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }
  throw new Error("TTS failed");
}

export async function chatIntelligence(
  message: string, 
  context: string, 
  history: ChatMessage[],
  highThinking: boolean = false,
  brazilLayer: boolean = false
): Promise<{ text: string; nodes?: any[]; links?: any[] }> {
  const contents = [
    {
      role: 'user',
      parts: [{ text: `System Context (Intelligence Data): ${context}` }]
    },
    ...history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    })),
    {
      role: 'user',
      parts: [{ text: message }]
    }
  ];

  const response = await callGemini(contents, {
    tools: [{ googleSearch: {} }],
    responseMimeType: "application/json",
    thinkingConfig: highThinking ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
    systemInstruction: `You are an OSINT analyst. Answer questions based on the provided intelligence context and perform additional searches if necessary.
    ${brazilLayer ? `BRAZIL LAYER ENABLED: Use the following Brazilian OSINT knowledge base to enrich the conversation: ${BRAZIL_OSINT_RESOURCES}` : ''}
    If the conversation reveals NEW entities or relationships (CPF, CNPJ, family, addresses), provide them in the 'nodes' and 'links' arrays so the intelligence graph can be updated.
    Return a JSON object with:
    - text: Your conversational response (Markdown).
    - nodes: (Optional) Array of new { id, label, type } to add to the graph.
    - links: (Optional) Array of new { source, target, label } to add to the graph.`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['target', 'email', 'domain', 'social', 'leak', 'public_data', 'person', 'company', 'political', 'financial'] }
            },
            required: ['id', 'label', 'type']
          }
        },
        links: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              source: { type: Type.STRING },
              target: { type: Type.STRING },
              label: { type: Type.STRING }
            },
            required: ['source', 'target']
          }
        }
      },
      required: ['text']
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      text: data.text || "No response from intelligence engine.",
      nodes: data.nodes,
      links: data.links
    };
  } catch (e) {
    return { text: response.text || "No response from intelligence engine." };
  }
}

export async function expandIntelligenceNode(
  nodeId: string, 
  nodeLabel: string, 
  currentData: IntelligenceData, 
  highThinking: boolean = false,
  brazilLayer: boolean = false
): Promise<IntelligenceData> {
  const prompt = `
    Expand the intelligence graph for the specific node: "${nodeLabel}" (ID: ${nodeId}).
    The current graph context has ${currentData.nodes?.length || 0} nodes.
    
    ${brazilLayer ? `BRAZIL LAYER ENABLED: Use the following Brazilian OSINT knowledge base to enrich the expansion: ${BRAZIL_OSINT_RESOURCES}` : ''}

    1. Find new connections, entities, or data points specifically related to "${nodeLabel}".
    2. Look for:
       - Associated social media, emails, or domains.
       - Corporate or political links (Transparency Graph logic).
       - Mentions in leaks or public records.
       - CRITICAL: CPF, CNPJ, family connections, addresses.
    3. Return NEW nodes and links that should be added to the existing graph.
    4. Format the output as a JSON object with:
       - nodes: Array of { id, label, type }.
       - links: Array of { source, target, label }.
       - report: A brief update summarizing the new findings.
  `;

  const response = await callGemini(prompt, {
    tools: [{ googleSearch: {} }],
    responseMimeType: "application/json",
    thinkingConfig: highThinking ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['target', 'email', 'domain', 'social', 'leak', 'public_data', 'person', 'company', 'political', 'financial'] }
            },
            required: ['id', 'label', 'type']
          }
        },
        links: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              source: { type: Type.STRING },
              target: { type: Type.STRING },
              label: { type: Type.STRING }
            },
            required: ['source', 'target']
          }
        },
        report: { type: Type.STRING }
      },
      required: ['nodes', 'links', 'report']
    }
  });

  const rawText = response.text || "{}";
  const data = JSON.parse(rawText);
  
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    uri: chunk.web?.uri || "",
    title: chunk.web?.title || "Source"
  })).filter((s: any) => s.uri) || [];

  return {
    ...data,
    sources,
    context: rawText
  };
}

export async function performForensicTool(
  tool: 'username' | 'email' | 'domain' | 'ip', 
  target: string
): Promise<string> {
  const prompts = {
    username: `Search for the username "${target}" across social media, forums, and public databases. Identify possible owners and associated profiles.`,
    email: `Check the email "${target}" for mentions in data breaches, social media, and professional networks.`,
    domain: `Perform a deep WHOIS, DNS, and sub-domain analysis for "${target}". Identify hosting, mail servers, and associated entities.`,
    ip: `Analyze the IP address "${target}" (IPv4/IPv6). Identify geographic location, ISP, associated domains, and potential security risks.`
  };

  const response = await callGemini(prompts[tool], { tools: [{ googleSearch: {} }] });

  return response.text || "Forensic tool failed.";
}

