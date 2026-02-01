
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Product, Transaction, UserRole, RawMaterialEntry, Store, AppConfig } from './types.ts';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import InventoryTable from './components/InventoryTable.tsx';
import Login from './components/Login.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import FinancePanel from './components/FinancePanel.tsx';
import ShippingPanel from './components/ShippingPanel.tsx';
import StoreAnalytics from './components/StoreAnalytics.tsx';
import ITMaintenancePanel from './components/ITMaintenancePanel.tsx';
import { mockUsers, mockProducts, mockTransactions, mockConfig, mockRawMaterials } from './services/mockData.ts';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'success' | 'error' | 'idle'>('idle');
  
  // Banco de Dados Local + Sincronização Cloud
  const [config, setConfig] = useState<AppConfig>(() => JSON.parse(localStorage.getItem('7divas_config') || JSON.stringify(mockConfig)));
  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('7divas_users') || JSON.stringify(mockUsers)));
  const [products, setProducts] = useState<Product[]>(() => JSON.parse(localStorage.getItem('7divas_products') || JSON.stringify(mockProducts)));
  const [stores, setStores] = useState<Store[]>(() => JSON.parse(localStorage.getItem('7divas_stores') || JSON.stringify(config.stores)));
  const [rawMaterials, setRawMaterials] = useState<RawMaterialEntry[]>(() => JSON.parse(localStorage.getItem('7divas_raw') || JSON.stringify(mockRawMaterials)));
  const [transactions, setTransactions] = useState<Transaction[]>(() => JSON.parse(localStorage.getItem('7divas_tx') || JSON.stringify(mockTransactions)));

  // Refs para evitar loops infinitos no auto-sync
  const isSyncingRef = useRef(false);

  // FUNÇÃO DE SINCRONIZAÇÃO: PUSH (App -> Cloud)
  const pushToCloud = useCallback(async (dataOverride?: any) => {
    if (!config.gasWebAppUrl || isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    setIsLoading(true);
    try {
      const payload = {
        action: 'syncAll',
        data: dataOverride || { users, products, transactions, config, stores, rawMaterials }
      };

      // Usamos text/plain para evitar Preflight CORS que o Apps Script não lida bem nativamente
      await fetch(config.gasWebAppUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      
      setLastSyncStatus('success');
      console.log("Cloud Push Successful");
    } catch (e) {
      console.error("Cloud Push Failed", e);
      setLastSyncStatus('error');
    } finally {
      setIsLoading(false);
      isSyncingRef.current = false;
    }
  }, [users, products, transactions, config, stores, rawMaterials]);

  // FUNÇÃO DE SINCRONIZAÇÃO: PULL (Cloud -> App)
  const pullFromCloud = useCallback(async () => {
    if (!config.gasWebAppUrl) return;
    
    try {
      const res = await fetch(`${config.gasWebAppUrl}?action=getAllData`);
      if (!res.ok) throw new Error("Server error");
      const cloudData = await res.json();
      
      if (cloudData.users && cloudData.users.length > 0) {
        setUsers(cloudData.users);
        setProducts(cloudData.products);
        setTransactions(cloudData.transactions);
        setStores(cloudData.stores);
        setRawMaterials(cloudData.rawMaterials);
        if (cloudData.config && cloudData.config.companyName) {
           setConfig(prev => ({ ...cloudData.config, gasWebAppUrl: prev.gasWebAppUrl }));
        }
        console.log("Cloud Pull Successful");
      }
    } catch (e) {
      console.warn("Cloud load failed, using local copy", e);
    }
  }, [config.gasWebAppUrl]);

  // Efeito de Polling (Tempo Real: Busca dados a cada 20 segundos)
  useEffect(() => {
    if (!config.gasWebAppUrl) return;
    
    pullFromCloud(); // Carga inicial
    const interval = setInterval(pullFromCloud, 20000); 
    return () => clearInterval(interval);
  }, [config.gasWebAppUrl]);

  // Persistência Local (Offline-first)
  useEffect(() => {
    localStorage.setItem('7divas_config', JSON.stringify(config));
    localStorage.setItem('7divas_users', JSON.stringify(users));
    localStorage.setItem('7divas_products', JSON.stringify(products));
    localStorage.setItem('7divas_stores', JSON.stringify(stores));
    localStorage.setItem('7divas_raw', JSON.stringify(rawMaterials));
    localStorage.setItem('7divas_tx', JSON.stringify(transactions));
  }, [config, users, products, stores, rawMaterials, transactions]);

  // Debounce para o Push (Salva na nuvem 3s após a última edição)
  useEffect(() => {
    if (user) {
      const timeout = setTimeout(() => {
        pushToCloud();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [config, users, products, stores, rawMaterials, transactions, user]);

  const handleLogin = (email: string, pass: string) => {
    if (email === 'ti@7divas.com' && pass === 'mestre7') {
        setUser({ id: 'ti', name: 'Master TI Admin', email, role: UserRole.TI, status: 'ATIVO' });
        return;
    }
    const found = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === pass.trim());
    if (found) {
      setUser(found);
      setLoginError('');
    } else {
      setLoginError('Acesso negado. Verifique suas credenciais.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('dashboard');
  };

  const processInventoryChange = (productId: string, quantity: number, type: 'ENTRY' | 'SALE' | 'EXIT', storeId?: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return false;

    if ((type === 'SALE' || type === 'EXIT') && prod.currentStock < quantity) {
      alert(`Estoque insuficiente! Temos apenas ${prod.currentStock} unidades.`);
      return false;
    }

    const newTx: Transaction = {
      id: `tx${Date.now()}`,
      productId,
      type: type === 'SALE' ? 'SALE' : (type === 'ENTRY' ? 'ENTRY' : 'EXIT'),
      quantity,
      unitPrice: type === 'SALE' ? prod.salePrice : prod.costPrice,
      totalValue: quantity * (type === 'SALE' ? prod.salePrice : prod.costPrice),
      timestamp: new Date().toISOString(),
      userId: user?.id || 'sys',
      storeId
    };

    setTransactions(prev => [...prev, newTx]);
    setProducts(prev => prev.map(p => p.id === productId ? 
      { ...p, currentStock: type === 'ENTRY' ? p.currentStock + quantity : p.currentStock - quantity } : p
    ));
    return true;
  };

  if (!user) return <Login onLogin={handleLogin} error={loginError} config={config} />;

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col md:flex-row overflow-x-hidden">
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={(tab) => { setActiveTab(tab); setIsSidebarOpen(false); }} 
        onLogout={handleLogout}
        config={config}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      <main className={`flex-1 p-4 md:p-10 bg-[#F8F9FA] transition-all duration-300 ${isSidebarOpen ? '' : 'md:ml-64'} w-full`}>
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-4 border-b border-slate-200 pb-6 w-full">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-3 bg-black text-[#D4AF37] rounded-xl shadow-lg active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
            <h1 className="text-xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter truncate">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'inventory' && 'Acervo'}
              {activeTab === 'shipping' && 'Expedição'}
              {activeTab === 'finance' && 'Insumos'}
              {activeTab === 'store_analytics' && 'Lojas'}
              {activeTab === 'admin' && 'Painel Adm'}
              {activeTab === 'ti_maintenance' && 'Maintenance'}
            </h1>
            {isLoading && (
              <div className="flex items-center gap-2 text-blue-600 font-bold text-[9px] animate-pulse">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div> Cloud Syncing...
              </div>
            )}
          </div>
          
          <div className="hidden md:flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
             <div className="text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase">Usuário Ativo</p>
               <p className="text-xs font-black text-slate-900">{user.name}</p>
             </div>
             <img src={user.avatar || 'https://i.pravatar.cc/150'} className="w-10 h-10 rounded-full border-2 border-[#D4AF37]" />
          </div>
        </header>

        <div className="w-full">
          {activeTab === 'dashboard' && (
            <Dashboard products={products} transactions={transactions} rawMaterials={rawMaterials} stores={stores} currentUser={user} />
          )}

          {activeTab === 'inventory' && (
            <InventoryTable 
              products={products} 
              role={user.role} 
              onUpdateStock={(id, qty, type) => processInventoryChange(id, qty, type)}
              onEditProduct={(p) => p.id ? setProducts(prev => prev.map(curr => curr.id === p.id ? p : curr)) : setProducts(prev => [...prev, { ...p, id: `p${Date.now()}` }])}
              onDeleteProduct={(id) => setProducts(prev => prev.filter(p => p.id !== id))}
              accentColor={config.accentColor}
            />
          )}

          {activeTab === 'shipping' && (
            <ShippingPanel products={products} stores={stores} transactions={transactions} onRegisterSale={(pid, qty, sid) => processInventoryChange(pid, qty, 'SALE', sid)} />
          )}

          {activeTab === 'finance' && (
            <FinancePanel rawMaterials={rawMaterials} onAddRawMaterial={(rm) => setRawMaterials(prev => [...prev, { ...rm, id: `rm${Date.now()}` }])} onUpdateRawMaterial={rm => setRawMaterials(prev => prev.map(x => x.id === rm.id ? rm : x))} onDeleteRawMaterial={id => setRawMaterials(prev => prev.filter(x => x.id !== id))} currentUser={user} />
          )}

          {activeTab === 'admin' && (
            <AdminPanel users={users} setUsers={setUsers} stores={stores} setStores={setStores} currentUser={user} config={config} setConfig={setConfig} />
          )}

          {activeTab === 'store_analytics' && (
            <StoreAnalytics stores={stores} transactions={transactions} products={products} />
          )}

          {activeTab === 'ti_maintenance' && user.role === UserRole.TI && (
            <ITMaintenancePanel config={config} setConfig={setConfig} users={users} onForceSync={() => { pullFromCloud(); pushToCloud(); }} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
