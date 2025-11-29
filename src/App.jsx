import React, { useState, useMemo, useEffect } from 'react'
import { 
  Search, 
  FileText, 
  Award, 
  Shield, 
  User, 
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
  Square,
  CheckSquare,
  Lock,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  Flag,
  MessageSquare,
  Info
} from 'lucide-react'
import { certificates, categories, getStats } from './data/certificates'

// Local storage keys - checkmarks, flags, and notes are saved locally
const STORAGE_KEY = 'seafarer-certificates-checked'
const FLAGS_KEY = 'seafarer-certificates-flags'
const NOTES_KEY = 'seafarer-certificates-notes'
const ACCESS_KEY = 'seafarer-certificates-access'
const ACCESS_PASSWORD = 'HelpingMyAgent'

// Certificates that need annual renewal (IAATO, AECO, Svalbard)
const ANNUAL_RENEWAL_CERTS = ['IAATO', 'AECO', 'Svalbard']

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

// Check if certificate needs annual renewal (IAATO, AECO, Svalbard)
const needsAnnualRenewal = (cert) => {
  return ANNUAL_RENEWAL_CERTS.some(name => cert.name.includes(name))
}

// Calculate dynamic status based on dates
const calculateStatus = (cert) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const expiryDate = cert.expiryDate
  const issuanceDate = cert.issuanceDate
  
  // Check if expired
  if (expiryDate) {
    const expiry = new Date(expiryDate)
    if (expiry < today) {
      return 'expired'
    }
    // Check if expiring within 6 months (approx 182 days)
    const sixMonthsFromNow = new Date(today)
    sixMonthsFromNow.setDate(sixMonthsFromNow.getDate() + 182)
    if (expiry <= sixMonthsFromNow) {
      return 'expiring'
    }
  }
  
  // For IAATO, AECO, Svalbard - check 1-year renewal from issuance
  if (needsAnnualRenewal(cert) && issuanceDate) {
    const issued = new Date(issuanceDate)
    const oneYearLater = new Date(issued)
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
    if (oneYearLater < today) {
      return 'renewal-suggested'
    }
    // Check if within 2 months of 1-year mark
    const twoMonthsFromNow = new Date(today)
    twoMonthsFromNow.setDate(twoMonthsFromNow.getDate() + 60)
    if (oneYearLater <= twoMonthsFromNow) {
      return 'renewal-suggested'
    }
  }
  
  // For STCW certs without expiry, check 5-year unofficial expiry
  if (cert.category === 'STCW' && !expiryDate && issuanceDate && !needsAnnualRenewal(cert)) {
    const issued = new Date(issuanceDate)
    const fiveYearsLater = new Date(issued)
    fiveYearsLater.setFullYear(fiveYearsLater.getFullYear() + 5)
    if (fiveYearsLater < today) {
      return 'renewal-suggested'
    }
    // Check if within 6 months of 5-year mark
    const sixMonthsFromNow = new Date(today)
    sixMonthsFromNow.setDate(sixMonthsFromNow.getDate() + 182)
    if (fiveYearsLater <= sixMonthsFromNow) {
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

// Load flags from localStorage
const loadFlags = () => {
  try {
    const saved = localStorage.getItem(FLAGS_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// Save flags to localStorage
const saveFlags = (flags) => {
  try {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flags))
  } catch (e) {
    console.error('Failed to save flags:', e)
  }
}

// Load notes from localStorage
const loadNotes = () => {
  try {
    const saved = localStorage.getItem(NOTES_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// Save notes to localStorage
const saveNotes = (notes) => {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  } catch (e) {
    console.error('Failed to save notes:', e)
  }
}

// Certificate data is read-only from source
// To make changes, update certificates.js directly and redeploy

// Category icons mapping
const categoryIcons = {
  'General': FileText,
  'CoC & Endorsements': Award,
  'STCW': Shield,
  'Non-STCW': Compass,
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


// Certificate detail modal - View Only with Flag and Note
const CertificateModal = ({ certificate, onClose, isFlagged, note, onToggleFlag, onUpdateNote }) => {
  const [localNote, setLocalNote] = useState(note || '')
  
  useEffect(() => {
    setLocalNote(note || '')
  }, [note, certificate])
  
  if (!certificate) return null
  
  const Icon = categoryIcons[certificate.category] || FileText
  const dynamicStatus = calculateStatus(certificate)
  
  const handleSaveNote = () => {
    onUpdateNote(certificate.id, localNote)
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-blue-100 text-blue-600">
                <Icon size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-base sm:text-xl font-bold text-gray-900">{certificate.name}</h2>
                <p className="text-sm text-gray-500">{certificate.issuer}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => onToggleFlag(certificate.id)}
                className={`p-2 rounded-lg transition-colors ${isFlagged ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:bg-gray-100'}`}
                title={isFlagged ? "Remove flag" : "Flag certificate"}
              >
                <Flag size={18} fill={isFlagged ? 'currentColor' : 'none'} />
              </button>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Certificate Number</label>
              <p className="font-medium text-gray-900 font-mono text-sm sm:text-base">
                {certificate.certNumber || <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Issuance Date</label>
                <p className="font-medium text-gray-900 text-sm sm:text-base">
                  {certificate.issuanceDate ? formatDate(certificate.issuanceDate) : <span className="text-gray-400 italic">Not set</span>}
                </p>
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">Expiry Date</label>
                <p className="font-medium text-gray-900 text-sm sm:text-base">
                  {certificate.expiryDate ? formatDate(certificate.expiryDate) : <span className="text-gray-400 italic">Not set</span>}
                </p>
              </div>
            </div>
          </div>
          
          {/* Note Section */}
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm text-gray-500 mb-2 flex items-center gap-1">
              <MessageSquare size={14} /> Personal Note (saved locally)
            </label>
            <textarea
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleSaveNote}
              placeholder="Add a personal note about this certificate..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              rows={2}
            />
          </div>
          
          <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className="font-medium text-gray-900 text-sm sm:text-base">{certificate.category}</p>
            </div>
            {certificate.subcategory && (
              <div>
                <p className="text-sm text-gray-500">Subcategory</p>
                <p className="font-medium text-gray-900 text-sm sm:text-base">{certificate.subcategory}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Holder</p>
              <p className="font-medium text-gray-900 text-sm sm:text-base">{certificate.holder}</p>
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
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [checkedCerts, setCheckedCerts] = useState(loadCheckedState)
  const [flaggedCerts, setFlaggedCerts] = useState(loadFlags)
  const [certNotes, setCertNotes] = useState(loadNotes)
  const [editingNote, setEditingNote] = useState(null)
  
  // Save to localStorage whenever state changes
  useEffect(() => {
    saveCheckedState(checkedCerts)
  }, [checkedCerts])
  
  useEffect(() => {
    saveFlags(flaggedCerts)
  }, [flaggedCerts])
  
  useEffect(() => {
    saveNotes(certNotes)
  }, [certNotes])
  
  // Get dynamic status for a certificate
  const getDynamicStatus = (cert) => {
    return calculateStatus(cert)
  }
  
  // All certificates from source (no local filtering)
  const activeCertificates = certificates
  
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
  }, [activeCertificates])
  
  // Filter certificates - must be before conditional return
  const filteredCertificates = useMemo(() => {
    return activeCertificates.filter(cert => {
      const dynamicStatus = getDynamicStatus(cert)
      
      const matchesSearch = searchQuery === '' || 
        cert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cert.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cert.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cert.subcategory && cert.subcategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (cert.certNumber && cert.certNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesCategory = selectedCategory === '' || cert.category === selectedCategory
      const matchesStatus = selectedStatus === '' || dynamicStatus === selectedStatus
      
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [searchQuery, selectedCategory, selectedStatus, activeCertificates])
  
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
  
  // Toggle checkbox
  const toggleChecked = (certId) => {
    setCheckedCerts(prev => ({
      ...prev,
      [certId]: !prev[certId]
    }))
  }
  
  // Toggle flag
  const toggleFlag = (certId) => {
    setFlaggedCerts(prev => ({
      ...prev,
      [certId]: !prev[certId]
    }))
  }
  
  // Update note
  const updateNote = (certId, note) => {
    setCertNotes(prev => ({
      ...prev,
      [certId]: note
    }))
  }
  
  // Count checked and flagged certificates
  const checkedCount = Object.values(checkedCerts).filter(Boolean).length
  const flaggedCount = Object.values(flaggedCerts).filter(Boolean).length
  
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('')
    setSelectedStatus('')
  }
  
  // Download CSV function
  const downloadCSV = () => {
    const headers = ['Category', 'Certificate Name', 'Certificate Number', 'Issuer', 'Issue Date', 'Expiry Date', 'Status', 'Checked']
    
    const rows = activeCertificates.map(cert => {
      const dynamicStatus = getDynamicStatus(cert)
      
      // Calculate 5-year expiry for STCW certs without expiry
      let displayExpiry = cert.expiryDate
      if (cert.category === 'STCW' && !cert.expiryDate && cert.issuanceDate) {
        const issued = new Date(cert.issuanceDate)
        const fiveYearsLater = new Date(issued)
        fiveYearsLater.setFullYear(fiveYearsLater.getFullYear() + 5)
        displayExpiry = fiveYearsLater.toISOString().split('T')[0] + ' (5yr unofficial)'
      }
      
      return [
        cert.category,
        cert.name,
        cert.certNumber || '',
        cert.issuer,
        cert.issuanceDate ? formatDate(cert.issuanceDate) : '',
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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg">
                <Ship size={20} className="text-white sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-gray-900">Seafarer Certificates</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Pavlos Angelos Filippakis</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-500">
                <span className="font-medium text-emerald-600">{checkedCount}</span>/{activeCertificates.length}
                {flaggedCount > 0 && <span className="ml-1 text-orange-500">🚩{flaggedCount}</span>}
              </span>
              <button
                onClick={downloadCSV}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Download CSV"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Local Storage Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-blue-700">
            <strong>Note:</strong> Checkmarks, flags, and notes are saved locally in your browser. 
            They will disappear if you change browser or clear cookies.
          </p>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-8">
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
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200 shadow-sm">
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-10 sm:w-16">
                      ✓
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-10 sm:w-16">
                      🚩
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Certificate
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24 sm:w-32 hidden md:table-cell">
                      Cert #
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24 sm:w-32 hidden lg:table-cell">
                      Issued
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24 sm:w-32 hidden sm:table-cell">
                      Expires
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20 sm:w-28">
                      Status
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-10 sm:w-16">
                      
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
                          <td colSpan={8} className="px-2 sm:px-4 py-2">
                            <div className="flex items-center gap-2">
                              <CategoryIcon size={16} className="text-slate-500" />
                              <span className="font-semibold text-slate-700 text-sm">{category}</span>
                              <span className="text-xs text-slate-500">({certs.length})</span>
                            </div>
                          </td>
                        </tr>
                        {/* Certificate Rows */}
                        {certs.map(cert => {
                          const isChecked = checkedCerts[cert.id] || false
                          const isFlagged = flaggedCerts[cert.id] || false
                          const note = certNotes[cert.id] || ''
                          const dynamicStatus = getDynamicStatus(cert)
                          
                          // Calculate expiry display
                          let displayExpiry = cert.expiryDate
                          let isUnofficialExpiry = false
                          let expiryNote = ''
                          
                          // For annual renewal certs (IAATO, AECO, Svalbard)
                          if (needsAnnualRenewal(cert) && cert.issuanceDate) {
                            const issued = new Date(cert.issuanceDate)
                            const oneYearLater = new Date(issued)
                            oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
                            displayExpiry = oneYearLater.toISOString().split('T')[0]
                            isUnofficialExpiry = true
                            expiryNote = '1yr'
                          }
                          // For STCW certs without expiry
                          else if (cert.category === 'STCW' && !cert.expiryDate && cert.issuanceDate) {
                            const issued = new Date(cert.issuanceDate)
                            const fiveYearsLater = new Date(issued)
                            fiveYearsLater.setFullYear(fiveYearsLater.getFullYear() + 5)
                            displayExpiry = fiveYearsLater.toISOString().split('T')[0]
                            isUnofficialExpiry = true
                            expiryNote = '5yr'
                          }
                          
                          return (
                            <tr 
                              key={cert.id} 
                              className={`hover:bg-gray-50 transition-colors ${isChecked ? 'bg-emerald-50/50' : ''} ${isFlagged ? 'bg-orange-50/50' : ''}`}
                            >
                              <td className="px-2 sm:px-4 py-2 sm:py-3">
                                <button
                                  onClick={() => toggleChecked(cert.id)}
                                  className={`p-1 rounded transition-colors ${
                                    isChecked 
                                      ? 'text-emerald-600 hover:text-emerald-700' 
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                >
                                  {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                                </button>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3">
                                <button
                                  onClick={() => toggleFlag(cert.id)}
                                  className={`p-1 rounded transition-colors ${
                                    isFlagged 
                                      ? 'text-orange-500 hover:text-orange-600' 
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                >
                                  <Flag size={18} fill={isFlagged ? 'currentColor' : 'none'} />
                                </button>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3">
                                <div>
                                  <p className="font-medium text-gray-900 text-xs sm:text-sm">{cert.name}</p>
                                  {cert.subcategory && (
                                    <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{cert.subcategory}</p>
                                  )}
                                  {note && (
                                    <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                                      <MessageSquare size={10} /> {note.length > 30 ? note.substring(0, 30) + '...' : note}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                                <span className="text-xs sm:text-sm text-gray-600 font-mono">
                                  {cert.certNumber || '—'}
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">
                                <span className="text-xs sm:text-sm text-gray-600">
                                  {formatDate(cert.issuanceDate)}
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
                                <span className={`text-xs sm:text-sm ${
                                  dynamicStatus === 'expired' ? 'text-red-600 font-medium' :
                                  dynamicStatus === 'expiring' ? 'text-amber-600 font-medium' :
                                  isUnofficialExpiry ? 'text-fuchsia-600 font-medium italic' :
                                  'text-gray-600'
                                }`}>
                                  {displayExpiry ? formatDate(displayExpiry) : '—'}
                                  {isUnofficialExpiry && <span className="text-xs ml-1">({expiryNote})</span>}
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3">
                                <StatusBadge status={dynamicStatus} />
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3">
                                <button
                                  onClick={() => setSelectedCertificate(cert)}
                                  className="p-1 sm:p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
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

      {/* Certificate Modal - View Only */}
      <CertificateModal 
        certificate={selectedCertificate} 
        onClose={() => setSelectedCertificate(null)}
        isFlagged={selectedCertificate ? flaggedCerts[selectedCertificate.id] : false}
        note={selectedCertificate ? certNotes[selectedCertificate.id] : ''}
        onToggleFlag={toggleFlag}
        onUpdateNote={updateNote}
      />
    </div>
  )
}

export default App
