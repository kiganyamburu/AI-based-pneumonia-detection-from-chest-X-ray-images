from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class PredictionRecord(db.Model):
    __tablename__ = 'predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_name = db.Column(db.String(100), nullable=False)
    prediction = db.Column(db.String(20), nullable=False)
    confidence_normal = db.Column(db.Float, nullable=False)
    confidence_pneumonia = db.Column(db.Float, nullable=False)
    original_image = db.Column(db.String(255), nullable=False)
    heatmap_image = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_name': self.patient_name,
            'prediction': self.prediction,
            'confidence_normal': round(self.confidence_normal, 4),
            'confidence_pneumonia': round(self.confidence_pneumonia, 4),
            'original_image': self.original_image,
            'heatmap_image': self.heatmap_image,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }
