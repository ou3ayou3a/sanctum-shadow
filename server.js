const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'site')));

// ─── NPC CONVERSATION PROXY ──────────────────
app.post('/api/npc', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const { messages, system, max_tokens } = req.body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: max_tokens || 600,
        system: system || '',
        messages,
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Anthropic API error:', err);
    res.status(500).json({ error: 'Failed to reach Anthropic API.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sanctum & Shadow running on port ${PORT}`));
