import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from models import db, PredictionRecord
from model_inference import get_model, run_prediction_with_heatmap

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Database Config
# Fallback to local sqlite file if DATABASE_URL is not set
database_url = os.getenv('DATABASE_URL')
if not database_url:
    # Use SQLite relative to the backend folder
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pneumonia.db')
    database_url = f"sqlite:///{db_path}"
    
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize DB
db.init_app(app)

# Upload directory
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Load AI Model (Initializes default weights if model.pth is missing)
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model.pth')
model = get_model(MODEL_PATH)

# Create database tables
with app.app_context():
    db.create_all()
    print("Database tables verified.")

@app.route('/api/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file uploaded'}), 400
        
    file = request.files['image']
    patient_name = request.form.get('patient_name', '').strip()
    
    if not patient_name:
        patient_name = 'Anonymous Patient'
        
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400
        
    # Generate unique filenames
    unique_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename)
    if not ext:
        ext = '.jpg' # default
        
    filename = f"{unique_id}_orig{ext}"
    heatmap_filename = f"{unique_id}_heatmap{ext}"
    
    original_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    heatmap_path = os.path.join(app.config['UPLOAD_FOLDER'], heatmap_filename)
    
    # Save original image
    try:
        file.save(original_path)
    except Exception as e:
        return jsonify({'error': f"Failed to save upload image: {e}"}), 500
        
    # Run prediction & generate heatmap
    try:
        results = run_prediction_with_heatmap(model, original_path, heatmap_path)
    except Exception as e:
        # Cleanup uploaded file if prediction fails
        if os.path.exists(original_path):
            os.remove(original_path)
        return jsonify({'error': f"Inference engine failure: {e}"}), 500
        
    # Save record in database
    # Storing relative paths for API serving
    relative_orig = f"/api/uploads/{filename}"
    relative_heatmap = f"/api/uploads/{heatmap_filename}"
    
    record = PredictionRecord(
        patient_name=patient_name,
        prediction=results['prediction'],
        confidence_normal=results['confidence_normal'],
        confidence_pneumonia=results['confidence_pneumonia'],
        original_image=relative_orig,
        heatmap_image=relative_heatmap
    )
    
    try:
        db.session.add(record)
        db.session.commit()
    except Exception as e:
        return jsonify({'error': f"Database save failure: {e}"}), 500
        
    return jsonify(record.to_dict()), 201

@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        records = PredictionRecord.query.order_by(PredictionRecord.created_at.desc()).all()
        return jsonify([r.to_dict() for r in records]), 200
    except Exception as e:
        return jsonify({'error': f"Database query failure: {e}"}), 500

@app.route('/api/history/<int:record_id>', methods=['DELETE'])
def delete_record(record_id):
    try:
        record = PredictionRecord.query.get(record_id)
        if not record:
            return jsonify({'error': 'Record not found'}), 404
            
        # Clean up files on disk
        # extract filenames from the relative paths
        orig_filename = record.original_image.split('/')[-1]
        heatmap_filename = record.heatmap_image.split('/')[-1]
        
        orig_path = os.path.join(app.config['UPLOAD_FOLDER'], orig_filename)
        heatmap_path = os.path.join(app.config['UPLOAD_FOLDER'], heatmap_filename)
        
        if os.path.exists(orig_path):
            os.remove(orig_path)
        if os.path.exists(heatmap_path):
            os.remove(heatmap_path)
            
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({'message': f"Record {record_id} deleted successfully"}), 200
    except Exception as e:
        return jsonify({'error': f"Deletion failure: {e}"}), 500

@app.route('/api/uploads/<filename>', methods=['GET'])
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    # Running on port 5000 by default
    app.run(host='0.0.0.0', port=5000, debug=True)
