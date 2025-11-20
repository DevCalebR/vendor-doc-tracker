import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle, Bell, FileText, Users, Download, Plus, Search, Trash2, Edit, CheckCircle, Clock, XCircle, LogOut, Shield, Key, Mail } from 'lucide-react';

// Storage initialization
const initializeStorage = async () => {
  try {
    let existing = null;
    try {
      existing = await window.storage.get('app-initialized');
    } catch (error) {
      console.log('Storage not yet initialized, creating data...');
    }
    
    if (!existing) {
      await window.storage.set('organization', JSON.stringify({
        id: 'org-1', name: 'Acme Corporation', timezone: 'America/New_York',
        settings: { reminderDays: [30, 14, 7, 1], defaultChannel: 'email' }
      }));
      
      await window.storage.set('users', JSON.stringify([
        { id: 'u1', email: 'admin@acme.com', password: 'admin123', name: 'Admin User', role: 'admin', twoFactorEnabled: false },
        { id: 'u2', email: 'user@acme.com', password: 'user123', name: 'Regular User', role: 'user', twoFactorEnabled: false }
      ]));
      
      await window.storage.set('vendors', JSON.stringify([
        { id: 'v1', name: 'TechSupply Inc', type: 'software', contact: 'john@techsupply.com', status: 'active' },
        { id: 'v2', name: 'BuildCo Contractors', type: 'contractor', contact: 'mary@buildco.com', status: 'active' },
        { id: 'v3', name: 'Office Supplies Ltd', type: 'supplier', contact: 'sales@officesup.com', status: 'active' }
      ]));
      
      await window.storage.set('documents', JSON.stringify([
        { id: 'd1', vendorId: 'v1', title: 'Software License', type: 'license', issuedAt: '2024-01-15', expiresAt: '2025-12-15', status: 'active', uploadedBy: 'Admin' },
        { id: 'd2', vendorId: 'v2', title: 'Liability Insurance', type: 'insurance', issuedAt: '2024-06-01', expiresAt: '2025-11-25', status: 'active', uploadedBy: 'Admin' },
        { id: 'd3', vendorId: 'v2', title: 'W-9 Tax Form', type: 'w9', issuedAt: '2024-01-10', expiresAt: '2025-11-20', status: 'active', uploadedBy: 'Admin' },
        { id: 'd4', vendorId: 'v3', title: 'Certificate of Insurance', type: 'insurance', issuedAt: '2024-03-01', expiresAt: '2025-11-22', status: 'active', uploadedBy: 'Admin' }
      ]));
      
      await window.storage.set('reminders', JSON.stringify([]));
      await window.storage.set('audit-logs', JSON.stringify([]));
      await window.storage.set('app-initialized', 'true');
      
      console.log('Storage initialized successfully!');
    }
  } catch (error) {
    console.error('Storage initialization error:', error);
  }
};

// Utility functions
const getDaysUntilExpiration = (expiresAt) => {
  const today = new Date();
  const expiry = new Date(expiresAt);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
};

const getDocumentStatus = (expiresAt) => {
  const days = getDaysUntilExpiration(expiresAt);
  if (days < 0) return { status: 'expired', label: 'Expired', color: 'text-red-600 bg-red-100 border-red-200' };
  if (days <= 7) return { status: 'critical', label: 'Critical', color: 'text-orange-600 bg-orange-100 border-orange-200' };
  if (days <= 30) return { status: 'warning', label: 'Expiring Soon', color: 'text-yellow-600 bg-yellow-100 border-yellow-200' };
  return { status: 'active', label: 'Active', color: 'text-green-600 bg-green-100 border-green-200' };
};

// Reusable Badge Component
const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    danger: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200'
  };

  return (
    <span className={`inline-flex px-3 py-1.5 text-xs font-bold rounded-lg border-2 ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// Empty State Component
const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="p-12 text-center">
    <Icon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
    <p className="text-lg font-semibold text-gray-900">{title}</p>
    {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
  </div>
);

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, gradient }) => (
  <div className={`bg-gradient-to-br ${gradient} p-6 rounded-2xl shadow-lg text-white transform hover:scale-105 transition-transform`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white text-opacity-80 text-sm font-medium">{title}</p>
        <p className="text-4xl font-bold mt-2">{value}</p>
      </div>
      <Icon className="w-12 h-12 opacity-80" />
    </div>
  </div>
);

// Main Component
const VendorDocTracker = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [vendors, setVendors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [editingDocument, setEditingDocument] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      await initializeStorage();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      await initializeStorage();
      const [orgData, vendorData, docData, reminderData, auditData] = await Promise.all([
        window.storage.get('organization'),
        window.storage.get('vendors'),
        window.storage.get('documents'),
        window.storage.get('reminders'),
        window.storage.get('audit-logs')
      ]);
      
      if (orgData) setOrganization(JSON.parse(orgData.value));
      if (vendorData) setVendors(JSON.parse(vendorData.value));
      if (docData) setDocuments(JSON.parse(docData.value));
      if (reminderData) setReminders(JSON.parse(reminderData.value));
      if (auditData) setAuditLogs(JSON.parse(auditData.value));
    } catch (error) {
      console.error('Error loading:', error);
    }
    setLoading(false);
  };

  const saveData = useCallback(async (key, data, setter) => {
    try {
      await window.storage.set(key, JSON.stringify(data));
      setter(data);
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  }, []);

  const addAuditLog = useCallback(async (action, resourceType, resourceId, metadata = {}) => {
    const log = {
      id: `log-${Date.now()}`,
      action,
      resourceType,
      resourceId,
      metadata,
      timestamp: new Date().toISOString(),
      user: currentUser?.name || 'System'
    };
    const newLogs = [...auditLogs, log];
    await saveData('audit-logs', newLogs, setAuditLogs);
  }, [auditLogs, currentUser, saveData]);

  // Memoized computed values
  const stats = useMemo(() => ({
    totalVendors: vendors.length,
    totalDocuments: documents.length,
    expiringSoon: documents.filter(d => {
      const days = getDaysUntilExpiration(d.expiresAt);
      return days >= 0 && days <= 30;
    }).length,
    expired: documents.filter(d => getDaysUntilExpiration(d.expiresAt) < 0).length
  }), [vendors, documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const vendor = vendors.find(v => v.id === doc.vendorId);
      const matchesSearch = searchQuery === '' || 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor?.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (statusFilter === 'all') return matchesSearch;
      const docStatus = getDocumentStatus(doc.expiresAt).status;
      return matchesSearch && docStatus === statusFilter;
    });
  }, [documents, vendors, searchQuery, statusFilter]);

  const criticalDocuments = useMemo(() => {
    return documents
      .filter(d => getDaysUntilExpiration(d.expiresAt) <= 30)
      .sort((a, b) => getDaysUntilExpiration(a.expiresAt) - getDaysUntilExpiration(b.expiresAt))
      .slice(0, 10)
      .map(doc => ({
        ...doc,
        vendor: vendors.find(v => v.id === doc.vendorId),
        days: getDaysUntilExpiration(doc.expiresAt),
        status: getDocumentStatus(doc.expiresAt)
      }));
  }, [documents, vendors]);

  // Handlers
  const handleLogin = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    try {
      console.log('Attempting login...');
      
      let usersData = null;
      try {
        usersData = await window.storage.get('users');
      } catch (error) {
        console.log('Users data not found, initializing...');
        await initializeStorage();
        usersData = await window.storage.get('users');
      }
      
      console.log('Users data retrieved');
      
      if (!usersData || !usersData.value) {
        setError('System error: User data not available');
        return;
      }
      
      const users = JSON.parse(usersData.value);
      console.log('Found', users.length, 'users');
      
      const user = users.find(u => u.email === email && u.password === password);
      
      if (!user) {
        setError('Invalid email or password');
        return;
      }

      console.log('Login successful!');
      setCurrentUser(user);
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed: ' + error.message);
    }
  };

  const handleLogout = () => {
    addAuditLog('logout', 'user', currentUser.id, { email: currentUser.email });
    setCurrentUser(null);
  };

  const handleVendorSave = async (vendor) => {
    if (editingVendor) {
      const updated = vendors.map(v => v.id === vendor.id ? vendor : v);
      await saveData('vendors', updated, setVendors);
      await addAuditLog('update', 'vendor', vendor.id, { name: vendor.name });
    } else {
      const newVendor = { ...vendor, id: `v${Date.now()}`, status: 'active' };
      await saveData('vendors', [...vendors, newVendor], setVendors);
      await addAuditLog('create', 'vendor', newVendor.id, { name: newVendor.name });
    }
    setShowVendorModal(false);
    setEditingVendor(null);
  };

  const handleDocumentSave = async (document) => {
    if (editingDocument) {
      const updated = documents.map(d => d.id === document.id ? document : d);
      await saveData('documents', updated, setDocuments);
      await addAuditLog('update', 'document', document.id, { title: document.title });
    } else {
      const newDoc = {
        ...document,
        id: `d${Date.now()}`,
        status: 'active',
        uploadedBy: currentUser?.name || 'System',
        uploadedAt: new Date().toISOString()
      };
      await saveData('documents', [...documents, newDoc], setDocuments);
      await addAuditLog('upload', 'document', newDoc.id, { title: newDoc.title });
      
      if (organization?.settings?.reminderDays) {
        const newReminders = organization.settings.reminderDays.map(days => {
          const remindDate = new Date(newDoc.expiresAt);
          remindDate.setDate(remindDate.getDate() - days);
          return {
            id: `r${Date.now()}-${days}`,
            documentId: newDoc.id,
            remindAt: remindDate.toISOString(),
            channel: organization.settings.defaultChannel,
            status: 'scheduled',
            message: `Document "${newDoc.title}" expires in ${days} days`
          };
        });
        await saveData('reminders', [...reminders, ...newReminders], setReminders);
      }
    }
    setShowDocModal(false);
    setEditingDocument(null);
    setSelectedVendor('');
  };

  const handleReminderSave = async (reminderData) => {
    const doc = documents.find(d => d.id === reminderData.documentId);
    const newReminder = {
      id: `r${Date.now()}`,
      ...reminderData,
      remindAt: new Date(reminderData.remindAt).toISOString(),
      status: 'scheduled',
      message: reminderData.message || `Custom reminder for document "${doc?.title}"`
    };
    await saveData('reminders', [...reminders, newReminder], setReminders);
    await addAuditLog('create', 'reminder', newReminder.id, { documentId: reminderData.documentId });
    setShowReminderModal(false);
  };

  const handleDeleteVendor = async (vendorId) => {
    if (confirm('Delete this vendor and all documents?')) {
      const updated = vendors.filter(v => v.id !== vendorId);
      const updatedDocs = documents.filter(d => d.vendorId !== vendorId);
      await saveData('vendors', updated, setVendors);
      await saveData('documents', updatedDocs, setDocuments);
      await addAuditLog('delete', 'vendor', vendorId);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (confirm('Delete this document?')) {
      const updated = documents.filter(d => d.id !== docId);
      await saveData('documents', updated, setDocuments);
      await addAuditLog('delete', 'document', docId);
    }
  };

  const handleExportCSV = () => {
    const data = documents.map(doc => {
      const vendor = vendors.find(v => v.id === doc.vendorId);
      const days = getDaysUntilExpiration(doc.expiresAt);
      return {
        Vendor: vendor?.name || 'Unknown',
        Document: doc.title,
        Type: doc.type,
        'Issued Date': doc.issuedAt,
        'Expiration Date': doc.expiresAt,
        'Days Until Expiry': days,
        Status: getDocumentStatus(doc.expiresAt).label
      };
    });

    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-documents-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    addAuditLog('export', 'documents', 'all', { format: 'csv', count: data.length });
  };

  // Login Screen
  if (!currentUser) {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-gray-700 font-medium">Initializing...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white rounded-t-2xl">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <Shield className="w-10 h-10" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center">Vendor Document Tracker</h1>
            <p className="text-blue-100 text-center mt-2">Secure Login Portal</p>
          </div>

          <div className="p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@company.com" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Key className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••" />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button onClick={handleLogin}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg">
                Sign In
              </button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800 font-semibold mb-2">Demo Credentials:</p>
                <p className="text-xs text-blue-700">Admin: admin@acme.com / admin123</p>
                <p className="text-xs text-blue-700">User: user@acme.com / user123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Vendor Document Tracker
                </h1>
                <p className="text-sm text-gray-600">{organization?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-4">
                <p className="text-sm font-semibold text-gray-900">{currentUser.name}</p>
                <p className="text-xs text-gray-600 capitalize flex items-center gap-1">
                  {currentUser.role === 'admin' && <Shield className="w-3 h-3" />}
                  {currentUser.role}
                </p>
              </div>
              <button onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                <Download className="w-4 h-4" />Export
              </button>
              <button onClick={() => setShowDocModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-medium shadow-md">
                <Plus className="w-4 h-4" />Add Document
              </button>
              <button onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-100 font-medium">
                <LogOut className="w-4 h-4" />Logout
              </button>
            </div>
          </div>
        </div>
        
        <nav className="px-6 flex gap-6 border-t border-gray-200">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: FileText },
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'vendors', label: 'Vendors', icon: Users },
            { id: 'reminders', label: 'Reminders', icon: Bell },
            { id: 'audit', label: 'Audit Log', icon: Clock }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-4 gap-6 mb-8">
              <StatCard title="Total Vendors" value={stats.totalVendors} icon={Users} gradient="from-blue-500 to-cyan-500" />
              <StatCard title="Total Documents" value={stats.totalDocuments} icon={FileText} gradient="from-indigo-500 to-purple-500" />
              <StatCard title="Expiring Soon" value={stats.expiringSoon} icon={AlertCircle} gradient="from-yellow-500 to-orange-500" />
              <StatCard title="Expired" value={stats.expired} icon={XCircle} gradient="from-red-500 to-pink-500" />
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold text-white">Documents Requiring Attention</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {criticalDocuments.length > 0 ? (
                  criticalDocuments.map(doc => (
                    <div key={doc.id} className="p-5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl border-2 ${doc.status.color}`}>
                          {doc.days < 0 ? <XCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{doc.title}</p>
                          <p className="text-sm text-gray-600">{doc.vendor?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">
                            {doc.days < 0 ? `${Math.abs(doc.days)} days overdue` : `${doc.days} days left`}
                          </p>
                          <p className="text-sm text-gray-600">{doc.expiresAt}</p>
                        </div>
                        <Badge className={doc.status.color}>{doc.status.label}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={CheckCircle} title="All documents are in good standing!" description="No documents require immediate attention" />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="p-5 border-b border-gray-200 flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search documents or vendors..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="all">All Status</option>
                  <option value="expired">Expired</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Expiring Soon</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Document</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Vendor</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Expires</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDocuments.map(doc => {
                      const vendor = vendors.find(v => v.id === doc.vendorId);
                      const status = getDocumentStatus(doc.expiresAt);
                      const days = getDaysUntilExpiration(doc.expiresAt);
                      return (
                        <tr key={doc.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">{doc.title}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{vendor?.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-700 capitalize">{doc.type}</td>
                          <td className="px-6 py-4 text-sm">
                            <div className="font-medium text-gray-900">{doc.expiresAt}</div>
                            <div className="text-xs text-gray-600">{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}</div>
                          </td>
                          <td className="px-6 py-4"><Badge className={status.color}>{status.label}</Badge></td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingDocument(doc); setSelectedVendor(doc.vendorId); setShowDocModal(true); }}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteDocument(doc.id)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredDocuments.length === 0 && (
                  <EmptyState icon={FileText} title="No documents found" description="Try adjusting your search or filters" />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div>
            <div className="mb-5 flex justify-end">
              <button onClick={() => { setEditingVendor(null); setShowVendorModal(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold shadow-lg transform hover:scale-105">
                <Plus className="w-5 h-5" />Add Vendor
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-purple-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Contact</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Documents</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vendors.map(vendor => {
                    const vendorDocs = documents.filter(d => d.vendorId === vendor.id);
                    return (
                      <tr key={vendor.id} className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{vendor.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 capitalize">{vendor.type}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{vendor.contact}</td>
                        <td className="px-6 py-4"><Badge variant="info">{vendorDocs.length}</Badge></td>
                        <td className="px-6 py-4">
                          <Badge variant={vendor.status === 'active' ? 'success' : 'default'}>{vendor.status}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingVendor(vendor); setShowVendorModal(true); }}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteVendor(vendor.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reminders' && (
          <div>
            <div className="mb-5 flex justify-end">
              <button onClick={() => setShowReminderModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 font-semibold shadow-lg transform hover:scale-105">
                <Plus className="w-5 h-5" />Add Custom Reminder
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold text-white">Scheduled Reminders</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {reminders.length > 0 ? (
                  reminders.sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt)).map(reminder => {
                    const doc = documents.find(d => d.id === reminder.documentId);
                    const vendor = vendors.find(v => v.id === doc?.vendorId);
                    return (
                      <div key={reminder.id} className="p-5 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl border-2 ${
                            reminder.status === 'scheduled' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                            reminder.status === 'sent' ? 'bg-green-100 text-green-600 border-green-200' : 'bg-red-100 text-red-600 border-red-200'
                          }`}>
                            <Bell className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{reminder.message}</p>
                            <p className="text-sm text-gray-600 mt-1">{vendor?.name} - {doc?.title}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{new Date(reminder.remindAt).toLocaleDateString()}</p>
                            <p className="text-sm text-gray-600 capitalize">{reminder.channel}</p>
                          </div>
                          <Badge variant={reminder.status === 'scheduled' ? 'info' : reminder.status === 'sent' ? 'success' : 'danger'}>
                            {reminder.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState icon={Bell} title="No reminders scheduled" description="Create custom reminders or add documents with expiration dates" />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="bg-gradient-to-r from-orange-600 to-pink-600 p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold text-white">Audit Log</h2>
                <p className="text-orange-100 text-sm mt-1">Complete activity history and compliance tracking</p>
              </div>
              <div className="divide-y divide-gray-200">
                {auditLogs.length > 0 ? (
                  auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50).map(log => (
                    <div key={log.id} className="p-5 hover:bg-gradient-to-r hover:from-orange-50 hover:to-pink-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">
                            <span className="capitalize bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">{log.action}</span>
                            <span className="text-gray-700"> {log.resourceType}</span>
                          </p>
                          {log.metadata.name && <p className="text-sm text-gray-600 mt-1 font-medium">{log.metadata.name}</p>}
                          {log.metadata.title && <p className="text-sm text-gray-600 mt-1 font-medium">{log.metadata.title}</p>}
                          {log.metadata.email && <p className="text-sm text-gray-600 mt-1">{log.metadata.email}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-700">{log.user}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={Clock} title="No audit logs yet" description="Activity will be tracked automatically" />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {showVendorModal && <VendorModal vendor={editingVendor} onClose={() => { setShowVendorModal(false); setEditingVendor(null); }} onSave={handleVendorSave} />}
      {showDocModal && <DocumentModal document={editingDocument} vendors={vendors} selectedVendor={selectedVendor}
        onClose={() => { setShowDocModal(false); setEditingDocument(null); setSelectedVendor(''); }} onSave={handleDocumentSave} />}
      {showReminderModal && <ReminderModal onClose={() => setShowReminderModal(false)} onSave={handleReminderSave} documents={documents} vendors={vendors} />}
    </div>
  );
};

// Modal Components
const VendorModal = ({ vendor, onClose, onSave }) => {
  const [formData, setFormData] = useState(vendor || { name: '', type: 'contractor', contact: '', notes: '' });

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-xl">
          <h2 className="text-xl font-bold text-white">{vendor ? 'Edit Vendor' : 'Add New Vendor'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor Name *</label>
            <input type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
            <select value={formData.type} onChange={(e) => handleChange('type', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="contractor">Contractor</option>
              <option value="software">Software</option>
              <option value="supplier">Supplier</option>
              <option value="consultant">Consultant</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email *</label>
            <input type="email" value={formData.contact} onChange={(e) => handleChange('contact', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
            <textarea value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={() => onSave(formData)}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 shadow-md">
              {vendor ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DocumentModal = ({ document, vendors, selectedVendor, onClose, onSave }) => {
  const [formData, setFormData] = useState(document || {
    vendorId: selectedVendor || '', title: '', type: 'license', issuedAt: '', expiresAt: ''
  });

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-xl sticky top-0">
          <h2 className="text-xl font-bold text-white">{document ? 'Edit Document' : 'Add New Document'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor *</label>
            <select value={formData.vendorId} onChange={(e) => handleChange('vendorId', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select a vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Document Title *</label>
            <input type="text" value={formData.title} onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
            <select value={formData.type} onChange={(e) => handleChange('type', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="license">License</option>
              <option value="insurance">Insurance</option>
              <option value="w9">W-9</option>
              <option value="certificate">Certificate</option>
              <option value="contract">Contract</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Issue Date</label>
            <input type="date" value={formData.issuedAt} onChange={(e) => handleChange('issuedAt', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Expiration Date *</label>
            <input type="date" value={formData.expiresAt} onChange={(e) => handleChange('expiresAt', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {!document && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                <Bell className="w-4 h-4" />Auto-reminders will be created at 30, 14, 7, and 1 days before expiration
              </p>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={() => onSave(formData)}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 shadow-md">
              {document ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReminderModal = ({ onClose, onSave, documents, vendors }) => {
  const [formData, setFormData] = useState({ documentId: '', remindAt: '', channel: 'email', message: '' });

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-xl">
          <h2 className="text-xl font-bold text-white">Create Custom Reminder</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Document *</label>
            <select value={formData.documentId} onChange={(e) => handleChange('documentId', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Select a document</option>
              {documents.map(doc => {
                const vendor = vendors.find(v => v.id === doc.vendorId);
                return <option key={doc.id} value={doc.id}>{doc.title} - {vendor?.name}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Reminder Date *</label>
            <input type="datetime-local" value={formData.remindAt} onChange={(e) => handleChange('remindAt', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Channel *</label>
            <select value={formData.channel} onChange={(e) => handleChange('channel', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="webhook">Webhook</option>
              <option value="calendar">Calendar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Custom Message</label>
            <textarea value={formData.message} onChange={(e) => handleChange('message', e.target.value)} rows={3}
              placeholder="Optional custom reminder message..."
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={() => onSave(formData)}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 shadow-md">
              Create Reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDocTracker;
