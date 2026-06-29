import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Activity, 
  History, 
  FileText, 
  Trash2, 
  User, 
  Calendar, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  ChevronRight, 
  RefreshCw, 
  Search, 
  Sliders, 
  Eye, 
  Download,
  Database,
  ArrowRight
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [patientName, setPatientName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Results State
  const [scanResult, setScanResult] = useState(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // History State
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage('');
      setScanResult(null); // Reset previous results on new file select
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage('');
      setScanResult(null);
    } else {
      setErrorMessage('Unsupported file format. Please upload PNG, JPG, or JPEG.');
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select or drop a chest X-ray image.');
      return;
    }
    
    setIsAnalyzing(true);
    setErrorMessage('');
    
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('patient_name', patientName || 'Anonymous Patient');

    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error during scan analysis.');
      }

      const data = await response.json();
      setScanResult(data);
      // Refresh history list
      fetchHistory();
    } catch (err) {
      setErrorMessage(err.message || 'Connection to Flask backend failed.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteHistory = async (id) => {
    if (!confirm('Are you sure you want to delete this record from history?')) return;
    try {
      const response = await fetch(`${API_BASE}/history/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        // If the deleted record is currently displayed in the results, clear it
        if (scanResult && scanResult.id === id) {
          setScanResult(null);
          setSelectedFile(null);
          setPreviewUrl('');
        }
        fetchHistory();
      } else {
        alert('Failed to delete history record.');
      }
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  };

  const loadHistoricalRecord = (record) => {
    setScanResult(record);
    setPatientName(record.patient_name);
    setPreviewUrl(`http://localhost:5000${record.original_image}`);
    setSelectedFile(null); // Clear active file upload state
    setActiveTab('dashboard');
  };

  // Slider Math
  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 0) return;
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  const handlePrint = (record) => {
    const printWindow = window.open('', '_blank');
    const isPneumonia = record.prediction === 'Pneumonia';
    const confidenceText = isPneumonia 
      ? `${(record.confidence_pneumonia * 100).toFixed(1)}%` 
      : `${(record.confidence_normal * 100).toFixed(1)}%`;
      
    printWindow.document.write(`
      <html>
        <head>
          <title>AI Clinical Report - ${record.patient_name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; padding: 40px; line-height: 1.6; }
            .header { border-bottom: 3px solid #06b6d4; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
            .header p { margin: 5px 0 0 0; color: #6b7280; font-size: 14px; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .meta-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
            .meta-table td.label { font-weight: bold; color: #4b5563; width: 25%; }
            .results-box { background-color: ${isPneumonia ? '#fff1f2' : '#ecfdf5'}; border-left: 6px solid ${isPneumonia ? '#f43f5e' : '#10b981'}; padding: 20px; border-radius: 6px; margin-bottom: 30px; }
            .results-box h2 { margin: 0 0 10px 0; color: ${isPneumonia ? '#9f1239' : '#065f46'}; font-size: 20px; }
            .results-box p { margin: 0; font-size: 16px; color: ${isPneumonia ? '#be123c' : '#047857'}; font-weight: 500; }
            .images-section { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 30px; }
            .image-card { flex: 1; text-align: center; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #f9fafb; }
            .image-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #4b5563; }
            .image-card img { max-width: 100%; height: 280px; object-fit: contain; border-radius: 4px; border: 1px solid #d1d5db; }
            .recommendation { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin-bottom: 40px; }
            .recommendation h4 { margin: 0 0 8px 0; color: #334155; }
            .recommendation p { margin: 0; font-size: 14px; color: #475569; }
            .disclaimer { font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 40px; text-align: justify; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
            .sig-box { text-align: center; width: 220px; }
            .sig-line { border-top: 1px solid #4b5563; margin-bottom: 5px; }
            .sig-text { font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>PNEUMONIA SCAN REPORT</h1>
              <p>Clinical Decision Support System (CDSS) - Powered by PyTorch</p>
            </div>
            <div style="text-align: right">
              <span style="font-size: 14px; font-weight: 600; color: #06b6d4; border: 1px solid #06b6d4; padding: 4px 8px; border-radius: 4px;">AI ASSISTED</span>
            </div>
          </div>

          <table class="meta-table">
            <tr>
              <td class="label">Patient Name</td>
              <td>${record.patient_name}</td>
              <td class="label">Date Generated</td>
              <td>${record.created_at}</td>
            </tr>
            <tr>
              <td class="label">Record ID</td>
              <td>#CDSS-${record.id}-${record.created_at.split(' ')[0].replace(/-/g, '')}</td>
              <td class="label">AI Model Used</td>
              <td>PneumoniaCNN-ResNetv1 (4-Layer Conv)</td>
            </tr>
          </table>

          <div class="results-box">
            <h2>Diagnostic Conclusion</h2>
            <p>Prediction: <strong>${record.prediction.toUpperCase()}</strong> (${confidenceText} Confidence)</p>
          </div>

          <div class="images-section">
            <div class="image-card">
              <h3>Original Chest X-Ray</h3>
              <img src="http://localhost:5000${record.original_image}" alt="Original X-ray" />
            </div>
            <div class="image-card">
              <h3>Grad-CAM Attention Heatmap</h3>
              <img src="http://localhost:5000${record.heatmap_image}" alt="Grad-CAM Heatmap" />
            </div>
          </div>

          <div class="recommendation">
            <h4>Clinical Guidance & Action Plan</h4>
            <p>${isPneumonia 
              ? 'ALERT: High confidence detection of opacity and lung consolidation. Recommended actions include immediate clinical validation, verification against patient history (fever, cough, dyspnea), and consulting a qualified physician or pulmonologist for definitive diagnosis and treatment plan.'
              : 'Observation reveals standard lung inflation and structure with no major abnormalities matching pneumonic consolidation. Continue routine clinical monitoring as indicated by symptoms.'}
            </p>
          </div>

          <div class="disclaimer">
            <strong>NOTICE & DISCLAIMER:</strong> This analysis is generated by a deep learning algorithm designed to support radiologists and clinical professionals by highlighting potential regions of abnormality. It is provided strictly as a clinical decision-support tool. It does NOT constitute medical advice, nor does it replace the clinical evaluation, diagnosis, or treatment decisions of a licensed healthcare professional. All findings must be validated and confirmed by a certified doctor before administering treatment.
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-text">Attending Clinician / MD Signature</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-text">AI Verification Timestamp</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered History
  const filteredHistory = history.filter(item => {
    const matchesSearch = item.patient_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterClass === 'ALL') return matchesSearch;
    return matchesSearch && item.prediction.toUpperCase() === filterClass;
  });

  return (
    <div className="app-wrapper">
      {/* Premium Navigation Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-section">
            <div className="brand-logo">
              <Activity />
            </div>
            <div>
              <span className="brand-title">
                PneumoScan <span className="brand-badge">AI CDSS</span>
              </span>
              <p className="brand-subtitle">Clinical Decision Support System</p>
            </div>
          </div>
          
          <nav className="nav-menu">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <Sliders size={15} />
              Analysis Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            >
              <History size={15} />
              Patient Logs
              {history.length > 0 && (
                <span className="tab-badge">
                  {history.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main View Area */}
      <main className="main-content">
        
        {/* Clinical Disclaimer Bar */}
        <div className="disclaimer-bar">
          <AlertTriangle className="disclaimer-icon" size={20} />
          <div>
            <h4 className="disclaimer-title">Clinical Decision Support Tool Notice</h4>
            <p className="disclaimer-text">
              This system is an AI decision-support utility trained to locate abnormalities on chest radiographs. It is designed to assist radiologists and physicians. It does not replace clinical evaluation or direct physical diagnostics, and must be validated by a licensed physician.
            </p>
          </div>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="dashboard-grid">
            
            {/* Left Side: Patient Form & Image Upload */}
            <div className="sidebar-col">
              
              <div className="case-card">
                <div className="card-title-section">
                  <h3 className="card-title">Patient Case Registration</h3>
                  <p className="card-subtitle">Enter details to register diagnostic case file</p>
                </div>
                
                <div className="input-field">
                  <label className="input-label">Patient Name</label>
                  <div className="input-icon-wrapper">
                    <User className="input-icon" />
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="text-input"
                    />
                  </div>
                </div>

                <div className="input-field">
                  <label className="input-label">Chest X-ray Image</label>
                  
                  {/* Dropzone Container */}
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="dropzone-container"
                  >
                    <input 
                      type="file" 
                      accept=".png, .jpg, .jpeg"
                      onChange={handleFileChange}
                      className="dropzone-file-input"
                    />
                    
                    {previewUrl ? (
                      <div className="dropzone-preview">
                        <img 
                          src={previewUrl} 
                          alt="X-ray preview" 
                        />
                        <div className="dropzone-preview-badge">
                          <CheckCircle size={14} />
                          Image Selected
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="dropzone-icon-box">
                          <Upload size={20} />
                        </div>
                        <span className="dropzone-title">Drag & drop radiograph image</span>
                        <p className="dropzone-subtitle">Supports PNG, JPG, JPEG up to 10MB</p>
                      </>
                    )}
                  </div>
                </div>

                {errorMessage && (
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    borderRadius: '10px',
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '20px'
                  }}>
                    <ShieldAlert style={{ color: '#f43f5e', flexShrink: 0 }} size={16} />
                    <span style={{ fontSize: '11px', color: '#fda4af' }}>{errorMessage}</span>
                  </div>
                )}

                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !selectedFile}
                  className="btn-primary"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw size={16} className="spin-animation" style={{ animation: 'spin 1.5s linear infinite' }} />
                      Analyzing Case Radiograph...
                    </>
                  ) : (
                    <>
                      <Activity size={16} />
                      Run AI Diagnostic Scan
                    </>
                  )}
                </button>
              </div>

              {/* Sidebar Recent Log List */}
              {history.length > 0 && (
                <div className="case-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span className="card-title">Recent Case Files</span>
                    <button 
                      onClick={() => setActiveTab('history')}
                      style={{ background: 'none', border: 'none', fontSize: '10px', fontWeight: 'bold', color: '#06b6d4', cursor: 'pointer' }}
                    >
                      View All Logs
                    </button>
                  </div>
                  <div className="recent-logs-list">
                    {history.slice(0, 3).map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => loadHistoricalRecord(item)}
                        className="recent-log-item"
                      >
                        <div className="recent-log-meta">
                          <div className={`status-dot ${item.prediction === 'Pneumonia' ? 'pneumonia' : 'normal'}`}></div>
                          <div>
                            <span className="recent-log-name">{item.patient_name}</span>
                            <span className="recent-log-date">{item.created_at.split(' ')[0]}</span>
                          </div>
                        </div>
                        <span className={`recent-log-tag ${item.prediction === 'Pneumonia' ? 'pneumonia' : 'normal'}`}>
                          {item.prediction}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right Side: Scan Analysis Viewer & Results */}
            <div className="viewer-col">
              
              {scanResult ? (
                <div className="case-card">
                  
                  {/* Results Header */}
                  <div className="results-header-block">
                    <div>
                      <span className="results-header-tag">Analysis Evaluation Report</span>
                      <h2 className="results-header-title">{scanResult.patient_name}</h2>
                      <span className="results-header-date">Scan timestamp: {scanResult.created_at}</span>
                    </div>
                    
                    <button 
                      onClick={() => handlePrint(scanResult)}
                      className="btn-report"
                    >
                      <Download size={14} />
                      Download Case Report
                    </button>
                  </div>

                  {/* Diagnostic Badge & Probabilities Grid */}
                  <div className="diagnostic-conclusion-row">
                    
                    <div className={`diagnostic-conclusion-badge ${scanResult.prediction === 'Pneumonia' ? 'pneumonia' : 'normal'}`}>
                      <span className="conclusion-label">AI Finding</span>
                      <div className={`conclusion-val ${scanResult.prediction === 'Pneumonia' ? 'pneumonia' : 'normal'}`}>
                        {scanResult.prediction.toUpperCase()}
                      </div>
                      <span className="conclusion-desc">
                        {scanResult.prediction === 'Pneumonia' 
                          ? 'Warning: Radiographic density matching pneumonia patterns detected.' 
                          : 'Clear: Standard healthy lung aeration patterns observed.'}
                      </span>
                    </div>

                    <div className="probabilities-box">
                      <span className="conclusion-label" style={{ marginBottom: '12px', display: 'block' }}>Probability Distribution</span>
                      
                      {/* Normal bar */}
                      <div className="probability-bar-item">
                        <div className="prob-meta">
                          <span className="prob-name">Normal Lung Structure</span>
                          <span className="prob-percentage normal">{(scanResult.confidence_normal * 100).toFixed(1)}%</span>
                        </div>
                        <div className="prob-progress-bg">
                          <div 
                            className="prob-progress-fill normal" 
                            style={{ width: `${scanResult.confidence_normal * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Pneumonia bar */}
                      <div className="probability-bar-item">
                        <div className="prob-meta">
                          <span className="prob-name">Pneumonia Opacification</span>
                          <span className="prob-percentage pneumonia">{(scanResult.confidence_pneumonia * 100).toFixed(1)}%</span>
                        </div>
                        <div className="prob-progress-bg">
                          <div 
                            className="prob-progress-fill pneumonia" 
                            style={{ width: `${scanResult.confidence_pneumonia * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Image Split Slider Viewer */}
                  <div className="slider-view-section">
                    <div className="slider-view-title-bar">
                      <span className="slider-view-title">Grad-CAM Attentional Mapping</span>
                      <span className="slider-view-tip">Drag slider to adjust transparent blend overlay</span>
                    </div>

                    <div 
                      ref={containerRef}
                      onMouseMove={handleMouseMove}
                      onTouchMove={handleTouchMove}
                      onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onTouchStart={() => setIsDragging(true)}
                      className="comparison-slider-container"
                    >
                      {/* Base Image: Original */}
                      <img 
                        src={`http://localhost:5000${scanResult.original_image}`} 
                        alt="Original Chest X-Ray" 
                        className="comparison-image"
                        draggable="false"
                      />

                      {/* Heatmap Overlay (clipped via CSS clip-path) */}
                      <img 
                        src={`http://localhost:5000${scanResult.heatmap_image}`} 
                        alt="AI Heatmap" 
                        className="comparison-image"
                        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                        draggable="false"
                      />

                      {/* Slider handler handle */}
                      <div 
                        className="slider-handle" 
                        style={{ left: `${sliderPosition}%` }}
                      ></div>
                    </div>

                    <div className="slider-legend">
                      <span>Heatmap Focus Overlay</span>
                      <span>Original Radiograph</span>
                    </div>
                  </div>

                  {/* Clinical guidance box */}
                  <div className="guidance-box">
                    <FileText className="guidance-icon" size={16} />
                    <div>
                      <h4 className="guidance-title">Attentional Heatmap Interpretation</h4>
                      <p className="guidance-text">
                        The highlighted colors (red/orange hotspots) pinpoint regions of localized radiological density that influenced the CNN model weights. Assess whether these regions correspond to clinical consolidate symptoms (alveolar exudate) in the lower/mid lobes.
                      </p>
                    </div>
                  </div>

                </div>
              ) : (
                /* Empty State Card */
                <div className="empty-viewer-state">
                  <div className="empty-viewer-icon">
                    <Database size={24} />
                  </div>
                  <h3 className="empty-viewer-title">Awaiting Diagnostic Input</h3>
                  <p className="empty-viewer-desc">
                    Register a patient profile and upload a chest radiograph image on the left, then trigger the AI model to perform the diagnostic segmentation scan.
                  </p>
                  
                  {history.length > 0 && (
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="empty-viewer-action"
                    >
                      Browse registered logs archive <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}

            </div>

          </div>
        ) : (
          
          /* Logs/History Panel View */
          <div className="case-card">
            
            {/* Header filters row */}
            <div className="history-header-row">
              <div className="history-title-group">
                <h2>Patient Records Archive</h2>
                <p>Lookup, print, or remove historical diagnostic evaluations</p>
              </div>

              <div className="history-filters-bar">
                {/* Search */}
                <div className="search-input-wrapper">
                  <Search className="search-input-icon" />
                  <input 
                    type="text" 
                    placeholder="Search patient name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-text-input"
                  />
                </div>

                {/* Filter prediction */}
                <div className="filter-btn-group">
                  {['ALL', 'NORMAL', 'PNEUMONIA'].map((cls) => (
                    <button
                      key={cls}
                      onClick={() => setFilterClass(cls)}
                      className={`filter-btn ${filterClass === cls ? 'active' : ''}`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Patients History Table */}
            {isLoadingHistory ? (
              <div style={{ padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#9ca3af' }}>
                <RefreshCw size={24} className="spin-animation" style={{ animation: 'spin 1.5s linear infinite', color: '#06b6d4' }} />
                <span style={{ fontSize: '11px' }}>Querying case archives...</span>
              </div>
            ) : filteredHistory.length > 0 ? (
              <div className="table-scroll-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Patient Name</th>
                      <th>Evaluation Date</th>
                      <th>AI Diagnostic Result</th>
                      <th>Confidence Details</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => (
                      <tr key={item.id}>
                        <td className="td-name">{item.patient_name}</td>
                        <td>{item.created_at}</td>
                        <td>
                          <span className={`recent-log-tag ${item.prediction === 'Pneumonia' ? 'pneumonia' : 'normal'}`}>
                            {item.prediction}
                          </span>
                        </td>
                        <td className="td-confidence">
                          {item.prediction === 'Pneumonia' 
                            ? `Pneumonia: ${(item.confidence_pneumonia * 100).toFixed(1)}% | Normal: ${(item.confidence_normal * 100).toFixed(1)}%`
                            : `Normal: ${(item.confidence_normal * 100).toFixed(1)}% | Pneumonia: ${(item.confidence_pneumonia * 100).toFixed(1)}%`
                          }
                        </td>
                        <td>
                          <div className="actions-cell-wrapper">
                            <button
                              onClick={() => loadHistoricalRecord(item)}
                              className="action-btn-item view"
                              title="Load Scan Viewer"
                            >
                              <Eye size={12} />
                              View
                            </button>
                            <button
                              onClick={() => handlePrint(item)}
                              className="action-btn-item print"
                              title="Download Report"
                            >
                              <FileText size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteHistory(item.id)}
                              className="action-btn-item delete"
                              title="Delete Record"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Empty Table state */
              <div className="empty-table-state">
                <Database size={28} />
                <h3>No Archive Records</h3>
                <p>No historical scans match your current filter parameters.</p>
              </div>
            )}

          </div>
        )}
      </main>

      {/* CSS Spin Keyframe injected directly */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}

export default App;
