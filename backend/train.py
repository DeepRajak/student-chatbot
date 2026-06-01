import numpy as np
import json
import torch
import torch.nn as nn
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

        # Load intents
        with open('intents.json', 'r', encoding='utf-8') as f:
            intents = json.load(f)

        # Initialize lists
        all_words = []
        tags = []
        xy = []

        # Process patterns and tags
        for intent in intents['intents']:
            tag = intent['tag']
            tags.append(tag)
            for pattern in intent['patterns']:
                w = tokenize(pattern)
                all_words.extend(w)
                xy.append((w, tag))

        # Preprocess words
        ignore_words = ['?', '.', '!', ',', ';', ':']
        all_words = [lemmatize(w) for w in all_words if w not in ignore_words]
        all_words = sorted(set(all_words))
        tags = sorted(set(tags))

        # Create training data
        X_train = []
        y_train = []

        for (pattern_sentence, tag) in xy:
            bag = bag_of_words(pattern_sentence, all_words)
            X_train.append(bag)
            label = tags.index(tag)
            y_train.append(label)

        X_train = np.array(X_train)
        y_train = np.array(y_train)

        # Hyperparameters
        num_epochs = 2000  # Increased epochs
        batch_size = 16   # Increased batch size
        learning_rate = 0.001
        input_size = len(X_train[0])
        hidden_size = 16  # Increased hidden size
        output_size = len(tags)

        # Create dataset and dataloader
        dataset = ChatDataset(X_train, y_train)
        train_loader = DataLoader(dataset=dataset, batch_size=batch_size, shuffle=True, num_workers=0)

        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model = NeuralNet(input_size, hidden_size, output_size).to(device)

        # Loss and optimizer
        criterion = nn.CrossEntropyLoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

        # Training loop
        print("Training started...")
        for epoch in range(num_epochs):
            total_loss = 0
            for (words, labels) in train_loader:
                words = words.to(device)
                labels = labels.to(dtype=torch.long).to(device)

                outputs = model(words)
                loss = criterion(outputs, labels)
                total_loss += loss.item()

                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            if (epoch + 1) % 100 == 0:
                avg_loss = total_loss / len(train_loader)
                print(f'Epoch [{epoch+1}/{num_epochs}], Average Loss: {avg_loss:.4f}')

        print(f'Final loss: {loss.item():.4f}')

        data = {
            "model_state": model.state_dict(),
            "input_size": input_size,
            "hidden_size": hidden_size,
            "output_size": output_size,
            "all_words": all_words,
            "tags": tags
        }

        FILE = "data.pth"
        torch.save(data, FILE)
        print(f'Training complete. Model saved to {FILE}')
        return True

    except Exception as e:
        print(f"Error during training: {str(e)}")
        return False

if __name__ == "__main__":
    train_chatbot()