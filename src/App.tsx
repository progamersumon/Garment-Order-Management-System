import { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, FileText, Download, Filter, Clipboard, Edit, Search, LayoutDashboard, Settings, X, UserPlus, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Order, WashPrice } from './types';
import { supabase } from './supabaseClient';

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [washPrices, setWashPrices] = useState<WashPrice[]>([]);
  const [buyers, setBuyers] = useState<string[]>([]);
  const [activeBuyer, setActiveBuyer] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingWashPrice, setIsAddingWashPrice] = useState(false);
  const [isBuyerManagerOpen, setIsBuyerManagerOpen] = useState(false);
  const [newBuyerName, setNewBuyerName] = useState("");
  const [selectedContractBuyer, setSelectedContractBuyer] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingWashPriceId, setEditingWashPriceId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingWashPriceId, setDeletingWashPriceId] = useState<number | null>(null);
  const [buyerToDelete, setBuyerToDelete] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [isPastingWashPrice, setIsPastingWashPrice] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [pastedWashPriceData, setPastedWashPriceData] = useState('');
  const [washPriceSeasonFilter, setWashPriceSeasonFilter] = useState("All");
  const [isWashPriceSelectionMode, setIsWashPriceSelectionMode] = useState(false);
  const [selectedWashPriceIds, setSelectedWashPriceIds] = useState<number[]>([]);
  const [isBulkDeletingWashPrice, setIsBulkDeletingWashPrice] = useState(false);
  const [isOrderSelectionMode, setIsOrderSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isBulkDeletingOrder, setIsBulkDeletingOrder] = useState(false);
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    contractNo: '',
    poNo: '',
    item: '',
    buyer: '',
    styleName: '',
    color: '',
    season: '',
    orderQty: 0,
    washPricePcs: 0,
    washPriceDoz: 0,
    bp: '',
    wo: '',
    shipmentDate: new Date().toISOString().split('T')[0],
  });
  const [newWashPrice, setNewWashPrice] = useState<Partial<WashPrice>>({
    buyer: '',
    description: '',
    styleName: '',
    color: '',
    season: '',
    washPricePcs: 0,
    washPriceDoz: 0,
  });

  useEffect(() => {
    fetchBuyers();
    fetchWashPrices();
  }, []);

  useEffect(() => {
    if (buyers.length > 0 && !newOrder.buyer) {
      setNewOrder(prev => ({ ...prev, buyer: buyers[0] }));
    }
    if (buyers.length > 0 && !newWashPrice.buyer) {
      setNewWashPrice(prev => ({ ...prev, buyer: buyers[0] }));
    }
    if (buyers.length > 0 && !selectedContractBuyer) {
      setSelectedContractBuyer(buyers[0]);
    }
  }, [buyers]);

  useEffect(() => {
    fetchOrders();
  }, [activeBuyer]);

  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fetchBuyers = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    const { data, error } = await supabase.from('buyers').select('*');
    if (error) {
      console.error('Error fetching buyers:', error);
      return;
    }
    
    if (data && data.length === 0) {
      // Seed initial buyers if table is empty
      const initialBuyers = ["H&M", "Mango", "Stradivarius", "Jules", "Benetton", "GDM", "Zara"];
      const { error: seedError } = await supabase.from('buyers').insert(initialBuyers.map(name => ({ name })));
      if (!seedError) {
        setBuyers(initialBuyers);
      } else {
        console.error('Seeding failed:', seedError);
      }
    } else if (data) {
      setBuyers(data.map((b: any) => b.name));
    }
  };

  const addBuyer = async () => {
    if (!newBuyerName.trim()) return;
    if (!supabase) {
      alert('Supabase is not configured. Please set your environment variables.');
      return;
    }
    const { error } = await supabase.from('buyers').insert([{ name: newBuyerName.trim() }]);
    if (!error) {
      setNewBuyerName("");
      fetchBuyers();
    } else {
      console.error('Error adding buyer:', error);
      alert('Error adding buyer: ' + error.message);
    }
  };

  const deleteBuyer = (name: string) => {
    setBuyerToDelete(name);
  };

  const confirmDeleteBuyer = async () => {
    if (buyerToDelete) {
      if (!supabase) return;
      const { error } = await supabase.from('buyers').delete().eq('name', buyerToDelete);
      if (!error) {
        if (activeBuyer === buyerToDelete) setActiveBuyer("Dashboard");
        fetchBuyers();
      } else {
        console.error('Error deleting buyer:', error);
        alert('Error deleting buyer: ' + error.message);
      }
      setBuyerToDelete(null);
    }
  };

  const allTabs = ["Dashboard", "Buyers", ...buyers];

  const fetchOrders = async () => {
    if (!supabase) return;
    let query = supabase.from('orders').select('*');
    if (activeBuyer !== "Buyers" && activeBuyer !== "Dashboard") {
      query = query.eq('buyer', activeBuyer);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }
    // Map lowercase DB columns back to camelCase state
    const mappedOrders = (data || []).map((o: any) => ({
      id: o.id,
      contractNo: o.contractno,
      poNo: o.pono,
      item: o.item,
      buyer: o.buyer,
      styleName: o.stylename,
      color: o.color,
      season: o.season,
      orderQty: o.orderqty,
      washPricePcs: o.washpricepcs,
      washPriceDoz: o.washpricedoz,
      bp: o.bp,
      wo: o.wo,
      shipmentDate: o.shipmentdate
    }));
    setOrders(mappedOrders);
  };

  const fetchWashPrices = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('wash_prices').select('*').order('id', { ascending: false });
    if (error) {
      console.error('Error fetching wash prices:', error);
      return;
    }
    // Map lowercase DB columns back to camelCase state
    const mappedPrices = (data || []).map((p: any) => ({
      id: p.id,
      buyer: p.buyer,
      description: p.description,
      styleName: p.stylename,
      color: p.color,
      season: p.season,
      washPricePcs: p.washpricepcs,
      washPriceDoz: p.washpricedoz
    }));
    setWashPrices(mappedPrices);
  };

  const handlePaste = async () => {
    if (!pastedData.trim()) return;
    if (!supabase) {
      alert('Supabase is not configured. Please check Secrets.');
      return;
    }

    setIsImporting(true);
    try {
      const rows = pastedData.trim().split('\n');
      const newOrders: any[] = rows.map(row => {
        const cols = row.split('\t');
        if (cols.length < 2) return null;
        return {
          contractno: cols[0] || '',
          pono: cols[1] || '',
          item: cols[2] || '',
          buyer: cols[3] || buyers[0] || '',
          stylename: cols[4] || '',
          color: cols[5] || '',
          season: cols[6] || '',
          orderqty: parseInt(cols[7]?.replace(/,/g, '')) || 0,
          washpricepcs: parseFloat(cols[8]?.replace('$', '')) || 0,
          washpricedoz: parseFloat(cols[9]?.replace('$', '')) || 0,
          bp: cols[10] || '',
          wo: cols[11] || '',
          shipmentdate: normalizeDate(cols[12]),
        };
      }).filter(Boolean);

      if (newOrders.length === 0) {
        alert('No valid data found to import.');
        setIsImporting(false);
        return;
      }

      const { error } = await supabase.from('orders').insert(newOrders);
      if (error) throw error;

      setIsPasting(false);
      setPastedData('');
      fetchOrders();
      alert('Data imported successfully!');
    } catch (error: any) {
      console.error('Error pasting orders:', error);
      alert('Import failed: ' + (error.message || 'Unknown error. Check if table "orders" exists and RLS policy is set.'));
    } finally {
      setIsImporting(false);
    }
  };

  const handlePasteWashPrice = async () => {
    if (!pastedWashPriceData.trim()) return;
    if (!supabase) {
      alert('Supabase is not configured.');
      return;
    }

    setIsImporting(true);
    try {
      const rows = pastedWashPriceData.trim().split('\n');
      const newPrices: any[] = rows.map(row => {
        const cols = row.split('\t');
        if (cols.length < 2) return null;
        const pcs = parseFloat(cols[5]?.replace('$', '')) || 0;
        return {
          description: cols[0] || '',
          buyer: cols[1] || buyers[0] || '',
          stylename: cols[2] || '',
          color: cols[3] || '',
          season: cols[4] || '',
          washpricepcs: pcs,
          washpricedoz: pcs * 12,
        };
      }).filter(Boolean);

      if (newPrices.length === 0) {
        alert('No valid data found.');
        setIsImporting(false);
        return;
      }

      const { error } = await supabase.from('wash_prices').insert(newPrices);
      if (error) throw error;

      setIsPastingWashPrice(false);
      setPastedWashPriceData('');
      fetchWashPrices();
      alert('Wash prices imported successfully!');
    } catch (error: any) {
      console.error('Error pasting wash prices:', error);
      alert('Import failed: ' + (error.message || 'Unknown error. Check table "wash_prices".'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Secrets.');
      return;
    }

    if (!newOrder.buyer) {
      alert('Please select a Buyer.');
      return;
    }

    setIsSaving(true);
    try {
      const orderToSave = {
        contractno: newOrder.contractNo || '',
        pono: newOrder.poNo || '',
        item: newOrder.item || '',
        buyer: newOrder.buyer || '',
        stylename: newOrder.styleName || '',
        color: newOrder.color || '',
        season: newOrder.season || '',
        orderqty: Number(newOrder.orderQty) || 0,
        washpricepcs: Number(newOrder.washPricePcs) || 0,
        washpricedoz: (Number(newOrder.washPricePcs) || 0) * 12,
        bp: newOrder.bp || '',
        wo: newOrder.wo || '',
        shipmentdate: newOrder.shipmentDate || new Date().toISOString().split('T')[0],
      };

      let error;
      if (editingId) {
        const { error: err } = await supabase.from('orders').update(orderToSave).eq('id', editingId);
        error = err;
      } else {
        const { error: err } = await supabase.from('orders').insert([orderToSave]);
        error = err;
      }

      if (error) throw error;

      setIsAdding(false);
      setEditingId(null);
      fetchOrders();
      setNewOrder({
        contractNo: '',
        poNo: '',
        item: '',
        buyer: activeBuyer === "Buyers" || activeBuyer === "Dashboard" ? (buyers[0] || '') : activeBuyer,
        styleName: '',
        color: '',
        season: '',
        orderQty: 0,
        washPricePcs: 0,
        washPriceDoz: 0,
        bp: '',
        wo: '',
        shipmentDate: new Date().toISOString().split('T')[0],
      });
    } catch (error: any) {
      console.error('Error saving order:', error);
      alert('Save failed: ' + (error.message || 'Unknown error. Check your table schema and RLS policies.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWashPrice = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert('Supabase is not configured.');
      return;
    }

    if (!newWashPrice.buyer) {
      alert('Please select a Buyer.');
      return;
    }

    setIsSaving(true);
    try {
      const priceToSave = {
        buyer: newWashPrice.buyer || '',
        description: newWashPrice.description || '',
        stylename: newWashPrice.styleName || '',
        color: newWashPrice.color || '',
        season: newWashPrice.season || '',
        washpricepcs: Number(newWashPrice.washPricePcs) || 0,
        washpricedoz: Number(newWashPrice.washPriceDoz) || 0,
      };

      let error;
      if (editingWashPriceId) {
        const { error: err } = await supabase.from('wash_prices').update(priceToSave).eq('id', editingWashPriceId);
        error = err;
      } else {
        const { error: err } = await supabase.from('wash_prices').insert([priceToSave]);
        error = err;
      }

      if (error) throw error;

      setIsAddingWashPrice(false);
      setEditingWashPriceId(null);
      setNewWashPrice({
        buyer: buyers[0] || '',
        description: '',
        styleName: '',
        color: '',
        season: '',
        washPricePcs: 0,
        washPriceDoz: 0,
      });
      fetchWashPrices();
    } catch (error: any) {
      console.error('Error saving wash price:', error);
      alert('Save failed: ' + (error.message || 'Unknown error.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditWashPriceClick = (price: WashPrice) => {
    setNewWashPrice(price);
    setEditingWashPriceId(price.id!);
    setIsAddingWashPrice(true);
  };

  const confirmDeleteWashPrice = async () => {
    if (deletingWashPriceId) {
      const { error } = await supabase.from('wash_prices').delete().eq('id', deletingWashPriceId);
      if (error) {
        console.error('Error deleting wash price:', error);
      }
      setDeletingWashPriceId(null);
      fetchWashPrices();
    }
  };

  const handleBulkDeleteWashPrices = () => {
    if (selectedWashPriceIds.length === 0) {
      setIsWashPriceSelectionMode(false);
      return;
    }
    setIsBulkDeletingWashPrice(true);
  };

  const confirmBulkDeleteWashPrices = async () => {
    const { error } = await supabase.from('wash_prices').delete().in('id', selectedWashPriceIds);
    if (error) {
      console.error('Error bulk deleting wash prices:', error);
    }
    setSelectedWashPriceIds([]);
    setIsWashPriceSelectionMode(false);
    setIsBulkDeletingWashPrice(false);
    fetchWashPrices();
  };

  const toggleWashPriceSelection = (id: number) => {
    setSelectedWashPriceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteOrders = () => {
    if (selectedOrderIds.length === 0) {
      setIsOrderSelectionMode(false);
      return;
    }
    setIsBulkDeletingOrder(true);
  };

  const confirmBulkDeleteOrders = async () => {
    const { error } = await supabase.from('orders').delete().in('id', selectedOrderIds);
    if (error) {
      console.error('Error bulk deleting orders:', error);
    }
    setSelectedOrderIds([]);
    setIsOrderSelectionMode(false);
    setIsBulkDeletingOrder(false);
    fetchOrders();
  };

  const toggleOrderSelection = (id: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAdminClick = () => {
    if (role === 'admin') return;
    setIsAdminPasswordModalOpen(true);
    setAdminPasswordInput("");
    setAdminPasswordError(false);
  };

  const verifyAdminPassword = (e?: FormEvent) => {
    if (e) e.preventDefault();
    // Simple hardcoded password for now
    if (adminPasswordInput === "15031996") {
      setRole('admin');
      setIsAdminPasswordModalOpen(false);
      setAdminPasswordError(false);
    } else {
      setAdminPasswordError(true);
    }
  };

  const handleEditClick = (order: Order) => {
    setNewOrder(order);
    setEditingId(order.id!);
    setIsAdding(true);
  };

  const handleDelete = (id: number) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (deletingId) {
      const { error } = await supabase.from('orders').delete().eq('id', deletingId);
      if (error) {
        console.error('Error deleting order:', error);
      }
      setDeletingId(null);
      fetchOrders();
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    const tableColumn = ["Contract No", "PO No", "Item", "Buyer", "Style Name", "Color", "Season", "Order Qty", "Price (Pcs)", "Price (Doz)", "BP", "WO", "Shipment Date"];
    const tableRows: any[] = [];

    filteredOrders.forEach(order => {
      const orderData = [
        order.contractNo,
        order.poNo,
        order.item,
        order.buyer,
        order.styleName,
        order.color,
        order.season,
        order.orderQty.toLocaleString(),
        `$${order.washPricePcs.toFixed(2)}`,
        `$${order.washPriceDoz.toFixed(2)}`,
        order.bp,
        order.wo,
        formatDate(order.shipmentDate)
      ];
      tableRows.push(orderData);
    });

    // Add total row
    tableRows.push([
      "Total", "", "", "", "", "", "", 
      totalQty.toLocaleString(), "", "", "", "", ""
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      didParseCell: (data) => {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    const title = activeBuyer === "Dashboard" ? "All Orders Report" : `${activeBuyer} Orders Report`;
    doc.text(title, 14, 15);
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  const exportToExcel = () => {
    const headers = ["Contract No", "PO No", "Item", "Buyer", "Style Name", "Color", "Season", "Order Qty", "Price (Pcs)", "Price (Doz)", "BP", "WO", "Shipment Date"];
    const rows = filteredOrders.map(order => [
      order.contractNo,
      order.poNo,
      order.item,
      order.buyer,
      order.styleName,
      order.color,
      order.season,
      order.orderQty,
      order.washPricePcs,
      order.washPriceDoz,
      order.bp,
      order.wo,
      formatDate(order.shipmentDate)
    ]);

    // Add total row
    rows.push(["Total", "", "", "", "", "", "", totalQty, "", "", "", "", ""]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    
    const fileName = activeBuyer === "Dashboard" ? "All_Orders.xlsx" : `${activeBuyer}_Orders.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const filteredOrders = orders.filter(order => 
    order.contractNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.poNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.styleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.buyer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalQty = filteredOrders.reduce((sum, order) => sum + order.orderQty, 0);

  const dashboardData = buyers.map(buyer => {
    const buyerOrders = orders.filter(o => o.buyer === buyer);
    return {
      name: buyer,
      qty: buyerOrders.reduce((sum, o) => sum + o.orderQty, 0)
    };
  }).filter(d => d.qty > 0);

  // Buyer-wise Contract Data
  const buyerContractData = buyers.map(buyer => {
    const buyerOrders = orders.filter(o => o.buyer === buyer);
    const contracts = Array.from(new Set(buyerOrders.map(o => o.contractNo))).map(contract => {
      const contractOrders = buyerOrders.filter(o => o.contractNo === contract);
      return {
        name: contract,
        qty: contractOrders.reduce((sum, o) => sum + o.orderQty, 0)
      };
    }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    
    return {
      buyer,
      contracts
    };
  }).filter(d => d.contracts.length > 0);

  // H&M Monthly Data (Current month +/- 2 months)
  const getHMMonthlyData = () => {
    const now = new Date();
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = -2; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = `${monthNames[d.getMonth()]}-${d.getFullYear().toString().slice(-2)}`;
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const hmOrders = orders.filter(o => o.buyer === 'H&M' && o.shipmentDate.startsWith(monthKey));
      const qty = hmOrders.reduce((sum, o) => sum + o.orderQty, 0);
      
      months.push({ 
        name: monthLabel, 
        qty,
        isCurrent: i === 0,
        isPast: i < 0
      });
    }
    return months;
  };

  const hmMonthlyData = getHMMonthlyData();

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      if (!year || !month || !day) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = months[parseInt(month) - 1];
      return `${day}-${monthName}-${year.slice(-2)}`;
    } catch (e) {
      return dateStr;
    }
  };

  const normalizeDate = (dateStr: string) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    const monthsShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    // Handle dd-mm-yyyy, dd/mm/yyyy, or dd-mmm-yy
    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
      let [d, m, y] = parts;
      
      // If first part is 4 digits, it's likely already yyyy-mm-dd
      if (d.length === 4) return dateStr;
      
      // Handle month name (e.g., "Jan")
      let monthIndex = monthsShort.indexOf(m.toLowerCase());
      let month = '';
      if (monthIndex !== -1) {
        month = (monthIndex + 1).toString().padStart(2, '0');
      } else {
        month = m.padStart(2, '0');
      }
      
      const day = d.padStart(2, '0');
      let year = y;
      if (y.length === 2) year = `20${y}`;
      
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-300 flex items-center shadow-sm">
        <div className="flex-1 flex items-center overflow-x-auto">
          {allTabs.map((buyer) => (
            <div
              key={buyer}
              onClick={() => setActiveBuyer(buyer)}
              className={`nav-tab whitespace-nowrap ${activeBuyer === buyer ? 'active' : ''}`}
            >
              {buyer}
            </div>
          ))}
        </div>
        <div className="px-4 border-l border-gray-200 h-full flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setRole('user')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${role === 'user' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              User
            </button>
            <button 
              onClick={handleAdminClick}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${role === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Admin
            </button>
          </div>
          {role === 'admin' && (
            <button 
              onClick={() => setIsBuyerManagerOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
              title="Manage Buyers"
            >
              <Users size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Buyer Manager Modal */}
      <AnimatePresence>
        {isBuyerManagerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Users size={20} className="text-blue-600" /> Manage Buyers
                  </h3>
                  <button onClick={() => setIsBuyerManagerOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto">
                  <div className="space-y-1 pr-2">
                    {buyers.map((name) => (
                      <div key={name} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg border border-gray-100 group">
                        <span className="font-medium text-gray-700">{name}</span>
                        <button 
                          onClick={() => deleteBuyer(name)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100 sticky bottom-0 bg-white">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter new buyer name..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={newBuyerName}
                        onChange={(e) => setNewBuyerName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addBuyer()}
                      />
                      <button 
                        onClick={addBuyer}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                      >
                        <UserPlus size={18} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-[1400px] mx-auto">
          {/* Header Section */}
          <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur-sm -mx-4 px-4 py-4 mb-6 border-b border-gray-200 shadow-sm">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  {activeBuyer === "Dashboard" ? (
                    <><LayoutDashboard size={20} className="text-blue-600" /> Dashboard Overview</>
                  ) : (
                    <><Filter size={20} className="text-blue-600" /> {activeBuyer === "Buyers" ? "All Orders" : `${activeBuyer} Orders`}</>
                  )}
                </h1>
                
                {activeBuyer !== "Dashboard" && role === 'admin' && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsPasting(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-colors shadow-sm whitespace-nowrap"
                    >
                      <Clipboard size={14} /> Paste Excel
                    </button>
                    <button 
                      onClick={() => setIsAdding(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-colors shadow-sm whitespace-nowrap"
                    >
                      <Plus size={14} /> Add New
                    </button>
                    <button 
                      onClick={() => {
                        if (isOrderSelectionMode) {
                          handleBulkDeleteOrders();
                        } else {
                          setIsOrderSelectionMode(true);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-bold transition-colors shadow-sm whitespace-nowrap ${
                        isOrderSelectionMode 
                          ? 'bg-red-600 text-white border-red-700 hover:bg-red-700' 
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      <Trash2 size={14} /> 
                      {isOrderSelectionMode 
                        ? (selectedOrderIds.length > 0 ? `Delete (${selectedOrderIds.length})` : 'Cancel') 
                        : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
              
              {activeBuyer !== "Dashboard" && (
                <div className="flex flex-1 w-full lg:max-w-md items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search by Contract, PO, Style, Item..."
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={exportToPDF}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600 border border-gray-300 bg-white shadow-sm" 
                      title="Export PDF"
                    >
                      <FileText size={18} />
                    </button>
                    <button 
                      onClick={exportToExcel}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600 border border-gray-300 bg-white shadow-sm" 
                      title="Download Excel"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {activeBuyer === "Dashboard" ? (
            <div className="space-y-6">
              {/* Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Wash Price List (Left Side - 2 Columns) */}
                <div className="lg:col-span-2 flex flex-col space-y-2">
                  <div className="px-2 h-[36px] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                      <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wider">Wash Price List</h2>
                      <select 
                        value={washPriceSeasonFilter}
                        onChange={(e) => setWashPriceSeasonFilter(e.target.value)}
                        className="text-[10px] border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500 bg-white shadow-sm font-medium text-gray-700"
                      >
                        <option value="All">All Seasons</option>
                        {Array.from(new Set(washPrices.map(p => p.season))).filter(Boolean).sort().map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    {role === 'admin' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setIsPastingWashPrice(true)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors shadow-sm"
                        >
                          <Clipboard size={12} /> Paste Excel
                        </button>
                        <button 
                          onClick={() => setIsAddingWashPrice(true)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors shadow-sm"
                        >
                          <Plus size={12} /> Add New
                        </button>
                        <button 
                          onClick={() => {
                            if (isWashPriceSelectionMode) {
                              handleBulkDeleteWashPrices();
                            } else {
                              setIsWashPriceSelectionMode(true);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-[10px] font-bold transition-colors shadow-sm ${
                            isWashPriceSelectionMode 
                              ? 'bg-red-600 text-white border-red-700 hover:bg-red-700' 
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          }`}
                        >
                          <Trash2 size={12} /> 
                          {isWashPriceSelectionMode 
                            ? (selectedWashPriceIds.length > 0 ? `Delete (${selectedWashPriceIds.length})` : 'Cancel') 
                            : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="data-table-header w-12">SL</th>
                            <th className="data-table-header">Description</th>
                            <th className="data-table-header">Buyer</th>
                            <th className="data-table-header">Style Name</th>
                            <th className="data-table-header">Color</th>
                            <th className="data-table-header">Season</th>
                            <th className="data-table-header text-right">Price pcs</th>
                            <th className="data-table-header text-right">Price doz</th>
                            {role === 'admin' && (
                              <th className="data-table-header w-20">
                                {isWashPriceSelectionMode ? 'Select' : 'Actions'}
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {washPrices
                            .filter(p => washPriceSeasonFilter === "All" || p.season === washPriceSeasonFilter)
                            .slice(0, 15)
                            .map((price, idx) => (
                            <tr key={price.id || idx} className="bg-white hover:bg-gray-50 transition-colors">
                              <td className="data-table-cell font-mono">{idx + 1}</td>
                              <td className="data-table-cell text-left px-2">{price.description}</td>
                              <td className="data-table-cell">{price.buyer}</td>
                              <td className="data-table-cell">{price.styleName}</td>
                              <td className="data-table-cell">{price.color}</td>
                              <td className="data-table-cell">{price.season}</td>
                              <td className="data-table-cell text-right px-2 font-bold text-emerald-700">${price.washPricePcs.toFixed(2)}</td>
                              <td className="data-table-cell text-right px-2 font-bold text-blue-700">${(price.washPriceDoz || 0).toFixed(2)}</td>
                              {role === 'admin' && (
                                <td className="data-table-cell">
                                  <div className="flex justify-center gap-2">
                                    {isWashPriceSelectionMode ? (
                                      <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                        checked={selectedWashPriceIds.includes(price.id!)}
                                        onChange={() => toggleWashPriceSelection(price.id!)}
                                      />
                                    ) : (
                                      <>
                                        <button 
                                          onClick={() => handleEditWashPriceClick(price)}
                                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        >
                                          <Edit size={12} />
                                        </button>
                                        <button 
                                          onClick={() => setDeletingWashPriceId(price.id!)}
                                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                          {washPrices.filter(p => washPriceSeasonFilter === "All" || p.season === washPriceSeasonFilter).length === 0 && (
                            <tr>
                              <td colSpan={role === 'admin' ? 9 : 8} className="data-table-cell py-8 text-center text-gray-400 italic">No data available</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {washPrices.filter(p => washPriceSeasonFilter === "All" || p.season === washPriceSeasonFilter).length > 15 && (
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-500 text-center">
                        Showing latest 15 entries.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side Stack (1 Column) */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                  {/* Buyer Distribution */}
                  <div className="flex flex-col space-y-2">
                    <div className="px-2 h-[36px] flex items-center justify-between shrink-0">
                      <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Buyer Distribution</h2>
                      <div className="bg-white px-2 py-0.5 rounded border border-blue-100 flex items-center gap-2 shadow-sm">
                        <span className="text-[9px] font-bold text-blue-400 uppercase">Total</span>
                        <span className="text-xs font-bold text-blue-700">{orders.reduce((sum, o) => sum + o.orderQty, 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm overflow-y-auto max-h-[300px]">
                      <div className="space-y-2">
                        {dashboardData.sort((a, b) => b.qty - a.qty).map((item, idx) => (
                          <div key={item.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                              <span className="text-xs font-medium text-gray-700">{item.name}</span>
                            </div>
                            <span className="text-xs font-bold text-gray-900">{item.qty.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Contract Distribution */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center px-2 h-[36px] shrink-0">
                      <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                        Contracts
                      </h2>
                      <select 
                        value={selectedContractBuyer}
                        onChange={(e) => setSelectedContractBuyer(e.target.value)}
                        className="text-[10px] border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 bg-white shadow-sm font-medium text-gray-700"
                      >
                        {buyers.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm overflow-y-auto max-h-[300px]">
                      {buyerContractData.find(d => d.buyer === selectedContractBuyer) ? (
                        <div className="space-y-2">
                          {buyerContractData.find(d => d.buyer === selectedContractBuyer)?.contracts.map((item) => (
                            <div key={item.name} className="flex items-center justify-between border-b border-gray-50 pb-1.5 hover:bg-gray-50 transition-colors px-1 rounded">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                                <span className="text-xs font-medium text-gray-700 truncate" title={item.name}>{item.name}</span>
                              </div>
                              <span className="text-xs font-bold text-gray-900 shrink-0">{item.qty.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-gray-400 text-xs italic">
                          No data
                        </div>
                      )}
                    </div>
                  </div>

                  {/* H&M Trend */}
                  <div className="flex flex-col space-y-2">
                    <div className="px-2 h-[36px] flex items-center shrink-0">
                      <h2 className="text-sm font-bold text-pink-600 uppercase tracking-wider">H&M Trend (5M)</h2>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm overflow-y-auto max-h-[300px]">
                      <div className="space-y-2">
                        {hmMonthlyData.map((item) => (
                          <div 
                            key={item.name} 
                            className={`flex items-center justify-between border-b border-gray-50 pb-1.5 px-2 py-1 rounded-md transition-colors ${
                              item.isCurrent ? 'bg-green-50 border-green-100' : 
                              item.isPast ? 'bg-red-50 border-red-100' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                item.isCurrent ? 'bg-green-500' : 
                                item.isPast ? 'bg-red-500' : 'bg-pink-500'
                              }`}></div>
                              <span className={`text-xs font-medium ${
                                item.isCurrent ? 'text-green-700' : 
                                item.isPast ? 'text-red-700' : 'text-gray-700'
                              }`}>{item.name}</span>
                            </div>
                            <span className={`text-xs font-bold ${
                              item.isCurrent ? 'text-green-900' : 
                              item.isPast ? 'text-red-900' : 'text-gray-900'
                            }`}>{item.qty.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Data Table */
            <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="data-table-header">Contract No</th>
                    <th className="data-table-header">PO No</th>
                    <th className="data-table-header">Item</th>
                    <th className="data-table-header">Buyer</th>
                    <th className="data-table-header">Style Name</th>
                    <th className="data-table-header">Color</th>
                    <th className="data-table-header">Season</th>
                    <th className="data-table-header">Order Qty</th>
                    <th className="data-table-header">Price pcs</th>
                    <th className="data-table-header">Price doz</th>
                    <th className="data-table-header">B/P</th>
                    <th className="data-table-header">W/O</th>
                    <th className="data-table-header">Shipment Date</th>
                    {role === 'admin' && (
                      <th className="data-table-header">
                        {isOrderSelectionMode ? 'Select' : 'Action'}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filteredOrders.map((order, index) => (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={index % 2 === 0 ? 'data-table-row-even' : 'data-table-row-odd'}
                      >
                        <td className="data-table-cell font-mono">{order.contractNo}</td>
                        <td className="data-table-cell">{order.poNo}</td>
                        <td className="data-table-cell text-left px-2">{order.item}</td>
                        <td className="data-table-cell">{order.buyer}</td>
                        <td className="data-table-cell text-left px-2">{order.styleName}</td>
                        <td className="data-table-cell">{order.color}</td>
                        <td className="data-table-cell">{order.season}</td>
                        <td className="data-table-cell font-bold">{order.orderQty.toLocaleString()}</td>
                        <td className="data-table-cell">
                          <div className="flex justify-between px-2">
                            <span>$</span>
                            <span>{order.washPricePcs.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="data-table-cell">
                          <div className="flex justify-between px-2">
                            <span>$</span>
                            <span>{order.washPriceDoz.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="data-table-cell">{order.bp}</td>
                        <td className="data-table-cell">{order.wo}</td>
                        <td className="data-table-cell">{formatDate(order.shipmentDate)}</td>
                        {role === 'admin' && (
                          <td className="data-table-cell">
                            <div className="flex justify-center gap-2">
                              {isOrderSelectionMode ? (
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                  checked={selectedOrderIds.includes(order.id!)}
                                  onChange={() => toggleOrderSelection(order.id!)}
                                />
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditClick(order)}
                                    className="text-blue-500 hover:text-blue-700 transition-colors"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(order.id!)}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {/* Total Row */}
                  <tr className="bg-gray-400 font-bold text-gray-900">
                    <td colSpan={7} className="border border-gray-500 p-1 text-center">Total</td>
                    <td className="border border-gray-500 p-1 text-center">{totalQty.toLocaleString()}</td>
                    <td colSpan={role === 'admin' ? 6 : 5} className="border border-gray-500 p-1"></td>
                  </tr>
                </tbody>
              </table>
              {filteredOrders.length === 0 && (
                <div className="p-12 text-center text-gray-500 italic">
                  No orders found for this selection.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Admin Password Modal */}
      <AnimatePresence>
        {isAdminPasswordModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Admin Access</h3>
                <p className="text-gray-500 text-center text-sm mb-6">Please enter the administrator password to enable editing features.</p>
                
                <form onSubmit={verifyAdminPassword} className="space-y-4">
                  <div>
                    <input 
                      type="password"
                      autoFocus
                      placeholder="Enter password..."
                      className={`w-full px-4 py-3 border rounded-xl outline-none transition-all ${
                        adminPasswordError ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
                      }`}
                      value={adminPasswordInput}
                      onChange={(e) => {
                        setAdminPasswordInput(e.target.value);
                        setAdminPasswordError(false);
                      }}
                    />
                    {adminPasswordError && (
                      <p className="text-red-500 text-xs mt-1 font-medium">Incorrect password. Please try again.</p>
                    )}
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsAdminPasswordModalOpen(false)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                    >
                      Verify
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Orders Confirmation Modal */}
      <AnimatePresence>
        {isBulkDeletingOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Bulk Delete</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Are you sure you want to delete {selectedOrderIds.length} selected orders? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsBulkDeletingOrder(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBulkDeleteOrders}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Delete All
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Are you sure you want to delete this order? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingId(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Buyer Delete Confirmation Modal */}
      <AnimatePresence>
        {buyerToDelete !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Delete Buyer</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Are you sure you want to delete buyer "{buyerToDelete}"? This will not delete their orders but they will no longer appear in the buyer list.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setBuyerToDelete(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteBuyer}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Paste Wash Price Modal */}
      <AnimatePresence>
        {isPastingWashPrice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="bg-emerald-600 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-bold">Paste Wash Price from Excel</h2>
                <button onClick={() => setIsPastingWashPrice(false)} className="hover:text-emerald-200">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Copy rows from Excel and paste them below. Ensure the columns match:
                  <br />
                  <span className="text-[10px] font-mono bg-gray-100 p-1 block mt-2">
                    Description | Buyer | Style Name | Color | Season | Price Pcs
                  </span>
                </p>
                <textarea
                  className="w-full h-64 border border-gray-300 rounded p-3 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Paste here..."
                  value={pastedWashPriceData}
                  onChange={(e) => setPastedWashPriceData(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsPastingWashPrice(false)}
                    className="px-6 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasteWashPrice}
                    disabled={isImporting}
                    className="px-6 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                  >
                    {isImporting ? "Importing..." : "Import Data"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Wash Price Modal */}
      <AnimatePresence>
        {isAddingWashPrice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="bg-blue-600 text-white px-6 py-3 flex shrink-0 justify-between items-center">
                <h2 className="text-lg font-bold">New Wash Price Entry</h2>
                <button onClick={() => setIsAddingWashPrice(false)} className="hover:text-blue-200">✕</button>
              </div>
              <div className="overflow-y-auto flex-1">
                <form onSubmit={handleAddWashPrice} className="p-4 space-y-2">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-gray-600 uppercase">Buyer</label>
                    <select
                      className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newWashPrice.buyer || ''}
                      onChange={e => setNewWashPrice({ ...newWashPrice, buyer: e.target.value })}
                    >
                      {buyers.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-gray-600 uppercase">Description</label>
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newWashPrice.description || ''}
                      onChange={e => setNewWashPrice({ ...newWashPrice, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-gray-600 uppercase">Style Name</label>
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newWashPrice.styleName || ''}
                      onChange={e => setNewWashPrice({ ...newWashPrice, styleName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-gray-600 uppercase">Color</label>
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newWashPrice.color || ''}
                      onChange={e => setNewWashPrice({ ...newWashPrice, color: e.target.value })}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-gray-600 uppercase">Season</label>
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newWashPrice.season || ''}
                      onChange={e => setNewWashPrice({ ...newWashPrice, season: e.target.value })}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-gray-600 uppercase">Price pcs</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newWashPrice.washPricePcs || 0}
                      onChange={e => {
                        const pcs = parseFloat(e.target.value) || 0;
                        setNewWashPrice({ ...newWashPrice, washPricePcs: pcs, washPriceDoz: pcs * 12 });
                      }}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-gray-600 uppercase">Price doz</label>
                    <input
                      type="number"
                      step="0.01"
                      readOnly
                      className="w-full border border-gray-300 rounded px-3 py-1 text-sm bg-gray-50 outline-none"
                      value={newWashPrice.washPriceDoz || 0}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingWashPrice(false)}
                      className="px-6 py-1 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : (editingWashPriceId ? 'Update Price' : 'Save Price')}
                  </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Wash Price Confirmation Modal */}
      <AnimatePresence>
        {deletingWashPriceId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Delete</h3>
                <p className="text-gray-600 mb-6">Are you sure you want to delete this wash price entry? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeletingWashPriceId(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDeleteWashPrice}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Wash Price Confirmation Modal */}
      <AnimatePresence>
        {isBulkDeletingWashPrice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Bulk Delete</h3>
                <p className="text-gray-600 mb-6">Are you sure you want to delete {selectedWashPriceIds.length} selected wash price entries? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsBulkDeletingWashPrice(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmBulkDeleteWashPrices}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    Delete All
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Paste from Excel Modal */}
      <AnimatePresence>
        {isPasting && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="bg-emerald-600 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-bold">Paste from Excel</h2>
                <button onClick={() => setIsPasting(false)} className="hover:text-emerald-200">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Copy rows from Excel and paste them below. Ensure the columns match the table structure:
                  <br />
                  <span className="text-[10px] font-mono bg-gray-100 p-1 block mt-2">
                    Contract No | PO No | Item | Buyer | Style | Color | Season | Qty | Price Pcs | Price Doz | B/P | W/O | Date
                  </span>
                </p>
                <textarea
                  className="w-full h-64 border border-gray-300 rounded p-3 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Paste here..."
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsPasting(false)}
                    className="px-6 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePaste}
                    disabled={isImporting}
                    className="px-6 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                  >
                    {isImporting ? "Importing..." : "Import Data"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="bg-blue-600 text-white px-6 py-4 flex shrink-0 justify-between items-center">
                <h2 className="text-lg font-bold">{editingId ? 'Edit Data Entry' : 'New Data Entry'}</h2>
                <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="hover:text-blue-200">✕</button>
              </div>
              <div className="overflow-y-auto flex-1">
                <form onSubmit={handleAddOrder} className="p-4 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Contract No</label>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.contractNo || ''}
                    onChange={e => setNewOrder({ ...newOrder, contractNo: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">PO No</label>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.poNo || ''}
                    onChange={e => setNewOrder({ ...newOrder, poNo: e.target.value })}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">Item</label>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.item || ''}
                    onChange={e => setNewOrder({ ...newOrder, item: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Buyer</label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.buyer || ''}
                    onChange={e => setNewOrder({ ...newOrder, buyer: e.target.value })}
                  >
                    {buyers.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Style Name</label>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.styleName || ''}
                    onChange={e => setNewOrder({ ...newOrder, styleName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Color</label>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.color || ''}
                    onChange={e => setNewOrder({ ...newOrder, color: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Season</label>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.season || ''}
                    onChange={e => setNewOrder({ ...newOrder, season: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Order Qty</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.orderQty || 0}
                    onChange={e => setNewOrder({ ...newOrder, orderQty: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Price pcs</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.washPricePcs || 0}
                    onChange={e => {
                      const pcs = parseFloat(e.target.value) || 0;
                      setNewOrder({ ...newOrder, washPricePcs: pcs, washPriceDoz: pcs * 12 });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Price doz</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.washPriceDoz || 0}
                    onChange={e => setNewOrder({ ...newOrder, washPriceDoz: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">B/P</label>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.bp || ''}
                    onChange={e => setNewOrder({ ...newOrder, bp: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">W/O</label>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.wo || ''}
                    onChange={e => setNewOrder({ ...newOrder, wo: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Shipment Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOrder.shipmentDate || ''}
                    onChange={e => setNewOrder({ ...newOrder, shipmentDate: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingId(null); }}
                    className="px-6 py-1 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : (editingId ? 'Update Entry' : 'Save Entry')}
                  </button>
                </div>
              </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-300 px-4 py-2 text-[10px] text-gray-500 flex justify-between">
        <span>Garment Order Management System v1.0</span>
        <span>© 2026 Manufacturing Solutions Inc.</span>
      </footer>
    </div>
  );
}
