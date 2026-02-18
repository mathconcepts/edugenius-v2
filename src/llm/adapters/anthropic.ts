// @ts-nocheck
/**
 * EduGenius LLM Abstraction Layer - Anthropic Adapter
 * Supports Claude Sonnet, Haiku models
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

export class AnthropicAdapter extends BaseLLMAdapter {
  readonly providerId: ProviderId = 'anthropic';
  
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const modelId = this.getModelId(request.taskType);
    
    return this.withRetry(async () => {
      const { system, messages } = this.formatMessagesForAnthropic(request.messages);
      
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP ?? 0.95,
          stop_sequences: request.stopSequences,
          system,
          messages,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      const content = data.content
        ?.filter((c: { type: string }) => c.type === 'text')
        .map((c: { text: string }) => c.text)
        .join('') || '';
      
      const usage: TokenUsage = {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        estimatedCostUsd: this.calculateCost(
          data.usage?.input_tokens || 0,
          data.usage?.output_tokens || 0,
          this.defaultModel
        ),
      };
      
      return {
        content,
        finishReason: this.mapFinishReason(data.stop_reason),
        usage,
        model: modelId,
        provider: this.providerId,
        latencyMs: Date.now() - startTime,
      };
    });
  }
  
  async *generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk> {
    const modelId = this.getModelId(request.taskType);
    const { system, messages } = this.formatMessagesForAnthropic(request.messages);
    
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
        stream: true,
        system,
        messages,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    
    const decoder = new TextDecoder();
    let buffer = '';
    let inputTokens = 0;
    let outputTokens = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'message_start':
                inputTokens = data.message?.usage?.input_tokens || 0;
                break;
                
              case 'content_block_delta':
                if (data.delta?.type === 'text_delta') {
                  yield { content: data.delta.text, done: false };
                }
                break;
                
              case 'message_delta':
                outputTokens = data.usage?.output_tokens || 0;
                break;
                
              case 'message_stop':
                const usage: TokenUsage = {
                  inputTokens,
                  outputTokens,
                  totalTokens: inputTokens + outputTokens,
                  estimatedCostUsd: this.calculateCost(inputTokens, outputTokens, this.defaultModel),
                };
                yield { content: '', done: true, usage };
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  }
  
  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    // Anthropic doesn't have embeddings - throw helpful error
    throw new Error(
      'Anthropic does not provide embeddings. Use Gemini, OpenAI, or a local model for embeddings.'
    );
  }
  
  // Convert messages to Anthropic format
  private formatMessagesForAnthropic(messages: GenerateRequest['messages']) {
    let system = '';
    const formattedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        system += msg.content + '\n';
      } else {
        formattedMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }
    
    return { system: system.trim(), messages: formattedMessages };
  }
  
  // Map Anthropic stop reasons to our standard
  private mapFinishReason(reason?: string): GenerateResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
