import os
import sys
import glob
import cv2
import numpy as np
import argparse
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from model_inference import PneumoniaCNN

# Simple numpy/OpenCV data augmentation
def augment_image(img):
    # Random horizontal flip
    if np.random.rand() > 0.5:
        img = cv2.flip(img, 1)
    
    # Random rotation (-10 to 10 degrees)
    if np.random.rand() > 0.5:
        angle = np.random.uniform(-10, 10)
        h, w = img.shape[:2]
        M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
        img = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)
        
    return img

class ChestXRayDataset(Dataset):
    def __init__(self, dir_path, augment=False):
        self.file_paths = []
        self.labels = []
        self.augment = augment
        
        # NORMAL = 0, PNEUMONIA = 1
        for label_idx, label_name in enumerate(['NORMAL', 'PNEUMONIA']):
            class_dir = os.path.join(dir_path, label_name)
            if not os.path.exists(class_dir):
                # Check nested chest_xray directory as a backup
                class_dir = os.path.join(dir_path, 'chest_xray', label_name)
                
            if os.path.exists(class_dir):
                paths = []
                for ext in ('*.png', '*.jpg', '*.jpeg', '*.PNG', '*.JPG', '*.JPEG'):
                    paths.extend(glob.glob(os.path.join(class_dir, ext)))
                
                self.file_paths.extend(paths)
                self.labels.extend([label_idx] * len(paths))
                
        print(f"Loaded {len(self.file_paths)} images from {dir_path}")
        if len(self.file_paths) == 0:
            print(f"WARNING: No images found in {dir_path}. Check folder structure.")

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        img_path = self.file_paths[idx]
        label = self.labels[idx]
        
        img = cv2.imread(img_path)
        if img is None:
            # Fallback in case of corruption
            img = np.zeros((224, 224, 3), dtype=np.uint8)
        else:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, (224, 224))
            
        if self.augment:
            img = augment_image(img)
            
        # Normalize
        img_float = img.astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        img_normalized = (img_float - mean) / std
        
        img_tensor = img_normalized.transpose((2, 0, 1))
        img_tensor = torch.from_numpy(img_tensor)
        return img_tensor, label

def train(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training on device: {device}")
    
    # Initialize datasets
    train_dataset = ChestXRayDataset(args.train_dir, augment=True)
    val_dataset = ChestXRayDataset(args.val_dir, augment=False)
    
    if len(train_dataset) == 0:
        print("Error: Train dataset is empty. Check data paths.")
        sys.exit(1)
        
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)
    
    model = PneumoniaCNN().to(device)
    
    # If starting from existing weights
    if os.path.exists(args.model_path):
        try:
            model.load_state_dict(torch.load(args.model_path, map_location=device))
            print(f"Resuming training from {args.model_path}")
        except Exception as e:
            print(f"Could not load state dict: {e}. Starting from scratch.")
            
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    
    best_val_loss = float('inf')
    
    for epoch in range(args.epochs):
        model.train()
        train_loss = 0.0
        correct_train = 0
        total_train = 0
        
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            total_train += labels.size(0)
            correct_train += predicted.eq(labels).sum().item()
            
        epoch_train_loss = train_loss / total_train
        epoch_train_acc = 100.0 * correct_train / total_train
        
        # Validation
        model.eval()
        val_loss = 0.0
        correct_val = 0
        total_val = 0
        
        if len(val_dataset) > 0:
            with torch.no_grad():
                for images, labels in val_loader:
                    images, labels = images.to(device), labels.to(device)
                    outputs = model(images)
                    loss = criterion(outputs, labels)
                    
                    val_loss += loss.item() * images.size(0)
                    _, predicted = outputs.max(1)
                    total_val += labels.size(0)
                    correct_val += predicted.eq(labels).sum().item()
            
            epoch_val_loss = val_loss / total_val
            epoch_val_acc = 100.0 * correct_val / total_val
            print(f"Epoch {epoch+1}/{args.epochs} - Train Loss: {epoch_train_loss:.4f}, Train Acc: {epoch_train_acc:.2f}% | Val Loss: {epoch_val_loss:.4f}, Val Acc: {epoch_val_acc:.2f}%")
        else:
            epoch_val_loss = 0.0
            print(f"Epoch {epoch+1}/{args.epochs} - Train Loss: {epoch_train_loss:.4f}, Train Acc: {epoch_train_acc:.2f}% (No Validation Data)")
            
        # Save model
        if len(val_dataset) > 0:
            if epoch_val_loss < best_val_loss:
                best_val_loss = epoch_val_loss
                torch.save(model.state_dict(), args.model_path)
                print(f"Saved best model weights to {args.model_path} with Val Loss {best_val_loss:.4f}")
        else:
            torch.save(model.state_dict(), args.model_path)
            print(f"Saved model weights to {args.model_path}")
            
    print("Training finished.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train Pneumonia CNN Model")
    parser.add_argument('--train-dir', type=str, default='../chest_xray/train', help='Path to train directory')
    parser.add_argument('--val-dir', type=str, default='../chest_xray/val', help='Path to val directory')
    parser.add_argument('--model-path', type=str, default='model.pth', help='Path to save the model')
    parser.add_argument('--epochs', type=int, default=5, help='Number of epochs')
    parser.add_argument('--batch-size', type=int, default=32, help='Batch size')
    parser.add_argument('--lr', type=float, default=0.001, help='Learning rate')
    
    args = parser.parse_args()
    train(args)
