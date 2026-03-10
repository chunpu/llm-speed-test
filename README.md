# llm-speed-test

LLM 测速程序，用于测量 LLM API 的 TTFT (Time to First Token) 和 TPS (Tokens Per Second) 性能指标。

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 使用

### OpenAI API

```bash
node dist/index.js --models "gpt-4o,gpt-4o-mini" --base-url "https://api.openai.com/v1" --api-key "your-api-key"
```

### Anthropic API

```bash
node dist/index.js --models "claude-opus-4-6,claude-opus-4-5" --base-url "https://api.anthropic.com/v1" --api-key "your-api-key" --provider "anthropic"
```

### 参数说明

- `--models`: 要测试的模型列表，用逗号分隔
- `--base-url`: LLM API 的基础 URL
- `--api-key`: API 密钥
- `--provider`: API 提供商，可选值为 "openai" 或 "anthropic"，默认为 "openai"

## 输出示例

```
Testing 2 model(s) concurrently: gpt-4o, gpt-4o-mini

[Start] Testing model: gpt-4o...
[Start] Testing model: gpt-4o-mini...
[Done] ✓ gpt-4o-mini completed

================================================================================
LLM Speed Test Results
================================================================================

Model: gpt-4o-mini
----------------------------------------
  TTFT (Time to First Token): 0.156s
  TPS (Tokens Per Second):     78.32 tokens/s
  Total Tokens:                100
  Total Time:                  1.277s

================================================================================

[Done] ✓ gpt-4o completed

================================================================================
LLM Speed Test Results
================================================================================

Model: gpt-4o
----------------------------------------
  TTFT (Time to First Token): 0.234s
  TPS (Tokens Per Second):     45.67 tokens/s
  Total Tokens:                100
  Total Time:                  2.189s

================================================================================
```

## License

MIT
