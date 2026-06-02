import numpy as np
import json
import torch
import torch.nn as nn
from pathlib import Path
from torch.utils.data import Dataset, DataLoader
from nltk_utils import bag_of_words, tokenize, lemmatize, ensure_nltk_data
from model import NeuralNet


class ChatDataset(Dataset):
    def __init__(self, X_train, y_train):
        self.n_samples = len(X_train)
        self.x_data = X_train
        self.y_data = y_train

    def __getitem__(self, index):
        return self.x_data[index], self.y_data[index]

    def __len__(self):
        return self.n_samples


def train_chatbot():
    try:
        ensure_nltk_data(allow_download=True)

        # H6: use absolute path so training works from any directory
        intents_path = Path(__file__).resolve().parent / "intents.json"
        with open(intents_path, "r", encoding="utf-8") as f:
            intents = json.load(f)

        all_words = []
        tags = []
        xy = []

        for intent in intents["intents"]:
            tag = intent["tag"]
            tags.append(tag)
            for pattern in intent["patterns"]:
                w = tokenize(pattern)
                all_words.extend(w)
                xy.append((w, tag))

        ignore_words = ["?", ".", "!", ",", ";", ":"]
        all_words = [lemmatize(w) for w in all_words if w not in ignore_words]
        all_words = sorted(set(all_words))
        tags = sorted(set(tags))

        # P1: build word_to_index once and pass it to every bag_of_words call
        word_to_index = {word: i for i, word in enumerate(all_words)}
        tag_to_index  = {t: i for i, t in enumerate(tags)}

        X_train = []
        y_train = []

        for (pattern_sent, pattern_tag) in xy:
            bag = bag_of_words(pattern_sent, all_words, word_to_index=word_to_index)
            X_train.append(bag)
            y_train.append(tag_to_index[pattern_tag])

        X_train = np.array(X_train)
        y_train = np.array(y_train)

        num_epochs = 3000
        batch_size = 32
        learning_rate = 0.001
        input_size = len(X_train[0])
        hidden_size = 128   # Scaled up for 91 intents
        output_size = len(tags)

        if len(tags) > 30 and hidden_size < 64:
            print(f"Warning: {len(tags)} tags with hidden_size={hidden_size} may underfit.")

        dataset = ChatDataset(X_train, y_train)
        train_loader = DataLoader(dataset=dataset, batch_size=batch_size, shuffle=True, num_workers=0)

        # B6: guard against division by zero on empty DataLoader
        if len(train_loader) == 0:
            raise RuntimeError("No training batches available. Check that intents.json has patterns.")

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = NeuralNet(input_size, hidden_size, output_size).to(device)

        criterion = nn.CrossEntropyLoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

        print("Training started...")
        loss = None
        for epoch in range(num_epochs):
            total_loss = 0.0
            for (words, labels) in train_loader:
                words = words.to(device)
                labels = labels.to(dtype=torch.long).to(device)

                # M3: zero_grad before forward pass (standard PyTorch order)
                optimizer.zero_grad()
                outputs = model(words)
                loss = criterion(outputs, labels)
                total_loss += loss.item()

                loss.backward()
                optimizer.step()

            if (epoch + 1) % 100 == 0:
                avg_loss = total_loss / len(train_loader)
                print(f"Epoch [{epoch+1}/{num_epochs}], Average Loss: {avg_loss:.4f}")

        if loss is not None:
            print(f"Final loss: {loss.item():.4f}")
        else:
            print("No batches were processed during training.")

        data = {
            "model_state": model.state_dict(),
            "input_size": input_size,
            "hidden_size": hidden_size,
            "output_size": output_size,
            "all_words": all_words,
            "tags": tags,
        }

        FILE = Path(__file__).resolve().parent / "data.pth"
        torch.save(data, FILE)
        print(f"Training complete. Model saved to {FILE}")
        return True

    except Exception as e:
        print(f"Error during training: {e}")
        return False


if __name__ == "__main__":
    train_chatbot()
