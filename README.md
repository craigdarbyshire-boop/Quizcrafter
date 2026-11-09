# Quizcrafter

A team quiz game the whole family plays on their phones. One person starts a game, everyone joins with a code, and AI writes fresh questions that never repeat.

The game spec lives in the project's "Quizcrafter game spec" doc.

## What's built so far

**Question engine** (`src/lib/questions/`)

- `POST /api/questions` writes a game's questions. Body:
  ```json
  {
    "categories": [{ "category": "Animals", "count": 5 }, { "category": "Space", "count": 5 }],
    "difficulty": "easy",
    "types": ["multiple_choice", "true_false", "typed"]
  }
  ```
  Each team's chosen category is one entry in `categories`.
- `DELETE /api/questions/history` is the "reset question history" button.

How it works:

1. It loads every past question in the chosen categories from Supabase (`question_history`).
2. Claude writes the questions and is told what's already been asked. Points scale with difficulty (easy 5–15, medium 10–25, hard 20–40).
3. A second Claude pass checks each question has exactly one right answer and is suitable for kids. Any that fail are dropped.
4. Each question is compared with history and with the rest of the game. Reworded repeats are caught too, and dropped.
5. Replacements are requested for anything dropped, and the final set is saved to history.

Typed answers forgive capital letters, punctuation, a leading "the" and small spelling slips, but numbers must be exact.

## Running it

```bash
cp .env.example .env.local   # then fill in the keys
npm install
npm run dev
npm test
```

The database table is in `supabase/migrations/` and has already been applied to the `quizcrafter` Supabase project.
