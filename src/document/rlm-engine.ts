import type { RLMConfig, RLMResult } from '../types/index.js';
import { REPLExecutor } from './repl-executor.js';

const DEFAULT_CONFIG: RLMConfig = {
  maxDepth: 1,
  maxIterations: 20,
  timeout: 300_000, // 5 minutes
};

const SYSTEM_PROMPT = `You are an expert analyst with access to a Python REPL environment.
A large document has been loaded into the variable 'context' (a Python string).
Your job is to answer the user's query by exploring and analyzing the document through code.

Available tools:
- context[:N] — peek at first N characters
- context[start:end] — view a slice
- len(context) — total character count
- re.findall(pattern, context) — regex search
- context.count(substring) — count occurrences
- context.find(substring) — find position
- recursive_llm(sub_query, sub_context) — delegate a sub-query to another LLM with a subset of the context
- Any standard Python (math, json, collections, etc.)

Strategy:
1. Start by peeking at the beginning to understand document structure
2. Use regex or find() to locate relevant sections
3. Extract and analyze the relevant portions
4. If needed, use recursive_llm() to analyze large sub-sections

When you have the final answer, output exactly: FINAL(your answer here)
Or if the answer is in a variable: FINAL_VAR(variable_name)

Important:
- Write Python code in code blocks to interact with the context
- Each code block is executed and you see the output
- Do NOT try to print the entire context — it may be millions of characters
- Be systematic and thorough`;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Callback type for LLM completions.
 * The RLM engine is LLM-agnostic — the caller provides the completion function.
 * This works with any provider: OpenAI, Anthropic, Ollama, LiteLLM, etc.
 */
export type LLMCompletionFn = (messages: Message[]) => Promise<string>;

export class RLMEngine {
  private config: RLMConfig;
  private repl: REPLExecutor;
  private llmComplete: LLMCompletionFn;

  constructor(llmComplete: LLMCompletionFn, config?: Partial<RLMConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repl = new REPLExecutor();
    this.llmComplete = llmComplete;
  }

  /**
   * Analyze a document with a query using the RLM pattern.
   *
   * The full document text is stored as a Python variable — it is NEVER
   * sent to the LLM directly. The LLM interacts with it through code execution.
   *
   * @param query - The user's question about the document
   * @param context - The full document text (can be millions of characters)
   * @returns RLMResult with the answer, iteration count, and code execution count
   */
  async analyze(query: string, context: string): Promise<RLMResult> {
    // Set up REPL with context
    this.repl.setVariable('context', context);
    this.repl.setVariable('context_length', context.length.toString());

    // Register recursive_llm function
    this.repl.registerFunction('recursive_llm', async (subQuery: string, subContext: string) => {
      return this.callRecursiveLLM(subQuery, subContext);
    });

    await this.repl.start();

    try {
      return await this.runAnalysisLoop(query, context.length);
    } finally {
      await this.repl.stop();
    }
  }

  private async runAnalysisLoop(query: string, contextLength: number): Promise<RLMResult> {
    const userPrompt = `Query: ${query}

The full context is stored in the variable 'context' (${contextLength} characters, ~${Math.round(contextLength / 4)} tokens).
You can interact with it through Python code in the REPL.

When you have the answer, output: FINAL(your_answer)
Or store it in a variable and output: FINAL_VAR(variable_name)`;

    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    let iteration = 0;
    let codeExecutions = 0;
    const startTime = Date.now();

    while (iteration < this.config.maxIterations) {
      // Check timeout
      if (Date.now() - startTime > this.config.timeout) {
        return {
          answer: 'Analysis incomplete: timeout reached.',
          iterations: iteration,
          codeExecutions,
        };
      }

      // Get LLM response
      const response = await this.llmComplete(messages);

      // Check for FINAL answer
      const finalAnswer = this.parseFinalAnswer(response);
      if (finalAnswer) {
        return {
          answer: finalAnswer,
          iterations: iteration + 1,
          codeExecutions,
        };
      }

      // Extract and execute code blocks
      const codeBlocks = this.extractCodeBlocks(response);

      if (codeBlocks.length === 0) {
        // No code and no FINAL — nudge the LLM
        messages.push(
          { role: 'assistant', content: response },
          { role: 'user', content: 'Please write Python code to explore the context, or output FINAL(your answer) if you have enough information.' }
        );
        iteration++;
        continue;
      }

      // Execute each code block and collect outputs
      const outputs: string[] = [];
      for (const code of codeBlocks) {
        const output = await this.repl.execute(code);
        outputs.push(output);
        codeExecutions++;
      }

      const replOutput = outputs.join('\n---\n');

      messages.push(
        { role: 'assistant', content: response },
        { role: 'user', content: `REPL Output:\n${replOutput}` }
      );

      iteration++;
    }

    // Max iterations — force a summary
    messages.push({
      role: 'user',
      content: 'Maximum iterations reached. Based on everything you have learned so far, provide your best answer. Output: FINAL(your answer)',
    });

    const finalResponse = await this.llmComplete(messages);
    const forcedAnswer = this.parseFinalAnswer(finalResponse) || finalResponse;

    return {
      answer: forcedAnswer,
      iterations: this.config.maxIterations + 1,
      codeExecutions,
    };
  }

  /**
   * Handle recursive LLM calls from within the REPL.
   * The sub-context IS sent directly in the prompt (it should be small enough).
   */
  private async callRecursiveLLM(subQuery: string, subContext: string): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are an expert analyst. Answer the query based on the provided context. Be precise and thorough.',
      },
      {
        role: 'user',
        content: `Context:\n${subContext}\n\nQuery: ${subQuery}`,
      },
    ];

    return this.llmComplete(messages);
  }

  /**
   * Parse FINAL(answer) or FINAL_VAR(var_name) from LLM output.
   */
  private parseFinalAnswer(response: string): string | null {
    // Match FINAL(...)
    const finalMatch = response.match(/FINAL\((.+)\)\s*$/s);
    if (finalMatch) {
      return finalMatch[1].trim();
    }

    // Match FINAL_VAR(var_name) — would need REPL execution to resolve
    const varMatch = response.match(/FINAL_VAR\((\w+)\)/);
    if (varMatch) {
      // We'd need to read the variable from the REPL
      // For now, return a note that the answer is in a variable
      return `[Answer stored in variable: ${varMatch[1]}]`;
    }

    return null;
  }

  /**
   * Extract Python code blocks from LLM response.
   * Supports ```python ... ``` and ``` ... ``` formats.
   */
  private extractCodeBlocks(response: string): string[] {
    const blocks: string[] = [];

    // Match fenced code blocks
    const fenced = response.matchAll(/```(?:python)?\s*\n([\s\S]*?)```/g);
    for (const match of fenced) {
      const code = match[1].trim();
      if (code.length > 0) {
        blocks.push(code);
      }
    }

    // If no fenced blocks, look for indented code (4+ spaces)
    if (blocks.length === 0) {
      const indented = response.match(/(?:^|\n)((?:[ ]{4,}|\t).+(?:\n(?:[ ]{4,}|\t).+)*)/);
      if (indented) {
        const code = indented[1].replace(/^[ ]{4}/gm, '').trim();
        if (code.length > 0) {
          blocks.push(code);
        }
      }
    }

    return blocks;
  }
}
