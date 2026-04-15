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
    // Use the stored images for display
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
    // Create a printable iframe or print window dynamically to support clean printing
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
              // Optionally close the window after printing
              // window.close();
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
    <div className="min-h-screen pb-12">
      {/* Premium Header */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[#090d16b3] backdrop-blur-md sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white flex items-center gap-2">
                PneumoScan <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-semibold border border-cyan-500/30">AI CDSS</span>
              </span>
              <p className="text-[11px] text-[#9ca3af]">Clinical Decision Support System</p>
            </div>
          </div>
          
          <nav className="flex gap-1 bg-[#121824] p-1 rounded-lg border border-[rgba(255,255,255,0.05)]">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'dashboard' ? 'bg-[#06b6d4] text-[#080b11] shadow-lg shadow-cyan-500/15' : 'text-[#9ca3af] hover:text-white'}`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Analysis Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-[#06b6d4] text-[#080b11] shadow-lg shadow-cyan-500/15' : 'text-[#9ca3af] hover:text-white'}`}
            >
              <History className="w-3.5 h-3.5" />
              Patient Logs
              {history.length > 0 && (
                <span className="bg-[rgba(0,0,0,0.15)] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {history.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main View Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 no-print">
        
        {/* Clinical Disclaimer Bar */}
        <div className="mb-8 p-4 glass-card bg-amber-500/5 border-amber-500/20 flex items-start gap-3 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-500">Clinical Decision Support Tool Notice</h4>
            <p className="text-xs text-[#9ca3af] mt-1 leading-relaxed">
              This system is an AI decision-support utility trained to locate abnormalities on chest radiographs. It is designed to assist radiologists and physicians. It does not replace clinical evaluation or direct physical diagnostics, and must be validated by a licensed physician.
            </p>
          </div>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Side: Patient Form & Image Upload (5 Columns) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              <div className="glass-card p-6 flex flex-col gap-5">
                <div>
                  <h3 className="font-bold text-base text-white">Patient Information</h3>
                  <p className="text-xs text-[#9ca3af]">Enter details to register diagnostic case file</p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#9ca3af]">Patient Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full bg-[#0d121f] border border-[rgba(255,255,255,0.08)] focus:border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-[#4b5563] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#9ca3af]">Chest X-ray Image</label>
                  
                  {/* Dropzone Container */}
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border border-dashed border-[rgba(255,255,255,0.12)] hover:border-cyan-500/40 bg-[#0d121f66] hover:bg-[#0d121fcc] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-48 group relative overflow-hidden"
                  >
                    <input 
                      type="file" 
                      accept=".png, .jpg, .jpeg"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    
                    {previewUrl ? (
                      <div className="absolute inset-0 p-3 bg-[#0d121f] flex items-center justify-center">
                        <img 
                          src={previewUrl} 
                          alt="X-ray preview" 
                          className="max-w-full max-h-full object-contain rounded-lg border border-[rgba(255,255,255,0.05)]"
                        />
                        <div className="absolute bottom-4 left-1/2 -translate-y-0 -translate-x-1/2 bg-black/75 px-3 py-1.5 rounded-full text-[10px] text-cyan-400 font-semibold border border-cyan-500/25 flex items-center gap-1.5 backdrop-blur-sm shadow-lg">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Image Selected
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-[#121826] border border-[rgba(255,255,255,0.05)] flex items-center justify-center group-hover:scale-110 group-hover:border-cyan-500/30 transition-all duration-300">
                          <Upload className="w-5 h-5 text-[#9ca3af] group-hover:text-cyan-400 transition-all" />
                        </div>
                        <span className="font-bold text-xs text-white mt-3">Drag & drop radiograph image</span>
                        <p className="text-[10px] text-[#6b7280] mt-1.5">Supports PNG, JPG, JPEG up to 10MB</p>
                      </>
                    )}
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-red-300 leading-normal">{errorMessage}</span>
                  </div>
                )}

                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !selectedFile}
                  className={`w-full py-3 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
                    !selectedFile 
                      ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed shadow-none' 
                      : isAnalyzing 
                        ? 'bg-[#151c2c] border border-cyan-500/20 text-cyan-400 cursor-wait'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-cyan-500/10 hover:shadow-cyan-500/20 hover:scale-[1.01] cursor-pointer'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Chest X-ray...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" />
                      Run AI Diagnostic Scan
                    </>
                  )}
                </button>
              </div>

              {/* History quickview in Sidebar if history exists */}
              {history.length > 0 && (
                <div className="glass-card p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-white">Recent Records</span>
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="text-[10px] font-bold text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      View All <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {history.slice(0, 3).map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => loadHistoricalRecord(item)}
                        className="p-3 bg-[#0d121f66] hover:bg-[#0d121fcc] border border-[rgba(255,255,255,0.04)] hover:border-cyan-500/20 rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${item.prediction === 'Pneumonia' ? 'bg-rose-500 shadow-glow shadow-rose-500/50' : 'bg-emerald-500 shadow-glow shadow-emerald-500/50'}`}></div>
                          <div>
                            <span className="font-bold text-xs text-white block group-hover:text-cyan-400 transition-all">{item.patient_name}</span>
                            <span className="text-[10px] text-[#6b7280] block">{item.created_at.split(' ')[0]}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.prediction === 'Pneumonia' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            {item.prediction}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right Side: Scan Analysis Viewer & Results (7 Columns) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {scanResult ? (
                <div className="glass-card p-6 flex flex-col gap-6">
                  
                  {/* Results Header block */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[rgba(255,255,255,0.08)]">
                    <div>
                      <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">Diagnostic Analysis Results</span>
                      <h2 className="font-extrabold text-xl text-white mt-0.5">{scanResult.patient_name}</h2>
                      <span className="text-[10px] text-[#6b7280] block mt-0.5">Date evaluated: {scanResult.created_at}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handlePrint(scanResult)}
                        className="px-3.5 py-2 bg-[#121826] hover:bg-[#1a2235] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Download className="w-3.5 h-3.5 text-cyan-400" />
                        Download Report
                      </button>
                    </div>
                  </div>

                  {/* Prediction & Confidence Block */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
                    
                    {/* Diagnostic Badge (5 columns) */}
                    <div className={`sm:col-span-5 rounded-2xl p-5 flex flex-col justify-center items-center text-center border ${
                      scanResult.prediction === 'Pneumonia' 
                        ? 'bg-rose-500/5 border-rose-500/20' 
                        : 'bg-emerald-500/5 border-emerald-500/20'
                    }`}>
                      <span className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider">AI Conclusion</span>
                      <div className={`font-black text-2xl mt-1 ${scanResult.prediction === 'Pneumonia' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {scanResult.prediction.toUpperCase()}
                      </div>
                      <span className="text-[10px] text-[#6b7280] mt-1.5 max-w-44 leading-relaxed">
                        {scanResult.prediction === 'Pneumonia' 
                          ? 'Abnormal density found in lung region.' 
                          : 'Lungs appear clear with standard inflation.'}
                      </span>
                    </div>

                    {/* Confidence Bars (7 columns) */}
                    <div className="sm:col-span-7 bg-[#0d121f] rounded-2xl p-5 border border-[rgba(255,255,255,0.05)] flex flex-col justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider block mb-2">Class Probabilities</span>
                        
                        {/* Normal bar */}
                        <div className="flex flex-col gap-1 mb-2.5">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-white">Normal Lung</span>
                            <span className="text-emerald-400">{(scanResult.confidence_normal * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-[#1b2336] h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out" 
                              style={{ width: `${scanResult.confidence_normal * 100}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Pneumonia bar */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-white">Pneumonia Consolidation</span>
                            <span className="text-rose-400">{(scanResult.confidence_pneumonia * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-[#1b2336] h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-rose-500 h-full rounded-full transition-all duration-1000 ease-out" 
                              style={{ width: `${scanResult.confidence_pneumonia * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Interactive Slider comparison view */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-white">Grad-CAM Spatial Mapping</span>
                      <span className="text-[10px] text-[#9ca3af] italic">Slide image to overlay heatmaps</span>
                    </div>

                    <div 
                      ref={containerRef}
                      onMouseMove={handleMouseMove}
                      onTouchMove={handleTouchMove}
                      onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onTouchStart={() => setIsDragging(true)}
                      className="comparison-slider-container select-none"
                    >
                      {/* Base Image: Original */}
                      <img 
                        src={`http://localhost:5000${scanResult.original_image}`} 
                        alt="Original Chest X-Ray" 
                        className="comparison-image"
                        draggable="false"
                      />

                      {/* Heatmap overlay image (revealed by slider width) */}
                      <div 
                        className="absolute inset-0 overflow-hidden" 
                        style={{ width: `${sliderPosition}%` }}
                      >
                        <img 
                          src={`http://localhost:5000${scanResult.heatmap_image}`} 
                          alt="AI Heatmap" 
                          className="comparison-image"
                          style={{ width: containerRef.current?.getBoundingClientRect().width || '100%' }}
                          draggable="false"
                        />
                      </div>

                      {/* Sliding handle */}
                      <div 
                        className="slider-handle" 
                        style={{ left: `${sliderPosition}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-[#6b7280] px-1">
                      <span>Heatmap (AI Overlay)</span>
                      <span>Original Radiograph</span>
                    </div>
                  </div>

                  {/* Guidance disclaimer box */}
                  <div className="p-4 bg-[#121826] border border-[rgba(255,255,255,0.06)] rounded-xl flex items-start gap-3">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Interactive Interpretation</h4>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5 leading-relaxed">
                        The red and orange regions in the heatmap highlight where the CNN models focused its convolutional filters to output the prediction. If Pneumonia is detected, verify if the highlighted heat zones map to clinical consolidation in the lung lobes.
                      </p>
                    </div>
                  </div>

                </div>
              ) : (
                /* Empty State Card */
                <div className="glass-card p-12 flex flex-col items-center justify-center text-center min-h-[460px] border-dashed border-[rgba(255,255,255,0.08)]">
                  <div className="w-16 h-16 rounded-2xl bg-[#0f1524] border border-[rgba(255,255,255,0.05)] flex items-center justify-center mb-5 text-[#4b5563]">
                    <Database className="w-7 h-7" />
                  </div>
                  <h3 className="font-extrabold text-base text-white">Waiting for Radiograph Input</h3>
                  <p className="text-xs text-[#9ca3af] mt-1.5 max-w-sm leading-relaxed">
                    Upload a patient chest X-ray image on the left and run the AI scanner to generate predictions, calculate confidence margins, and produce the attention heatmaps.
                  </p>
                  
                  {history.length > 0 && (
                    <div className="mt-8 flex items-center gap-2">
                      <span className="text-xs text-[#6b7280]">Or load from archive:</span>
                      <button 
                        onClick={() => setActiveTab('history')}
                        className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        Browse patient logs <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>
        ) : (
          
          /* Logs/History Panel View */
          <div className="glass-card p-6 flex flex-col gap-6">
            
            {/* Search/Filter block */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[rgba(255,255,255,0.08)]">
              <div>
                <h2 className="font-extrabold text-lg text-white">Patient Record Archives</h2>
                <p className="text-xs text-[#9ca3af] mt-0.5">Manage and review previous diagnostic assessments</p>
              </div>

              {/* Filters list */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Search */}
                <div className="relative flex-1 md:flex-none">
                  <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Search patient name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-56 bg-[#0d121f] border border-[rgba(255,255,255,0.08)] focus:border-cyan-500/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-[#4b5563] outline-none transition-all"
                  />
                </div>

                {/* Filter prediction */}
                <div className="flex bg-[#0d121f] border border-[rgba(255,255,255,0.08)] p-0.5 rounded-xl">
                  {['ALL', 'NORMAL', 'PNEUMONIA'].map((cls) => (
                    <button
                      key={cls}
                      onClick={() => setFilterClass(cls)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        filterClass === cls 
                          ? 'bg-[#1e293b] text-white' 
                          : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Patients History Table */}
            {isLoadingHistory ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#9ca3af]">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs">Loading case archives...</span>
              </div>
            ) : filteredHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.06)] text-[10px] text-[#6b7280] font-bold uppercase tracking-wider">
                      <th className="py-4 px-4">Patient Name</th>
                      <th className="py-4 px-4">Evaluation Date</th>
                      <th className="py-4 px-4">AI Prediction</th>
                      <th className="py-4 px-4">Confidence Details</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => (
                      <tr 
                        key={item.id}
                        className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[#1118274d] text-xs transition-all"
                      >
                        <td className="py-4 px-4 font-bold text-white">{item.patient_name}</td>
                        <td className="py-4 px-4 text-[#9ca3af]">{item.created_at}</td>
                        <td className="py-4 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                            item.prediction === 'Pneumonia' 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.prediction === 'Pneumonia' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                            {item.prediction}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[#9ca3af] font-mono">
                          {item.prediction === 'Pneumonia' 
                            ? `Pneumonia: ${(item.confidence_pneumonia * 100).toFixed(1)}% | Normal: ${(item.confidence_normal * 100).toFixed(1)}%`
                            : `Normal: ${(item.confidence_normal * 100).toFixed(1)}% | Pneumonia: ${(item.confidence_pneumonia * 100).toFixed(1)}%`
                          }
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => loadHistoricalRecord(item)}
                              className="p-2 bg-[#121826] hover:bg-[#1d273d] text-cyan-400 hover:text-cyan-300 rounded-lg border border-[rgba(255,255,255,0.06)] cursor-pointer transition-all flex items-center gap-1"
                              title="View Scan & Heatmaps"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold pr-1">View</span>
                            </button>
                            <button
                              onClick={() => handlePrint(item)}
                              className="p-2 bg-[#121826] hover:bg-[#1d273d] text-white rounded-lg border border-[rgba(255,255,255,0.06)] cursor-pointer transition-all"
                              title="Download Report"
                            >
                              <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteHistory(item.id)}
                              className="p-2 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg border border-red-500/15 cursor-pointer transition-all"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
              <div className="py-20 flex flex-col items-center justify-center text-center text-[#9ca3af] gap-2">
                <Database className="w-10 h-10 text-[#4b5563]" />
                <span className="font-bold text-sm text-white">No records found</span>
                <p className="text-xs max-w-xs leading-relaxed">
                  Try adjusting your search criteria or return to the dashboard to upload a new radiograph case.
                </p>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

export default App;
