# Yalcit User & Presenter Guide

Welcome to **Yalcit** (*Yet Another Live Classroom Interaction Tool*). This guide covers everything teachers, presenters, and students need to create, organize, import/export, and run live interactive classroom quizzes.

---

## 1. Quick Start: Hosting a Live Classroom Session

1. **Create or Pick a Quiz**:
   - Sign in via the **Presenter Portal** (`/presenter/auth`).
   - Create a new quiz in **My Quizzes** or browse community templates under **Public Shared** (including the 12-question **🇫🇷 Learn French for Beginners (Demo)** quiz).
2. **Launch a Room**:
   - Click the **Play (`▶`)** button on any quiz.
   - Choose your scoring mode:
     - **Speed-Based Bonus Scoring**: Correct answers earn between **500 and 1,000 pts** depending on how fast the student submits.
     - **Standard Flat Scoring**: Every correct answer earns **100 pts** regardless of speed.
3. **Classroom Lobby (Projector View)**:
   - Project the lobby screen. Students can either scan the **QR Code** with their phone camera or visit the URL shown and enter the **6-character Room Code**.
   - No student account or email is required.
4. **Running the Quiz**:
   - The presenter screen displays the **Question**, **Image**, and **Option Cards (`A`, `B`, `C`, `D`)** so students can read from the projector and tap their choice on their smartphone.
   - **Anti-Bandwagon Protection**: Live vote bars and open-ended text answers are hidden/blurred by default (`Votes Hidden Until Reveal`) while the timer is running so students think independently.
   - **Live Word Cloud**: For open-ended questions, matching answers group automatically into a dynamic **Word Cloud** where popular answers grow larger (`×2`, `×5`). While the timer runs, bubbles appear blurred (`••••• ×3`) and unblur on reveal!
   - **Pacing Controls**:
     - When all connected students have answered (`X / X Answered`), a green **Jump to Next Question →** button appears immediately.
     - You can also click **Interrupt & Finish Question Now** at any time to stop the timer early and reveal the answer.

---

## 2. Organizing & Searching Quizzes (Categories, Folders & Tags)

To help you find the right quiz among thousands of templates:

- **Category**: Every quiz belongs to a high-level subject (*General*, *Languages*, *Math*, *Science*, *History & Geography*, *Technology & CS*, *Arts & Literature*, *Trivia & Fun*).
- **Personal Folder (`My Quizzes`)**: Assign a folder name (e.g., `Grade 10 / Fall` or `Week 4`) to group your own quizzes and filter them via the **📁 All Folders** dropdown.
- **Search Tags (`#tag`)**: Add comma-separated keywords (e.g., `french, beginner, verbs`). Click any `#tag` pill in the dashboard or type in the search bar to filter by title, author, folder, or tag.

---

## 3. JSON Import & Export Format Specification

You can back up your quizzes, share them as files, or bulk-generate quizzes (e.g., using an AI assistant or spreadsheet script) and import them via the **Import** button in **My Quizzes**.

### Supported Fields on Import
Yes! **Category, Personal Folder, and Tags are all supported during JSON Import** (and are automatically included when you click **Export**):
- If you include `"category"`, `"folder"`, and `"tags"` in your JSON file, Yalcit imports them directly.
- Plus, in the **Import Modal** inside the dashboard, you can also set a **Default Folder** or **Additional Tags** to apply automatically to all quizzes in the imported file!

### Complete JSON Schema Example

The imported `.json` file must contain a JSON **array** of quiz objects (`[ ... ]`):

```json
[
  {
    "title": "European Capitals & Geography",
    "category": "History & Geography",
    "folder": "Grade 9 - Unit 2",
    "tags": ["geography", "europe", "capitals", "quiz"],
    "is_public": false,
    "questions": [
      {
        "type": "multiple_choice",
        "title": "What is the capital city of France?",
        "image_url": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80",
        "time_limit": 30,
        "correct_option_id": "A",
        "options": [
          { "id": "A", "text": "Paris" },
          { "id": "B", "text": "Lyon" },
          { "id": "C", "text": "Marseille" },
          { "id": "D", "text": "Bordeaux" }
        ]
      },
      {
        "type": "open_ended",
        "title": "Type the name of the river that flows through Paris.",
        "image_url": null,
        "time_limit": 30,
        "correct_option_id": "Seine",
        "options": []
      }
    ]
  }
]
```

### Field Reference Table

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | Title of the quiz template. |
| `category` | `string` | No | Subject category (defaults to `"General"`). |
| `folder` | `string` | No | Personal folder name for organizing inside **My Quizzes** (defaults to `""`). |
| `tags` | `string[]` | No | Array of lowercase search tags, e.g. `["math", "algebra"]`. |
| `is_public` | `boolean` | No | Whether to share in **Public Shared** (defaults to `false`). |
| `questions` | `array` | **Yes** | List of question objects in display order. |
| `questions[].type` | `string` | **Yes** | `"multiple_choice"` or `"open_ended"`. |
| `questions[].title` | `string` | **Yes** | The question prompt shown to students. |
| `questions[].image_url` | `string \| null` | No | Optional HTTPS image URL for the question. |
| `questions[].time_limit` | `number` | No | Countdown seconds (`10`, `20`, `30`, `45`, `60`; defaults to `30`). |
| `questions[].correct_option_id` | `string` | **Yes** | For `"multiple_choice"`, the option ID (`"A"`, `"B"`, `"C"`, `"D"`). For `"open_ended"`, the expected text answer (case-insensitive match). |
| `questions[].options` | `array` | For MCQ | Array of `{ "id": "A", "text": "...", "image_url": "..." }` objects (empty `[]` for `open_ended`). |

---

## 4. Keyboard Shortcuts & Classroom Tips

During a live quiz on the **Presenter Screen**:
- **`Space` or `Right Arrow (→)`**:
  - If the timer is running: closes submissions and reveals the correct answer.
  - If the answer is already revealed: advances to the next question (or finishes the quiz).
- **`F`**: Toggles browser **Fullscreen** mode for clean classroom projection.
- **Sound Toggle (`🔊` / `🔇`)**: Mutes or unmutes countdown ticks (last 5 seconds), reveal chimes, and podium fanfare.
- **CSV Gradebook Export**: At the end of a session—or anytime later via the **Bar Chart (`📊`) Session History** button on a quiz card—click **Export Results (CSV)** to download student ranks, total scores, correct counts, and accuracy percentages for your gradebook.
