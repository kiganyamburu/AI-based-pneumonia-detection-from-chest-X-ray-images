import os
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

class PneumoniaCNN(nn.Module):
    def __init__(self):
        super(PneumoniaCNN, self).__init__()
        # Input size: 3 x 224 x 224
        self.conv1 = nn.Conv2d(3, 16, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(16)
        self.conv2 = nn.Conv2d(16, 32, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(32)
        self.conv3 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(64)
        self.conv4 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn4 = nn.BatchNorm2d(128)
        
        self.pool = nn.MaxPool2d(2, 2) # Divides dimensions by 2
        
        # Dimensions after 4 poolings: 224 -> 112 -> 56 -> 28 -> 14
        self.fc1 = nn.Linear(128 * 14 * 14, 256)
        self.fc2 = nn.Linear(256, 2) # 2 classes: Normal (0), Pneumonia (1)
        
        self.dropout = nn.Dropout(0.5)

    def forward(self, x):
        x = self.pool(F.relu(self.bn1(self.conv1(x))))
        x = self.pool(F.relu(self.bn2(self.conv2(x))))
        x = self.pool(F.relu(self.bn3(self.conv3(x))))
        x = self.pool(F.relu(self.bn4(self.conv4(x))))
        
        x = x.view(-1, 128 * 14 * 14)
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return x

class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        
        # Register hooks
        self.forward_hook = self.target_layer.register_forward_hook(self.save_activation)
        if hasattr(self.target_layer, 'register_full_backward_hook'):
            self.backward_hook = self.target_layer.register_full_backward_hook(self.save_gradient)
        else:
            self.backward_hook = self.target_layer.register_backward_hook(self.save_gradient)
            
    def save_activation(self, module, input, output):
        self.activations = output
        
    def save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0]
        
    def generate(self, input_tensor, class_idx=None):
        self.model.eval()
        output = self.model(input_tensor)
        
        if class_idx is None:
            class_idx = output.argmax(dim=1).item()
            
        self.model.zero_grad()
        class_score = output[0, class_idx]
        class_score.backward()
        
        gradients = self.gradients.cpu().data.numpy()[0]
        activations = self.activations.cpu().data.numpy()[0]
        
        # Global average pool of gradients
        weights = np.mean(gradients, axis=(1, 2))
        
        # Weighted activation map
        heatmap = np.zeros(activations.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            heatmap += w * activations[i]
            
        heatmap = np.maximum(heatmap, 0) # ReLU
        if np.max(heatmap) > 0:
            heatmap = heatmap / np.max(heatmap) # Normalize
            
        return heatmap, output

    def remove_hooks(self):
        self.forward_hook.remove()
        self.backward_hook.remove()

def get_model(weights_path='model.pth'):
    model = PneumoniaCNN()
    if os.path.exists(weights_path):
        try:
            model.load_state_dict(torch.load(weights_path, map_location=torch.device('cpu')))
            print(f"Loaded existing model weights from {weights_path}")
        except Exception as e:
            print(f"Error loading {weights_path}: {e}. Reinitializing.")
            torch.save(model.state_dict(), weights_path)
    else:
        print(f"Weights path {weights_path} not found. Creating model with random weights.")
        os.makedirs(os.path.dirname(os.path.abspath(weights_path)) if os.path.dirname(weights_path) else '.', exist_ok=True)
        torch.save(model.state_dict(), weights_path)
    model.eval()
    return model

def preprocess_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image from {image_path}")
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (224, 224))
    
    # Normalize
    img_float = img_resized.astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_normalized = (img_float - mean) / std
    
    img_tensor = img_normalized.transpose((2, 0, 1))
    img_tensor = torch.from_numpy(img_tensor).unsqueeze(0)
    return img_tensor, img

def run_prediction_with_heatmap(model, image_path, output_heatmap_path):
    # Preprocess
    img_tensor, original_img = preprocess_image(image_path)
    
    # Init GradCAM on conv4 layer
    grad_cam = GradCAM(model, model.conv4)
    
    try:
        # Run forward & backward to get heatmap and model logits
        heatmap, logits = grad_cam.generate(img_tensor)
        
        # Softmax for probabilities
        probabilities = F.softmax(logits, dim=1).detach().cpu().numpy()[0]
        confidence_normal = float(probabilities[0])
        confidence_pneumonia = float(probabilities[1])
        
        # Prediction class
        pred_idx = int(np.argmax(probabilities))
        prediction = 'Pneumonia' if pred_idx == 1 else 'Normal'
        
        # Post-process heatmap
        # Resize to original image size
        h, w, _ = original_img.shape
        heatmap_resized = cv2.resize(heatmap, (w, h))
        heatmap_uint8 = np.uint8(255 * heatmap_resized)
        
        # Apply colormap (JET)
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
        # Convert JET (BGR) to RGB to match original image in RGB
        heatmap_colored_rgb = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)
        
        # Superimpose the heatmap on original image
        # Using 0.6 original and 0.4 heatmap overlay
        overlay = cv2.addWeighted(original_img, 0.65, heatmap_colored_rgb, 0.35, 0)
        
        # Save overlay image (convert RGB back to BGR for OpenCV write)
        overlay_bgr = cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR)
        cv2.imwrite(output_heatmap_path, overlay_bgr)
        
    finally:
        # Clean hooks
        grad_cam.remove_hooks()
        
    return {
        'prediction': prediction,
        'confidence_normal': confidence_normal,
        'confidence_pneumonia': confidence_pneumonia
    }
