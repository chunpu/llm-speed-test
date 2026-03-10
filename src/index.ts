#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

const TEST_PROMPT = 'Write a short story about a robot learning to paint.';
const LOG_DIR = path.join(process.cwd(), 'log');

interface TestResult {
  model: string;
  ttft: number;
  tps: number;
  totalTokens: number;
  totalTime: number;
  inputMessages: Array<{ role: string; content: string }>;
  outputContent: string;
  reasoningContent: string;
}

function getLogDirName(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function writeLogEntry(logPath: string, content: string): void {
  fs.appendFileSync(logPath, content + '\n', 'utf8');
}

function formatSingleResult(result: TestResult): string {
  let output = '';
  output += '╔' + '═'.repeat(78) + '╗\n';
  output +=
    '║' + ' LLM Speed Test Result '.padStart(48, ' ').padEnd(78, ' ') + '║\n';
  output += '╠' + '═'.repeat(78) + '╣\n';
  output += '║' + ` Model: ${result.model}`.padEnd(78, ' ') + '║\n';
  output += '╠' + '─'.repeat(78) + '╣\n';
  output +=
    '║' +
    `  TTFT (Time to First Token): ${result.ttft.toFixed(3)}s`.padEnd(78, ' ') +
    '║\n';
  output +=
    '║' +
    `  TPS (Tokens Per Second):     ${result.tps.toFixed(2)} tokens/s`.padEnd(
      78,
      ' ',
    ) +
    '║\n';
  output +=
    '║' +
    `  Total Tokens:                ${result.totalTokens}`.padEnd(78, ' ') +
    '║\n';
  output +=
    '║' +
    `  Total Time:                  ${result.totalTime.toFixed(3)}s`.padEnd(
      78,
      ' ',
    ) +
    '║\n';
  output += '╚' + '═'.repeat(78) + '╝';
  return output;
}

function getTimestampWithTimezone(): string {
  const now = new Date();
  return now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
}

async function testModelSpeed(
  model: string,
  baseUrl: string,
  apiKey: string,
): Promise<TestResult> {
  const startTime = Date.now();
  const timestamp = getTimestampWithTimezone();
  const promptWithTimestamp = `[${timestamp}] ${TEST_PROMPT}`;
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
      messages: [{ role: 'user', content: promptWithTimestamp }],
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
  let fullContent = '';
  let fullReasoningContent = '';

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
          const reasoningContent = json.choices?.[0]?.delta?.reasoning_content;

          if (content || reasoningContent) {
            if (firstTokenTime === null) {
              firstTokenTime = Date.now();
            }
            totalTokens++;
          }

          if (content) {
            fullContent += content;
          }

          if (reasoningContent) {
            fullReasoningContent += reasoningContent;
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
    inputMessages: [{ role: 'user', content: promptWithTimestamp }],
    outputContent: fullContent,
    reasoningContent: fullReasoningContent,
  };
}

function printSingleResult(result: TestResult) {
  const formatted = formatSingleResult(result);
  console.log('\n' + formatted + '\n');
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

  const logDirName = getLogDirName();
  const currentLogDir = path.join(LOG_DIR, logDirName);

  if (!fs.existsSync(currentLogDir)) {
    fs.mkdirSync(currentLogDir, { recursive: true });
  }

  let header = '';
  header += '╔' + '═'.repeat(78) + '╗\n';
  header += '║' + ' LLM Speed Test '.padStart(46, ' ').padEnd(78, ' ') + '║\n';
  header += '╠' + '═'.repeat(78) + '╣\n';
  header +=
    '║' +
    ` Testing ${models.length} model(s) concurrently: ${models.join(', ')}`.padEnd(
      78,
      ' ',
    ) +
    '║\n';
  header += '╠' + '─'.repeat(78) + '╣\n';
  header += '║' + ' Test Prompt:'.padEnd(78, ' ') + '║\n';
  const promptPreview =
    TEST_PROMPT.length > 50 ? TEST_PROMPT.slice(0, 50) + '...' : TEST_PROMPT;
  header += '║' + `   "${promptPreview}"`.padEnd(78, ' ') + '║\n';
  header += '╚' + '═'.repeat(78) + '╝';

  console.log('\n' + header + '\n');
  // writeLogEntry(logPath, header);

  const testPromises = models.map(async (model: string) => {
    console.log(`[Start] Testing model: ${model}...`);
    const modelLogPath = path.join(currentLogDir, `${model}.log`);
    writeLogEntry(modelLogPath, header);
    writeLogEntry(modelLogPath, `[Start] Testing model: ${model}...`);

    try {
      const result = await testModelSpeed(
        model,
        options.baseUrl,
        options.apiKey,
      );
      console.log(`[Done] ✓ ${model} completed`);
      writeLogEntry(modelLogPath, `[Done] ✓ ${model} completed`);
      printSingleResult(result);

      let logContent = '\n' + formatSingleResult(result) + '\n';
      logContent += '\n' + '='.repeat(80) + '\n';
      logContent += 'Input Messages:\n';
      logContent += JSON.stringify(result.inputMessages, null, 2) + '\n';
      if (result.reasoningContent) {
        logContent += '\n' + '-'.repeat(80) + '\n';
        logContent += 'Reasoning Content:\n';
        logContent += result.reasoningContent + '\n';
      }
      logContent += '\n' + '-'.repeat(80) + '\n';
      logContent += 'Output Content:\n';
      logContent += result.outputContent + '\n';
      logContent += '='.repeat(80) + '\n';

      writeLogEntry(modelLogPath, logContent);
      return { success: true, result };
    } catch (error) {
      const errorMsg = `[Fail] ✗ ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      writeLogEntry(modelLogPath, errorMsg);
      return { success: false, error };
    }
  });

  const testResults = await Promise.all(testPromises);

  const results: TestResult[] = testResults
    .filter((r): r is { success: true; result: TestResult } => r.success)
    .map(r => r.result);

  if (results.length === 0) {
    console.error('No models were successfully tested.');
    // writeLogEntry(logPath, 'No models were successfully tested.');
    process.exit(1);
  }

  console.log(`\nLogs saved to directory: ${currentLogDir}`);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
