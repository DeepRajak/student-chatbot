import json, re, random
from pathlib import Path

p = Path(__file__).resolve().parent / 'intents.json'
with p.open(encoding='utf-8') as f:
    intents = json.load(f)['intents']


def find_intent(message):
    mwords = set(re.findall(r"\w+", message.lower()))
    best = None
    best_score = 0
    for it in intents:
        for pat in it.get('patterns', []):
            pwords = set(re.findall(r"\w+", pat.lower()))
            score = len(mwords & pwords)
            if score > best_score:
                best_score = score
                best = it
    if not best:
        for it in intents:
            for pat in it.get('patterns', []):
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
    "Who heads the governing body?"
]

for q in queries:
    it = find_intent(q)
    print('Q:', q)
    if not it:
        print('A: No matching intent found.')
    else:
        print('Matched tag:', it.get('tag'))
        print('A:', random.choice(it.get('responses', ['No response defined'])))
    print('---')
