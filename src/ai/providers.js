/**
 * Provider catalog. Every provider speaks the OpenAI chat format, so one client serves them all.
 * Step text uses [label](url) for links and **bold**; the UI renders these as safe elements, never HTML.
 */
export const PROVIDERS = {
  gemini: { name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', tag: 'Best all-round free pick', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza',
    blurb: 'Fast, strong with long pages, and reads images when you choose to send one. Free tier with daily limits.',
    steps: ['Open [Google AI Studio, API keys](https://aistudio.google.com/apikey). It opens in your browser.', 'Sign in with any Google account. Accept the terms if it asks.', 'Tap **Create API key**. If it asks for a project, choose **Create API key in new project**.', 'A long key appears. It starts with **AIza**. Tap the copy icon next to it.', 'Come back to Stowra, tap **Paste**, then **Connect**.'],
    fine: 'On the free tier, Google may use your prompts to improve its products. Do not send private information. Free limits change, so check the AI Studio page.', pref: [/^gemini-2\.5-flash$/, /^gemini-2\.5-flash-lite$/, /^gemini-3.*flash/, /^gemini-2\.5-pro$/], bad: /embed|tts|image|live|robotics|audio|aqa|imagen|veo|computer-use|learnlm|gemma-3n/i, only: /^gemini/ },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: '', tag: 'Many free models, one key', keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-',
    blurb: 'One account unlocks many free models (names end in :free). A good backup when another provider is busy.',
    steps: ['Create a free account at [openrouter.ai](https://openrouter.ai/).', 'Open [the Keys page](https://openrouter.ai/keys) and tap **Create Key**. Any name works.', 'Copy the key. It starts with **sk-or-**.', 'Come back to Stowra, tap **Paste**, then **Connect**.'],
    fine: 'Free models are limited to about 50 requests a day, and more after a one-time credit purchase. Some free models change or disappear.', pref: [/llama.*70b/i, /gemma/i, /qwen/i, /deepseek/i, /mistral/i], free: /:free$/ },
  groq: { name: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', tag: 'Very fast answers', keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_',
    blurb: 'Answers appear almost instantly. Free tier with rate limits.',
    steps: ['Sign up at [console.groq.com](https://console.groq.com/).', 'Open [API Keys](https://console.groq.com/keys) and tap **Create API Key**.', 'Copy the key. It starts with **gsk_**. Groq shows it only once.', 'Come back to Stowra, tap **Paste**, then **Connect**.'],
    fine: 'Free limits are per minute and per day. If you see a rate limit message, wait a little or pick another model.', pref: [/^openai\/gpt-oss-120b/, /^llama-3\.3-70b/, /^openai\/gpt-oss-20b/, /^llama-3\.1-8b/], bad: /whisper|guard|tts|playai|orpheus|embed|safeguard/i },
  openai: { name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', tag: 'Paid', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-', alt: true,
    blurb: 'Strong models. There is no free tier, so usage is billed to your OpenAI account.',
    steps: ['Open [platform.openai.com, API keys](https://platform.openai.com/api-keys) and sign in.', 'Add a small amount of credit under Billing if you have not.', 'Tap **Create new secret key** and copy it. It starts with **sk-**.', 'Come back to Stowra, tap **Paste**, then **Connect**.'],
    fine: 'You pay for what you use. Set a monthly limit in your OpenAI billing settings.', pref: [/^gpt-4\.1-mini/, /^gpt-4o-mini/, /^gpt-4\.1$/], bad: /embed|tts|whisper|image|moderation|audio|realtime|transcribe|dall|davinci|babbage|instruct/i, only: /^(gpt|o\d|chatgpt)/ },
  grok: { name: 'Grok (xAI)', base: 'https://api.x.ai/v1', model: '', tag: 'Credits or paid', keyUrl: 'https://console.x.ai', keyHint: 'xai-', alt: true,
    blurb: 'Strong models, but xAI has no standing free tier. Some new accounts get credits.',
    steps: ['Open [console.x.ai](https://console.x.ai) and sign in.', 'Create an API key in the console.', 'Copy the key, tap **Paste** in Stowra, then **Connect**.'],
    fine: 'Usage may be billed once any credits run out. Check your balance in the console.', pref: [/grok/i] },
  custom: { name: 'Custom (OpenAI compatible)', base: '', model: '', tag: 'Advanced', keyUrl: '', keyHint: '', alt: true,
    blurb: 'Any provider that follows the OpenAI chat format. You need its address, a key and a model name.', steps: [], fine: '', pref: [] },
};
export const TOP = ['gemini', 'openrouter', 'groq'];
export const MORE = ['openai', 'grok', 'custom'];

/** Keep only models that can chat. @param {string} id @param {string[]} ids */
export function chatModels(id, ids) {
  const p = PROVIDERS[id];
  let out = ids.filter((m) => !(p.bad && p.bad.test(m)));
  if (p.only) out = out.filter((m) => p.only.test(m));
  if (p.free) out = out.filter((m) => p.free.test(m));
  return [...new Set(out)].sort();
}
/** A short list of good picks: current, preferred, then the first few. */
export function pickModels(id, models, current) {
  const p = PROVIDERS[id]; const out = [];
  if (current) out.push(current);
  for (const re of p.pref || []) { const m = models.find((x) => re.test(x)); if (m) out.push(m); }
  if (p.model) out.push(p.model);
  models.slice(0, 3).forEach((m) => out.push(m));
  return [...new Set(out.filter(Boolean))].slice(0, 5);
}
