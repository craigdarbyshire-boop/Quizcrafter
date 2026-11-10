# Quizcrafter

A team quiz game the whole family plays on their phones. One person starts a game, everyone joins with a code, and AI writes fresh questions that never repeat.

The game spec lives in the project's "Quizcrafter game spec" doc.

## What's built so far

**The game** (`src/app`, `src/components`, `src/lib/game/`)

- The host sets up the game (questions, who's playing, time, difficulty, answer mode, question types, leaderboard) and gets a 4-letter code and QR code.
- Players join on their phones (up to 10). Everyone plays for themselves: each player is their own team, named after them, and picks their own category.
- Every phone shows the same question and countdown. In **Normal answers** mode everyone locks in one answer. In **Fastest finger** mode the first right answer wins, and a wrong answer locks only that player out. Every fastest finger question starts with a 3-second full-screen warning. **Mixed** shuffles both.
- After each question the phones show the answer, a fun fact and the scores, and move on after 8 seconds or when the host taps Next. Every 5 questions a full-screen leaderboard shows for 5 seconds.
- With the leaderboard on, each game is a round. Round wins and points add up until the host finishes and crowns the champions.
- Phones poll the server every second. The server moves the game on when time runs out, so there's no background job to run.

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

Without Supabase keys, local dev keeps games in memory. Set `QUIZCRAFTER_DEMO_QUESTIONS=1` to play with simple built-in maths questions instead of calling the AI.

The database tables are in `supabase/migrations/` and have already been applied to the `quizcrafter` Supabase project.
