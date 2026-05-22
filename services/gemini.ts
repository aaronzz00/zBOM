import { GoogleGenAI } from "@google/genai";
import { BOMNode } from "../types";

const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to flatten BOM for context window efficiency if needed, 
// but for now we send the structured subtree.
const formatBOMForPrompt = (node: BOMNode): string => {
  return JSON.stringify(node, (key, value) => {
    // Remove UI state to save tokens
    if (key === 'isExpanded' || key === 'id') return undefined;
    return value;
  }, 2);
};

export const analyzeBOMNode = async (node: BOMNode, task: 'optimize' | 'risks' | 'alternatives'): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const bomContext = formatBOMForPrompt(node);

  let systemInstruction = "You are an expert Senior Supply Chain Engineer and Electronics Manufacturing specialist.";
  let prompt = "";

  switch (task) {
    case 'optimize':
      systemInstruction += " Your goal is to identify cost reduction opportunities in the Bill of Materials.";
      prompt = `Analyze the following BOM structure for the item "${node.name}" (${node.partNumber}).
      Identify top 3 cost drivers. Suggest specific strategies to reduce cost (e.g., alternative manufacturing processes, consolidation of parts, supplier negotiation strategies).
      
      BOM Data:
      ${bomContext}`;
      break;

    case 'risks':
      systemInstruction += " Your goal is to identify supply chain risks (single source, obsolescence, lead times).";
      prompt = `Analyze the following BOM for "${node.name}". 
      Highlight any high-risk components based on the data provided (e.g. long lead times, critical single components). 
      If no explicit risk data is present, infer potential risks based on the component type (e.g. Memory, SoC often have market volatility).
      
      BOM Data:
      ${bomContext}`;
      break;

    case 'alternatives':
      systemInstruction += " Your goal is to suggest alternative components or manufacturers.";
      prompt = `For the component "${node.name}" (${node.partNumber}) and its immediate children, suggest generic or specific alternatives if applicable. 
      Focus on standard parts (screws, connectors, passives) or common ICs.
      
      BOM Data:
      ${bomContext}`;
      break;
  }

  if (!ai) {
    return "AI Configuration Error: API Key is missing. Please set GEMINI_API_KEY in your environment.";
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3, // Low temperature for analytical tasks
      }
    });

    return response.text || "Unable to generate analysis at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI service. Please check your API key.";
  }
};

export const chatWithBOM = async (history: { role: 'user' | 'model', text: string }[], currentContextNode: BOMNode | null, message: string) => {
  if (!ai) {
    return "I can't chat right now because the AI service is not configured (missing API Key).";
  }
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are zBOM Assistant, a helpful AI for managing electronic Bills of Materials. 
                Context: The user is currently viewing the BOM node: ${currentContextNode ? `${currentContextNode.partNumber} - ${currentContextNode.name}` : 'Root Project'}.
                If technical details are asked, answer with precision suitable for an engineer.`
      },
      history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });

    // Add context to the message if it's the first relevant interaction about this node
    const fullMessage = currentContextNode
      ? `[Context: Active Node JSON: ${formatBOMForPrompt(currentContextNode)}] \n\n User Question: ${message}`
      : message;

    const result = await chat.sendMessage({ message: fullMessage });
    return result.text;
  } catch (e) {
    console.error(e);
    return "I'm having trouble processing that request right now.";
  }
}
