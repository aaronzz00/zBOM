import { BOMNode } from '../types';
import { useAISettingsStore } from '../stores/useAISettingsStore';
import { isBackendApiConfigured, requestBackendChatCompletion } from './backendApi';

type ChatRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

const formatBOMForPrompt = (node: BOMNode): string => {
  return JSON.stringify(
    node,
    (key, value) => {
      if (key === 'isExpanded' || key === 'id') return undefined;
      return value;
    },
    2
  );
};

const getConfigurationIssue = (): string | null => {
  const { settings } = useAISettingsStore.getState();

  if (!settings.enabled) {
    return 'AI Assistant is disabled. Enable it in Settings > AI Provider.';
  }

  if (!settings.apiKey.trim()) {
    return 'AI Provider is not configured. Add an OpenAI-compatible API key in Settings > AI Provider.';
  }

  if (!settings.baseUrl.trim() || !settings.model.trim()) {
    return 'AI Provider is incomplete. Check the base URL and model in Settings > AI Provider.';
  }

  return null;
};

const requestChatCompletion = async (messages: ChatMessage[]): Promise<string> => {
  if (isBackendApiConfigured()) {
    try {
      const payload = await requestBackendChatCompletion(messages);
      return payload.choices?.[0]?.message?.content?.trim() || 'Unable to generate analysis at this time.';
    } catch (error) {
      console.error('Backend AI provider request failed:', error);
      return 'Error connecting to the zBOM AI proxy. Check the backend AI Provider configuration.';
    }
  }

  const issue = getConfigurationIssue();
  if (issue) return issue;

  const { settings } = useAISettingsStore.getState();
  const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: settings.temperature,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as ChatCompletionResponse;

    if (!response.ok) {
      const message = payload.error?.message || `HTTP ${response.status}`;
      return `AI provider request failed: ${message}`;
    }

    return payload.choices?.[0]?.message?.content?.trim() || 'Unable to generate analysis at this time.';
  } catch (error) {
    console.error('AI provider request failed:', error);
    return 'Error connecting to AI provider. Check the Settings > AI Provider configuration and provider CORS support.';
  }
};

export const analyzeBOMNode = async (
  node: BOMNode,
  task: 'optimize' | 'risks' | 'alternatives'
): Promise<string> => {
  const bomContext = formatBOMForPrompt(node);
  let systemPrompt = 'You are an expert Senior Supply Chain Engineer and Electronics Manufacturing specialist.';
  let userPrompt = '';

  switch (task) {
    case 'optimize':
      systemPrompt += ' Your goal is to identify cost reduction opportunities in the Bill of Materials.';
      userPrompt = `Analyze the following BOM structure for the item "${node.name}" (${node.partNumber}).
Identify top 3 cost drivers. Suggest specific strategies to reduce cost, such as alternative manufacturing processes, consolidation of parts, or supplier negotiation strategies.

BOM Data:
${bomContext}`;
      break;

    case 'risks':
      systemPrompt += ' Your goal is to identify supply chain risks, including single source exposure, obsolescence, and lead times.';
      userPrompt = `Analyze the following BOM for "${node.name}".
Highlight high-risk components based on the provided data. If no explicit risk data is present, infer likely risks from component type, manufacturing constraints, and sourcing patterns.

BOM Data:
${bomContext}`;
      break;

    case 'alternatives':
      systemPrompt += ' Your goal is to suggest alternative components or manufacturers.';
      userPrompt = `For the component "${node.name}" (${node.partNumber}) and its immediate children, suggest generic or specific alternatives if applicable.
Focus on standard parts, connectors, passives, common ICs, or manufacturer-neutral substitutions where appropriate.

BOM Data:
${bomContext}`;
      break;
  }

  return requestChatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);
};

export const chatWithBOM = async (
  history: { role: 'user' | 'model'; text: string }[],
  currentContextNode: BOMNode | null,
  message: string
): Promise<string> => {
  const systemPrompt = `You are zBOM Assistant, a helpful AI for managing electronic Bills of Materials.
Context: The user is currently viewing the BOM node: ${
    currentContextNode ? `${currentContextNode.partNumber} - ${currentContextNode.name}` : 'Root Project'
  }.
Answer with precision suitable for engineering, sourcing, and manufacturing users.`;

  const fullMessage = currentContextNode
    ? `[Context: Active Node JSON: ${formatBOMForPrompt(currentContextNode)}]\n\nUser Question: ${message}`
    : message;

  return requestChatCompletion([
    { role: 'system', content: systemPrompt },
    ...history.map<ChatMessage>((item) => ({
      role: item.role === 'model' ? 'assistant' : 'user',
      content: item.text,
    })),
    { role: 'user', content: fullMessage },
  ]);
};
