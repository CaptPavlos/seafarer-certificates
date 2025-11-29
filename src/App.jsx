import React, { useState, useMemo, useEffect } from 'react'
import { 
  Search, 
  FileText, 
  Award, 
  Shield, 
  User, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  ChevronDown,
  X,
  ExternalLink,
  Ship,
  Compass,
  BookOpen,
  Check,
  Square,
  CheckSquare,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  Edit3,
  Save,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { certificates, categories, getStats } from './data/certificates'

// Local storage keys
const STORAGE_KEY = 'seafarer-certificates-checked'
const AUTH_KEY = 'seafarer-certificates-auth'
const CERT_DATA_KEY = 'seafarer-certificates-data'
const DELETED_KEY = 'seafarer-certificates-deleted'
const ACCESS_KEY = 'seafarer-certificates-access'
const PASSWORD = 'Marsoft'
const ACCESS_PASSWORD = 'HelpingMyAgent'

// Check if user has access (viewed disclaimer)
const hasAccess = () => {
  try {
    return localStorage.getItem(ACCESS_KEY) === 'true'
  } catch {
    return false
  }
}

// Set access state
const setAccess = (value) => {
  try {
    if (value) {
      localStorage.setItem(ACCESS_KEY, 'true')
    } else {
      localStorage.removeItem(ACCESS_KEY)
    }
  } catch (e) {
    console.error('Failed to save access state:', e)
  }
}

// Load deleted certificates from localStorage
const loadDeletedCerts = () => {
  try {
    const saved = localStorage.getItem(DELETED_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

// Save deleted certificates to localStorage
const saveDeletedCerts = (deleted) => {
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(deleted))
  } catch (e) {
    console.error('Failed to save deleted certs:', e)
  }
}

// Calculate dynamic status based on dates
const calculateStatus = (cert, overrides = {}) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const expiryDate = overrides.expiryDate ?? cert.expiryDate
  const issuanceDate = overrides.issuanceDate ?? cert.issuanceDate
  
  // Check if expired
  if (expiryDate) {
    const expiry = new Date(expiryDate)
    if (expiry < today) {
      return 'expired'
    }
    // Check if expiring within 90 days
    const ninetyDaysFromNow = new Date(today)
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
    if (expiry <= ninetyDaysFromNow) {
      return 'expiring'
    }
  }
  
  // For STCW certs without expiry, check 5-year unofficial expiry
  if (cert.category === 'STCW' && !expiryDate && issuanceDate) {
    const issued = new Date(issuanceDate)
    const fiveYearsLater = new Date(issued)
    fiveYearsLater.setFullYear(fiveYearsLater.getFullYear() + 5)
    if (fiveYearsLater < today) {
      return 'renewal-suggested'
    }
    // Check if within 90 days of 5-year mark
    const ninetyDaysFromNow = new Date(today)
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
    if (fiveYearsLater <= ninetyDaysFromNow) {
      return 'renewal-suggested'
    }
  }
  
  return 'valid'
}

// Load checked state from localStorage
const loadCheckedState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// Save checked state to localStorage
const saveCheckedState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

// Load certificate data overrides from localStorage
const loadCertDataOverrides = () => {
  try {
    const saved = localStorage.getItem(CERT_DATA_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// Save certificate data overrides to localStorage
const saveCertDataOverrides = (data) => {
  try {
    localStorage.setItem(CERT_DATA_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save cert data:', e)
  }
}

// Check if user is authenticated for editing
// Edit mode is session-based only - does not persist across page reloads
const isAuthenticated = () => {
  return false // Always start locked - user must enter password each session
}

// Set authentication state
const setAuthenticated = (value) => {
  try {
    if (value) {
      localStorage.setItem(AUTH_KEY, 'true')
    } else {
      localStorage.removeItem(AUTH_KEY)
    }
  } catch (e) {
    console.error('Failed to save auth state:', e)
  }
}

// Category icons mapping
const categoryIcons = {
  'CoC & Endorsements': Award,
  'STCW': Shield,
  'Non-STCW': Compass,
  'Medical': FileText,
  'Identity Documents': User
}

// Status badge component
const StatusBadge = ({ status }) => {
  const config = {
    valid: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle, label: 'Valid' },
    expiring: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Expiring Soon' },
    expired: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle, label: 'Expired' },
    'renewal-suggested': { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', icon: RefreshCw, label: 'Consider Renewal' }
  }
  
  const { bg, text, icon: Icon, label } = config[status] || config.valid
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}

// Stats card component
const StatsCard = ({ icon: Icon, label, value, color }) => (
  <div className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow`}>
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  </div>
)

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Access Gate Component - Cover page with disclaimer
const AccessGate = ({ onGrantAccess }) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (password === ACCESS_PASSWORD) {
      setAccess(true)
      onGrantAccess()
    } else {
      setError('Incorrect access code')
      setPassword('')
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
            <Shield size={40} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Confidential Information</h1>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 mb-2">Privacy Notice</h3>
              <p className="text-red-700 text-sm leading-relaxed">
                The data contained in this application is <strong>highly personal and confidential</strong>. 
                It includes sensitive information about professional certifications, identity documents, 
                and personal records.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Lock size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 mb-2">Restricted Access</h3>
              <p className="text-amber-700 text-sm leading-relaxed">
                <strong>Dissemination, copying, or sharing</strong> of this information without 
                explicit written permission from the data owner is <strong>strictly prohibited</strong> 
                and may be subject to legal action.
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-gray-600 text-sm text-center mb-6">
          By entering the access code, you acknowledge that you have been authorized to view this data 
          and agree to maintain its confidentiality.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Code
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900"
                placeholder="Enter access code"
                autoFocus
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            I Understand - Grant Access
          </button>
        </form>
        
        <p className="text-center text-xs text-gray-400 mt-6">
          Pavlos Angelos Filippakis - Personal Certificate Records
        </p>
      </div>
    </div>
  )
}

// Password Gate Component
const PasswordGate = ({ onAuthenticate }) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (password === PASSWORD) {
      onAuthenticate()
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }
  
  return (
    <div className="p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-4">
          <Lock size={28} className="text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Enter Edit Mode</h2>
        <p className="text-gray-500 mt-1 text-sm">Enter password to edit certificate data</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900"
              placeholder="Enter password"
              autoFocus
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>
        
        <button
          type="submit"
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Unlock Edit Mode
        </button>
      </form>
    </div>
  )
}

// Certificate detail modal with editing
const CertificateModal = ({ certificate, onClose, certDataOverrides, onSaveCertData, onDeleteCert, isEditMode, onRequestEdit }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    certNumber: '',
    issuanceDate: '',
    expiryDate: ''
  })
  
  // Handle edit button click - requires authentication
  const handleEditClick = () => {
    if (isEditMode) {
      setIsEditing(true)
    } else {
      onRequestEdit()
    }
  }
  
  // Get merged data (original + overrides)
  const getMergedData = () => {
    if (!certificate) return null
    const overrides = certDataOverrides[certificate.id] || {}
    return {
      ...certificate,
      name: overrides.name ?? certificate.name,
      certNumber: overrides.certNumber ?? certificate.certNumber,
      issuanceDate: overrides.issuanceDate ?? certificate.issuanceDate,
      expiryDate: overrides.expiryDate ?? certificate.expiryDate
    }
  }
  
  const mergedCert = getMergedData()
  
  // Calculate dynamic status
  const dynamicStatus = certificate ? calculateStatus(certificate, certDataOverrides[certificate.id] || {}) : 'valid'
  
  // Initialize edit form when opening
  useEffect(() => {
    if (certificate && isEditing) {
      const overrides = certDataOverrides[certificate.id] || {}
      setEditData({
        name: overrides.name ?? certificate.name ?? '',
        certNumber: overrides.certNumber ?? certificate.certNumber ?? '',
        issuanceDate: overrides.issuanceDate ?? certificate.issuanceDate ?? '',
        expiryDate: overrides.expiryDate ?? certificate.expiryDate ?? ''
      })
    }
  }, [certificate, isEditing, certDataOverrides])
  
  const handleSave = () => {
    onSaveCertData(certificate.id, {
      name: editData.name !== certificate.name ? editData.name : undefined,
      certNumber: editData.certNumber || undefined,
      issuanceDate: editData.issuanceDate || undefined,
      expiryDate: editData.expiryDate || undefined
    })
    setIsEditing(false)
  }
  
  const handleDelete = () => {
    onDeleteCert(certificate.id)
    onClose()
  }
  
  if (!certificate || !mergedCert) return null
  
  const Icon = categoryIcons[certificate.category] || FileText
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                <Icon size={24} />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                    className="text-xl font-bold text-gray-900 w-full px-2 py-1 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                ) : (
                  <h2 className="text-xl font-bold text-gray-900">{mergedCert.name}</h2>
                )}
                <p className="text-gray-500">{certificate.issuer}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  <button 
                    onClick={handleEditClick}
                    className={`p-2 rounded-lg transition-colors ${isEditMode ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`}
                    title={isEditMode ? "Edit certificate data" : "Login to edit"}
                  >
                    {isEditMode ? <Edit3 size={20} /> : <Lock size={20} />}
                  </button>
                  {isEditMode && (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                      title="Delete certificate"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </>
              ) : (
                <button 
                  onClick={handleSave}
                  className="p-2 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600"
                  title="Save changes"
                >
                  <Save size={20} />
                </button>
              )}
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <p className="text-red-700 font-medium mb-3">Are you sure you want to delete this certificate?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
        
        <div className="p-6 space-y-4">
          {/* Editable Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Certificate Number</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.certNumber}
                  onChange={(e) => setEditData({...editData, certNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-gray-900"
                  placeholder="Enter certificate number"
                />
              ) : (
                <p className="font-medium text-gray-900 font-mono">
                  {mergedCert.certNumber || <span className="text-gray-400 italic">Not set</span>}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Issuance Date</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={editData.issuanceDate}
                    onChange={(e) => setEditData({...editData, issuanceDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-gray-900"
                  />
                ) : (
                  <p className="font-medium text-gray-900">
                    {mergedCert.issuanceDate ? formatDate(mergedCert.issuanceDate) : <span className="text-gray-400 italic">Not set</span>}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">Expiry Date</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={editData.expiryDate}
                    onChange={(e) => setEditData({...editData, expiryDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-gray-900"
                  />
                ) : (
                  <p className="font-medium text-gray-900">
                    {mergedCert.expiryDate ? formatDate(mergedCert.expiryDate) : <span className="text-gray-400 italic">Not set</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Non-editable info */}
          <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className="font-medium text-gray-900">{certificate.category}</p>
            </div>
            {certificate.subcategory && (
              <div>
                <p className="text-sm text-gray-500">Subcategory</p>
                <p className="font-medium text-gray-900">{certificate.subcategory}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Holder</p>
              <p className="font-medium text-gray-900">{certificate.holder}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <StatusBadge status={dynamicStatus} />
              {dynamicStatus === 'renewal-suggested' && (
                <p className="text-xs text-fuchsia-600 mt-1">5-year unofficial expiry reached</p>
              )}
            </div>
          </div>
          
        </div>
        
        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          {isEditing ? (
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Filter dropdown component
const FilterDropdown = ({ label, options, value, onChange, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          value ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
        }`}
      >
        {Icon && <Icon size={16} />}
        <span className="text-sm font-medium">{value || label}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] z-20">
            <button
              onClick={() => { onChange(''); setIsOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-500"
            >
              All {label}s
            </button>
            {options.map(option => (
              <button
                key={option}
                onClick={() => { onChange(option); setIsOpen(false) }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                  value === option ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function App() {
  const [hasUserAccess, setHasUserAccess] = useState(hasAccess)
  const [isEditMode, setIsEditMode] = useState(isAuthenticated)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [checkedCerts, setCheckedCerts] = useState(loadCheckedState)
  const [certDataOverrides, setCertDataOverrides] = useState(loadCertDataOverrides)
  const [deletedCerts, setDeletedCerts] = useState(loadDeletedCerts)
  
  // Save to localStorage whenever checked state changes
  useEffect(() => {
    saveCheckedState(checkedCerts)
  }, [checkedCerts])
  
  // Save certificate data overrides to localStorage
  useEffect(() => {
    saveCertDataOverrides(certDataOverrides)
  }, [certDataOverrides])
  
  // Save deleted certs to localStorage
  useEffect(() => {
    saveDeletedCerts(deletedCerts)
  }, [deletedCerts])
  
  // Handle saving certificate data
  const handleSaveCertData = (certId, data) => {
    setCertDataOverrides(prev => ({
      ...prev,
      [certId]: { ...prev[certId], ...data }
    }))
  }
  
  // Handle deleting a certificate
  const handleDeleteCert = (certId) => {
    setDeletedCerts(prev => [...prev, certId])
  }
  
  // Get merged certificate data (original + overrides)
  const getMergedCertData = (cert) => {
    const overrides = certDataOverrides[cert.id] || {}
    return {
      ...cert,
      name: overrides.name ?? cert.name,
      certNumber: overrides.certNumber ?? cert.certNumber,
      issuanceDate: overrides.issuanceDate ?? cert.issuanceDate,
      expiryDate: overrides.expiryDate ?? cert.expiryDate
    }
  }
  
  // Get dynamic status for a certificate
  const getDynamicStatus = (cert) => {
    const overrides = certDataOverrides[cert.id] || {}
    return calculateStatus(cert, overrides)
  }
  
  // Active certificates (not deleted)
  const activeCertificates = useMemo(() => {
    return certificates.filter(cert => !deletedCerts.includes(cert.id))
  }, [deletedCerts])
  
  // Calculate stats dynamically
  const stats = useMemo(() => {
    const total = activeCertificates.length
    let valid = 0, expiring = 0, expired = 0, renewalSuggested = 0
    
    activeCertificates.forEach(cert => {
      const status = getDynamicStatus(cert)
      if (status === 'valid') valid++
      else if (status === 'expiring') expiring++
      else if (status === 'expired') expired++
      else if (status === 'renewal-suggested') renewalSuggested++
    })
    
    return { total, valid, expiring, expired, renewalSuggested }
  }, [activeCertificates, certDataOverrides])
  
  // Filter certificates - must be before conditional return
  const filteredCertificates = useMemo(() => {
    return activeCertificates.filter(cert => {
      const merged = getMergedCertData(cert)
      const dynamicStatus = getDynamicStatus(cert)
      
      const matchesSearch = searchQuery === '' || 
        merged.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cert.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cert.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cert.subcategory && cert.subcategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (merged.certNumber && merged.certNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesCategory = selectedCategory === '' || cert.category === selectedCategory
      const matchesStatus = selectedStatus === '' || dynamicStatus === selectedStatus
      
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [searchQuery, selectedCategory, selectedStatus, activeCertificates, certDataOverrides])
  
  // Group certificates by category - must be before conditional return
  const groupedCertificates = useMemo(() => {
    const groups = {}
    filteredCertificates.forEach(cert => {
      if (!groups[cert.category]) {
        groups[cert.category] = []
      }
      groups[cert.category].push(cert)
    })
    return groups
  }, [filteredCertificates])
  
  // Handle logout (exit edit mode)
  const handleLogout = () => {
    setAuthenticated(false)
    setIsEditMode(false)
  }
  
  // Handle login for edit mode
  const handleLogin = () => {
    setAuthenticated(true)
    setIsEditMode(true)
    setShowPasswordPrompt(false)
  }
  
  // Toggle checkbox
  const toggleChecked = (certId) => {
    setCheckedCerts(prev => ({
      ...prev,
      [certId]: !prev[certId]
    }))
  }
  
  // Count checked certificates
  const checkedCount = Object.values(checkedCerts).filter(Boolean).length
  
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('')
    setSelectedStatus('')
  }
  
  // Download CSV function
  const downloadCSV = () => {
    const headers = ['Category', 'Certificate Name', 'Certificate Number', 'Issuer', 'Issue Date', 'Expiry Date', 'Status', 'Checked']
    
    const rows = activeCertificates.map(cert => {
      const merged = getMergedCertData(cert)
      const dynamicStatus = getDynamicStatus(cert)
      
      // Calculate 5-year expiry for STCW certs without expiry
      let displayExpiry = merged.expiryDate
      if (cert.category === 'STCW' && !merged.expiryDate && merged.issuanceDate) {
        const issued = new Date(merged.issuanceDate)
        const fiveYearsLater = new Date(issued)
        fiveYearsLater.setFullYear(fiveYearsLater.getFullYear() + 5)
        displayExpiry = fiveYearsLater.toISOString().split('T')[0] + ' (5yr unofficial)'
      }
      
      return [
        cert.category,
        merged.name,
        merged.certNumber || '',
        cert.issuer,
        merged.issuanceDate ? formatDate(merged.issuanceDate) : '',
        displayExpiry ? formatDate(displayExpiry) : '',
        dynamicStatus === 'renewal-suggested' ? 'Consider Renewal' : dynamicStatus,
        checkedCerts[cert.id] ? 'Yes' : 'No'
      ]
    })
    
    // Sort by category
    rows.sort((a, b) => a[0].localeCompare(b[0]))
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `seafarer-certificates-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }
  
  const hasActiveFilters = searchQuery || selectedCategory || selectedStatus
  
  // Show access gate if user hasn't acknowledged disclaimer
  if (!hasUserAccess) {
    return <AccessGate onGrantAccess={() => setHasUserAccess(true)} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Ship size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Seafarer Certificates</h1>
                <p className="text-xs text-gray-500">Pavlos Angelos Filippakis</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                <span className="font-medium text-emerald-600">{checkedCount}</span> / {activeCertificates.length} checked
              </span>
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Download CSV"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export</span>
              </button>
              {isEditMode ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                  title="Exit edit mode"
                >
                  <Lock size={16} />
                  <span className="hidden sm:inline">Editing</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowPasswordPrompt(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Login to edit"
                >
                  <Lock size={16} />
                  <span className="hidden sm:inline">Edit Mode</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatsCard icon={BookOpen} label="Total Certificates" value={stats.total} color="bg-blue-500" />
          <StatsCard icon={CheckCircle} label="Valid" value={stats.valid} color="bg-emerald-500" />
          <StatsCard icon={Clock} label="Expiring Soon" value={stats.expiring} color="bg-amber-500" />
          <StatsCard icon={AlertTriangle} label="Expired" value={stats.expired} color="bg-red-500" />
          <StatsCard icon={RefreshCw} label="Consider Renewal" value={stats.renewalSuggested} color="bg-fuchsia-500" />
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search certificates by name, issuer, category, or cert number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder-gray-400"
              />
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterDropdown
                label="Category"
                options={categories}
                value={selectedCategory}
                onChange={setSelectedCategory}
                icon={Filter}
              />
              <FilterDropdown
                label="Status"
                options={['valid', 'expiring', 'expired', 'renewal-suggested']}
                value={selectedStatus}
                onChange={setSelectedStatus}
              />
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {/* Results count */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium text-gray-900">{filteredCertificates.length}</span> of {certificates.length} certificates
            </p>
          </div>
        </div>

        {/* Certificates Table */}
        {filteredCertificates.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                      Checked
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Certificate Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                      Cert Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                      Issuance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                      Expiration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(groupedCertificates).map(([category, certs]) => {
                    const CategoryIcon = categoryIcons[category] || FileText
                    return (
                      <React.Fragment key={category}>
                        {/* Category Header Row */}
                        <tr className="bg-slate-100">
                          <td colSpan={7} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <CategoryIcon size={16} className="text-slate-500" />
                              <span className="font-semibold text-slate-700">{category}</span>
                              <span className="text-xs text-slate-500">({certs.length})</span>
                            </div>
                          </td>
                        </tr>
                        {/* Certificate Rows */}
                        {certs.map(cert => {
                          const isChecked = checkedCerts[cert.id] || false
                          const mergedCert = getMergedCertData(cert)
                          const dynamicStatus = getDynamicStatus(cert)
                          
                          // Calculate 5-year expiry for STCW certs without expiry
                          let displayExpiry = mergedCert.expiryDate
                          let isUnofficialExpiry = false
                          if (cert.category === 'STCW' && !mergedCert.expiryDate && mergedCert.issuanceDate) {
                            const issued = new Date(mergedCert.issuanceDate)
                            const fiveYearsLater = new Date(issued)
                            fiveYearsLater.setFullYear(fiveYearsLater.getFullYear() + 5)
                            displayExpiry = fiveYearsLater.toISOString().split('T')[0]
                            isUnofficialExpiry = true
                          }
                          
                          return (
                            <tr 
                              key={cert.id} 
                              className={`hover:bg-gray-50 transition-colors ${isChecked ? 'bg-emerald-50/50' : ''}`}
                            >
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => toggleChecked(cert.id)}
                                  className={`p-1 rounded transition-colors ${
                                    isChecked 
                                      ? 'text-emerald-600 hover:text-emerald-700' 
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                >
                                  {isChecked ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900">{mergedCert.name}</p>
                                  {cert.subcategory && (
                                    <p className="text-xs text-gray-500 mt-0.5">{cert.subcategory}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-600 font-mono">
                                  {mergedCert.certNumber || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-600">
                                  {formatDate(mergedCert.issuanceDate)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-sm ${
                                  dynamicStatus === 'expired' ? 'text-red-600 font-medium' :
                                  dynamicStatus === 'expiring' ? 'text-amber-600 font-medium' :
                                  isUnofficialExpiry ? 'text-fuchsia-600 font-medium italic' :
                                  'text-gray-600'
                                }`}>
                                  {displayExpiry ? formatDate(displayExpiry) : '—'}
                                  {isUnofficialExpiry && <span className="text-xs ml-1">(5yr)</span>}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={dynamicStatus} />
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedCertificate(cert)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="View details"
                                >
                                  <ExternalLink size={16} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Search size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search or filter criteria</p>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>

      {/* Certificate Modal */}
      <CertificateModal 
        certificate={selectedCertificate} 
        onClose={() => setSelectedCertificate(null)}
        certDataOverrides={certDataOverrides}
        onSaveCertData={handleSaveCertData}
        onDeleteCert={handleDeleteCert}
        isEditMode={isEditMode}
        onRequestEdit={() => setShowPasswordPrompt(true)}
      />
      
      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowPasswordPrompt(false)}>
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <PasswordGate onAuthenticate={handleLogin} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
