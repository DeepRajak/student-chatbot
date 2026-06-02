import json
import re
import random
from pathlib import Path
from sys import exit

# B14: error handling for file I/O and JSON parsing
p = Path(__file__).resolve().parent / "intents.json"
try:
    with p.open(encoding="utf-8") as f:
        intents = json.load(f)["intents"]
except FileNotFoundError:
    print(f"Error: intents.json not found at {p}")
    exit(1)
except (json.JSONDecodeError, KeyError) as e:
    print(f"Error: Invalid intents.json — {e}")
    exit(1)


def find_intent(message):
    mwords = set(re.findall(r"\w+", message.lower()))
    best, best_score = None, 0
    for it in intents:
        for pat in it.get("patterns", []):
            pwords = set(re.findall(r"\w+", pat.lower()))
            score = len(mwords & pwords)
            if score > best_score:
                best_score, best = score, it
    if not best:
        for it in intents:
            for pat in it.get("patterns", []):
                if pat.lower() in message.lower() or message.lower() in pat.lower():
                    best = it
                    break
            if best:
                break
    return best


queries = [
    "Who is the principal?",
    "Where is RCCIIT located?",
    "How can I get admission?",
    "Tell me about the library",
    "Who heads the governing body?",
]

for q in queries:
    it = find_intent(q)
    print("Q:", q)
    if not it:
        print("A: No matching intent found.")
    else:
        print("Matched tag:", it.get("tag"))
        print("A:", random.choice(it.get("responses", ["No response defined"])))
    print("---")
