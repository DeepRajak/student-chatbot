**Student Chatbot (RCCIIT) — Monorepo**

A lightweight student-facing chatbot project with a Flask + PyTorch backend and a Next.js frontend. The bot replies in a first-person, college-representative voice and includes direct website links when official information is the authoritative source.

**Purpose**: Provide a local, easy-to-run example of an intent-based chatbot for college websites. Useful for demos, student help desks, and experimenting with small supervised chat models.

**Tech Stack**
- **Backend**: Python, Flask, PyTorch, NLTK — see [backend/train.py](backend/train.py) and [backend/app.py](backend/app.py).
- **Frontend**: Next.js (app router), React, Tailwind CSS — see [frontend/src/app/page.js](frontend/src/app/page.js).
- **Data**: Intent definitions in [backend/intents.json](backend/intents.json). Trained model saved to [backend/data.pth](backend/data.pth).

**Quickstart (Windows / PowerShell)**

1. Create and activate a virtual environment (required for backend operations):

```powershell
python -m venv venv
& .\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

2. Install frontend dependencies:

```powershell
cd frontend
npm install
cd ..
```

3. Ensure NLTK corpora are available locally. The repo stores corpora under `backend/nltk_data`. Before starting the backend, set the `NLTK_DATA` env var so the Flask app can find them:

```powershell
$env:NLTK_DATA = (Resolve-Path .\backend\nltk_data).Path
```

4. (Optional) Train the model. This will download any missing NLTK corpora (if `allow_download=True` in `train.py`) and produce `backend/data.pth`.

```powershell
# from repo root, with venv activated
cd backend
python train.py
cd ..
```

5. Start the backend API (Flask):

```powershell
# from repo root, with venv activated and NLTK_DATA set
cd backend
python app.py
```

The backend serves on http://127.0.0.1:5000 by default. Health check: GET http://127.0.0.1:5000/health

6. Start the frontend (Next.js):

```powershell
# from repo root
npm run dev --prefix frontend
```

The Next.js dev server typically opens at http://localhost:3000 (may auto-increment to 3001/3002 if ports are in use).

7. Test end-to-end
- Open the frontend in a browser and use the chat UI.
- Or POST directly to the backend API:

```powershell
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:5000/api/chat -Body (@{message='Tell me about admissions'} | ConvertTo-Json) -ContentType 'application/json'
```

**API**
- `POST /api/chat` — body: `{ "message": "<user text>" }` → response: `{ "response": "...", "success": true }`.
- Frontend proxy: `POST /api/chatbot` (handled by Next.js route at [frontend/src/app/api/chatbot/route.js](frontend/src/app/api/chatbot/route.js)).

**Important Notes & Troubleshooting**
- Always activate the virtual environment before installing Python packages or running backend commands. Running without the venv can lead to missing packages (for example, `torch`).
- Set `NLTK_DATA` to point to `backend/nltk_data` before starting the backend. If `wordnet` or other corpora are missing, the Flask app will raise a RuntimeError. Example:

```powershell
$env:NLTK_DATA = (Resolve-Path .\backend\nltk_data).Path
# then run the backend
python backend/app.py
```
- If the frontend shows module or fast-refresh errors, try clearing the Next.js cache and restarting:

```powershell
Remove-Item -Recurse -Force frontend\.next -ErrorAction SilentlyContinue
npm run dev --prefix frontend
```

**Where to change bot text or behavior**
- Intent definitions (tags/patterns/responses): [backend/intents.json](backend/intents.json).
- Deterministic quick-prompt routing: see [backend/chat.py](backend/chat.py) (the `direct_routes` mapping used for exact prompt matches).
- Retrain after you update `intents.json` by running `python backend/train.py`.

**Contributing**
- Feel free to open issues or pull requests. If you update intents, please add example `patterns` for short quick prompts (the model can misclassify short canned prompts without explicit examples).

**License & Maintainer**
- Add your preferred license to make this repo public. Maintainer: add contact details here.

-----
If you'd like, I can also:
- Commit and push this README for you.
- Expand the docs with a quick developer workflow (Git branches, test commands), or add a sample `docker-compose.yml` for local development.
This repository is now split into two service folders:

- [frontend/](frontend) for the Next.js app
- [backend/](backend) for the Flask chatbot API and model files

## Getting Started

Start the backend first:

```bash
cd backend
python app.py
```

Then start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Notes

- The frontend proxies chat requests to the backend API.
- Set `CHATBOT_BACKEND_URL` if the Flask service is not running on `http://localhost:5000`.
- Train the model from the backend folder with `python train.py`.
