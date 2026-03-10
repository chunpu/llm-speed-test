#!/usr/bin/env node

import { Command } from 'commander';

interface TestResult {
  model: string;
  ttft: number;
  tps: number;
  totalTokens: number;
  totalTime: number;
}

async function testModelSpeed(
  model: string,
  baseUrl: string,
  apiKey: string,
): Promise<TestResult> {
  const prompt = 'Write a short story about a robot learning to paint.';

  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  let totalTokens = 0;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;

          if (content) {
            if (firstTokenTime === null) {
              firstTokenTime = Date.now();
            }
            totalTokens++;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  const ttft = firstTokenTime ? (firstTokenTime - startTime) / 1000 : 0;
  const tps = totalTokens / totalTime;

  return {
    model,
    ttft,
    tps,
    totalTokens,
    totalTime,
  };
}

function printSingleResult(result: TestResult) {
  console.log('\n' + '='.repeat(80));
  console.log('LLM Speed Test Results');
  console.log('='.repeat(80) + '\n');
  console.log(`Model: ${result.model}`);
  console.log('-'.repeat(40));
  console.log(`  TTFT (Time to First Token): ${result.ttft.toFixed(3)}s`);
  console.log(
    `  TPS (Tokens Per Second):     ${result.tps.toFixed(2)} tokens/s`,
  );
  console.log(`  Total Tokens:                ${result.totalTokens}`);
  console.log(`  Total Time:                  ${result.totalTime.toFixed(3)}s`);
  console.log('\n' + '='.repeat(80) + '\n');
}

function printResults(results: TestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('LLM Speed Test Results');
  console.log('='.repeat(80) + '\n');

  for (const result of results) {
    console.log(`Model: ${result.model}`);
    console.log('-'.repeat(40));
    console.log(`  TTFT (Time to First Token): ${result.ttft.toFixed(3)}s`);
    console.log(
      `  TPS (Tokens Per Second):     ${result.tps.toFixed(2)} tokens/s`,
    );
    console.log(`  Total Tokens:                ${result.totalTokens}`);
    console.log(
      `  Total Time:                  ${result.totalTime.toFixed(3)}s`,
    );
    console.log();
  }

  console.log('='.repeat(80));
}

async function main() {
  const program = new Command();

  program
    .name('llm-speed-test')
    .description('Test LLM API speed for TTFT and TPS metrics')
    .version('1.0.0')
    .requiredOption(
      '--models <models>',
      'Comma-separated list of models to test',
    )
    .requiredOption('--base-url <url>', 'Base URL for the LLM API')
    .requiredOption('--api-key <key>', 'API key for authentication')
    .parse(process.argv);

  const options = program.opts();
  const models = options.models.split(',').map((m: string) => m.trim());

  console.log(
    `\nTesting ${models.length} model(s) concurrently: ${models.join(', ')}\n`,
  );

  const testPromises = models.map(async (model: string) => {
    console.log(`[Start] Testing model: ${model}...`);
    try {
      const result = await testModelSpeed(
        model,
        options.baseUrl,
        options.apiKey,
      );
      console.log(`[Done] ✓ ${model} completed`);
      printSingleResult(result);
      return { success: true, result };
    } catch (error) {
      console.error(
        `[Fail] ✗ ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { success: false, error };
    }
  });

  const testResults = await Promise.all(testPromises);

  const results: TestResult[] = testResults
    .filter((r): r is { success: true; result: TestResult } => r.success)
    .map(r => r.result);

  if (results.length === 0) {
    console.error('No models were successfully tested.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
