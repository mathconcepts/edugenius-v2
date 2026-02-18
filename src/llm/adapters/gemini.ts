// @ts-nocheck
/**
 * EduGenius LLM Abstraction Layer - Gemini Adapter
 * Supports Gemini Flash, Pro, and LearnLM models
 */

import { BaseLLMAdapter } from './base';
import type {
  ProviderId,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  EmbedRequest,
  EmbedResponse,
  TokenUsage,
} from '../types';

export class GeminiAdapter extends BaseLLMAdapter {
  readonly providerId: ProviderId = 'gemini';
  
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const modelId = this.getModelId(request.taskType);
    
    return this.withRetry(async () => {
      const response = await fetch(
        `${this.baseUrl}/v1beta/models/${modelId}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            contents: this.formatMessagesForGemini(request.messages),
            generationConfig: {
              maxOutputTokens: request.maxTokens || 4096,
              temperature: request.temperature ?? 0.7,
              topP: request.topP ?? 0.95,
              stopSequences: request.stopSequences,
            },
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        throw new Error('No response from Gemini');
      }
      
      const content = candidate.content?.parts?.[0]?.text || '';
      const finishReason = this.mapFinishReason(candidate.finishReason);
      
      const usage: TokenUsage = {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
        estimatedCostUsd: this.calculateCost(
          data.usageMetadata?.promptTokenCount || 0,
          data.usageMetadata?.candidatesTokenCount || 0,
          this.defaultModel
        ),
      };
      
      return {
        content,
        finishReason,
        usage,
        model: modelId,
        provider: this.providerId,
        latencyMs: Date.now() - startTime,
      };
    });
  }
  
  async *generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    const modelId = this.getModelId(request.taskType);
    
    const response = await fetch(
      `${this.baseUrl}/v1beta/models/${modelId}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: this.formatMessagesForGemini(request.messages),
          generationConfig: {
            maxOutputTokens: request.maxTokens || 4096,
            temperature: request.temperature ?? 0.7,
            topP: request.topP ?? 0.95,
            stopSequences: request.stopSequences,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    
    const decoder = new TextDecoder();
    let buffer = '';
    let totalContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (text) {
            totalContent += text;
            yield { content: text, done: false };
          }
          
          // Check for finish
          if (data.candidates?.[0]?.finishReason) {
            const usage: TokenUsage = {
              inputTokens: data.usageMetadata?.promptTokenCount || 0,
              outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
              totalTokens: data.usageMetadata?.totalTokenCount || 0,
              estimatedCostUsd: this.calculateCost(
                data.usageMetadata?.promptTokenCount || 0,
                data.usageMetadata?.candidatesTokenCount || 0,
                this.defaultModel
              ),
            };
            yield { content: '', done: true, usage };
          }
        }
      }
    }
  }
  
  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    const modelId = 'text-embedding-004';
    
    const response = await fetch(
      `${this.baseUrl}/v1beta/models/${modelId}:embedContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          content: { parts: request.texts.map(text => ({ text })) },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini embed error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      embeddings: [data.embedding?.values || []],
      model: modelId,
      usage: {
        totalTokens: request.texts.reduce((acc, t) => acc + this.countTokens(t), 0),
        estimatedCostUsd: 0, // Embeddings are free on Gemini
      },
    };
  }
  
  // Convert messages to Gemini format
  private formatMessagesForGemini(messages: GenerateRequest['messages']) {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    let systemInstruction = '';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += msg.content + '\n';
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }
    
    // Prepend system instruction to first user message if present
    if (systemInstruction && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = systemInstruction + '\n\n' + contents[0].parts[0].text;
    }
    
    return contents;
  }
  
  // Map Gemini finish reasons to our standard
  private mapFinishReason(reason?: string): GenerateResponse['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
