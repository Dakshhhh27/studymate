# StudyMate: your AI study buddy

StudyMate turns messy notes into things you can actually study from. Paste your notes (or just name a topic) and it will summarize them, answer your questions like a patient tutor, make flashcards, quiz you and plan your days before an exam.

## Features
- **Summary:** big idea, key points, key terms, common mistakes and a recap, at the length you choose.
- **Flashcards:** 8 flip cards that test understanding, not trivia.
- **Quiz:** 5, 8 or 10 multiple-choice questions (easy, medium or hard) with friendly explanations and a score.
- **Tutor chat:** multi-turn Q&A that remembers your topic, notes and the last 10 messages.
- **Study plan:** a day-by-day schedule with spaced review, built around your exam date.
- **Focus timer and daily tip:** a 25-minute Pomodoro timer and a rotating study tip.
- **Remembers you:** your name, notes and generated material are saved in your browser. "Start fresh" clears them.

## Run it
Requires Node.js 18 or newer. There are no dependencies to install.

```bash
cp .env.example .env     # then put your Anthropic API key in .env
npm start                # open http://localhost:3000
npm test                 # unit tests for validation and JSON parsing
```

| Variable | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your API key (required) | none |
| `ANTHROPIC_MODEL` | Model to use | `claude-sonnet-5-5` |
| `PORT` | Server port | `3000` |

## How it works
```
Browser (public/index.html) --POST /api/generate--> server.js --> Anthropic Messages API
```
- **Prompt engineering:** one shared system prompt (warm tutor, accuracy rules, grounding in your notes) plus task prompts with a method, strict format and quality rules. Quizzes and flashcards request JSON only.
- **Async and errors (frontend):** `callAI()` uses `async/await` with a 60 s timeout (`AbortController`), 2 retries with exponential backoff, response validation and friendly messages for each failure.
- **Backend safety:** the API key stays on the server, requests are validated and size-limited, 20 requests per minute per IP, 55 s upstream timeout, and JSON replies are parsed server-side.

### API
- `GET /api/health` returns `{ok, model, configured}`.
- `POST /api/generate` takes `{messages: [{role, content}], json: boolean}` and returns `{text}` or `{json}`.

## Limitations and ideas
- AI can be wrong. Check important facts against your course material.
- Responses are not streamed yet, and storage is per browser (no accounts).
- Next: streaming replies, PDF upload, saved study sets, spaced-repetition scheduling.

## License
MIT
