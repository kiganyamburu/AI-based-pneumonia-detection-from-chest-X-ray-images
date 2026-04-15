# PneumoScan AI - Clinical Decision Support System

PneumoScan is a clinical decision-support tool (CDSS) powered by deep learning to assist healthcare professionals in identifying pneumonia from chest X-ray images. 

> [!NOTE]
> **Clinical Notice**: This system is designed as a diagnostic assistant to support radiologists and physicians. It is not a replacement for professional clinical evaluation, and all results must be verified by a qualified physician.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend** | React (Vite) | High-fidelity dark mode dashboard with glassmorphism and interactive slider. |
| **Backend** | Flask | Restful API routing and database coordination. |
| **AI Model** | PyTorch | Custom 4-Layer Convolutional Neural Network (CNN). |
| **Explainability**| Grad-CAM | Visualizes convolutional activation maps to highlight abnormalities. |
| **Image Proc.** | OpenCV | Preprocessing, resizing, and blending heatmaps on radiographs. |
| **Database** | PostgreSQL / SQLite | SQLite fallback for local running, PostgreSQL for Docker Compose. |
| **Deployment** | Docker & Compose | Multi-container coordination for production readiness. |

---

## 📂 Project Structure

```text
├── backend/
│   ├── app.py                # Flask server entry point (static serving, DB, API)
│   ├── models.py             # SQLAlchemy schemas (patient prediction history)
│   ├── model_inference.py    # CNN structure, preprocessing, and Grad-CAM logic
│   ├── train_model.py        # Dataloader and training script for model weights
│   ├── requirements.txt      # Python dependencies
│   └── model.pth             # Model weights file (auto-generated if missing)
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Diagnostic viewer, upload flow, history & print report
│   │   ├── index.css         # Styling system (glassmorphic, print layouts, transitions)
│   │   └── main.jsx          # React app mount
│   ├── vite.config.js        # Vite config with dev proxy to port 5000
│   └── package.json          # Node dependencies (e.g. lucide-react)
├── Dockerfile.backend        # Flask container setup with OpenCV libraries
├── Dockerfile.frontend       # Vite compilation and Nginx production container
├── nginx.conf                # Nginx router fallback and reverse proxy settings
├── docker-compose.yml        # Orchestration configuration
└── README.md                 # Project documentation
```

---

## 🚀 Running the Application

### Option A: Local Run (Recommended for Development)

Since Docker is not running locally, follow these steps to run the application natively on your system:

#### 1. Start the Flask Backend API
1. Open a terminal and navigate to the project root:
   ```bash
   cd c:/Users/User/Desktop/Projects/AI-based-pneumonia-detection-from-chest-X-ray-images
   ```
2. Install the Python dependencies (requires Python 3.14+):
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Launch the Flask server:
   ```bash
   python backend/app.py
   ```
   *The backend will boot up, automatically create `backend/model.pth` with initialization weights if it's missing, and create the SQLite database `backend/pneumonia.db`.*

#### 2. Start the React Frontend
1. Open a second terminal window and navigate to the `frontend/` folder:
   ```bash
   cd c:/Users/User/Desktop/Projects/AI-based-pneumonia-detection-from-chest-X-ray-images/frontend
   ```
2. Install the Node packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000` to start scanning.

---

### Option B: Docker Containerized Build

To run the full stack with a PostgreSQL database in production containers:

1. Ensure Docker Desktop is installed and running on your machine.
2. Build and launch the container network from the project root:
   ```bash
   docker-compose up --build
   ```
3. The services will map to:
   *   **React Frontend**: `http://localhost` (Port 80)
   *   **Flask API Backend**: `http://localhost:5000`
   *   **PostgreSQL DB**: `http://localhost:5432`

---

## 🧠 Model Training

The workspace includes a complete chest X-ray dataset inside `chest_xray/`. To train the CNN model on this dataset and overwrite the default weights:

1. Run the training script from the root folder:
   ```bash
   python backend/train_model.py --epochs 5 --batch-size 32 --lr 0.001
   ```
2. The script will perform random image augmentations (rotation, flips), train, validate, and save the best checkpoint directly to `backend/model.pth`.

---

## 🔍 How Grad-CAM Works in PneumoScan
Grad-CAM (Gradient-weighted Class Activation Mapping) calculates the gradients of the target class score (Pneumonia) relative to the activations of the final convolutional layer (`conv4` in our model). 

1. During inference, a forward pass is run on the 224x224 X-ray image.
2. We target the target classification node, backpropagate gradients, and perform global average pooling on these gradients to get filter weights.
3. We calculate a weighted average of the feature maps, apply a Rectified Linear Unit (ReLU) to isolate positive activations, and normalize the values.
4. Using OpenCV, we upscale this mapping to the original image dimensions, apply a JET color scheme (red = high focus, blue = low focus), and superimpose it on the original radiograph using a 65/35 alpha blend.
