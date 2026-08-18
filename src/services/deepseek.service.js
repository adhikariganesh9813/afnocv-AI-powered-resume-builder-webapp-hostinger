// Thin wrapper around DeepSeek's chat completions API (OpenAI-compatible).
// Node 20 has fetch built in, so no HTTP library is needed.

const DEFAULT_TIMEOUT_MS = 120000;

function config() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey.startsWith('dummy') || apiKey === '<API_KEY>') {
    const err = new Error('The AI provider is not configured yet. Add a real DEEPSEEK_API_KEY.');
    err.status = 503;
    err.expose = true;
    throw err;
  }
  return {
    apiKey,
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  };
}

// Asks for a JSON object back. DeepSeek's JSON mode guarantees the response
// parses, not that it contains the fields we asked for — callers still validate.
//
// In practice the provider occasionally emits a truncated object that does not
// parse at all, so one retry is attempted before giving up: a second call is far
// cheaper than making the user re-run a generation.
async function chatJson(options) {
  try {
    return await chatJsonOnce(options);
  } catch (err) {
    if (!err.retryable) throw err;
    console.warn('DeepSeek returned malformed JSON; retrying once.');
    return chatJsonOnce(options);
  }
}

async function chatJsonOnce({ system, user, temperature = 0.3, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const { apiKey, baseUrl, model } = config();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('The AI provider took too long to respond. Please try again.');
      timeoutErr.status = 504;
      timeoutErr.expose = true;
      throw timeoutErr;
    }
    const netErr = new Error('Could not reach the AI provider. Check your connection and try again.');
    netErr.status = 502;
    netErr.expose = true;
    throw netErr;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`DeepSeek API error ${response.status}:`, body.slice(0, 500));

    const messages = {
      401: 'The AI provider rejected the API key. Check DEEPSEEK_API_KEY.',
      402: 'The AI provider account has insufficient balance.',
      429: 'Too many requests to the AI provider. Wait a moment and try again.',
    };
    const err = new Error(messages[response.status] || 'The AI provider returned an error. Please try again.');
    err.status = response.status === 401 || response.status === 402 ? 502 : response.status;
    err.expose = true;
    throw err;
  }

  const data = await response.json();
  const content = data.choices && data.choices[0] && data.choices[0].message.content;

  if (!content) {
    const err = new Error('The AI provider returned an empty response.');
    err.status = 502;
    err.expose = true;
    err.retryable = true;
    throw err;
  }

  try {
    return { json: JSON.parse(content), usage: data.usage || null };
  } catch (err) {
    console.error('DeepSeek returned unparseable JSON:', content.slice(0, 500));
    const parseErr = new Error('The AI returned a malformed response. Please try again.');
    parseErr.status = 502;
    parseErr.expose = true;
    parseErr.retryable = true;
    throw parseErr;
  }
}

module.exports = { chatJson };
