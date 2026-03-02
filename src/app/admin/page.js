"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CheckCircle, Lock, Edit3, Trash2, ArrowLeft, Search, Filter, Download, Loader2, LogOut, Users, FileText, Save, Key, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminPortal() {
    const [expenses, setExpenses] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'employees'

    // User management state
    const [editingUser, setEditingUser] = useState(null);
    const [newPassword, setNewPassword] = useState("");

    // Create User State
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'employee' });

    // Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportStartDate, setExportStartDate] = useState("");
    const [exportEndDate, setExportEndDate] = useState("");

    const router = useRouter();

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            router.push('/');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    useEffect(() => {
        fetchExpenses();
        fetchUsers();
    }, []);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/expenses');
            const data = await res.json();
            setExpenses(data);
        } catch (error) {
            console.error("Failed to fetch expenses", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
        }
    };

    const updateStatus = async (expense, newStatus) => {
        try {
            const updatedExpense = { ...expense, status: newStatus };
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedExpense)
            });

            if (res.ok) {
                // Optimistic update
                setExpenses(expenses.map(e => e.date === expense.date ? updatedExpense : e));
            }
        } catch (error) {
            console.error("Failed to update status", error);
            alert("Failed to update status");
        }
    };

    const handleEdit = (date) => {
        router.push(`/employee?date=${date}`);
    };

    const handleDelete = async (date) => {
        if (!confirm(`Are you sure you want to delete the record for ${date}? This cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/expenses?date=${date}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setExpenses(expenses.filter(e => e.date !== date));
            } else {
                alert("Failed to delete record");
            }
        } catch (error) {
            console.error("Failed to delete", error);
            alert("Error deleting record");
        }
    };

    const handlePasswordUpdate = async (username) => {
        if (!newPassword) return;

        try {
            const user = users.find(u => u.username === username);
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...user, password: newPassword })
            });

            if (res.ok) {
                alert("Password updated successfully");
                setEditingUser(null);
                setNewPassword("");
                fetchUsers();
            } else {
                alert("Failed to update password");
            }
        } catch (error) {
            console.error("Failed to update password", error);
            alert("Error updating password");
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.password) {
            alert("Please provide username and password");
            return;
        }

        try {
            // Check if user exists check is implicitly handled by upsert, but we might want to warn
            // For now, let's just create/overwrite

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: newUser.username,
                    password: newUser.password,
                    role: newUser.role,
                    lastLogin: null
                })
            });

            if (res.ok) {
                alert("User created successfully");
                setIsCreatingUser(false);
                setNewUser({ username: '', password: '', role: 'employee' });
                fetchUsers();
            } else {
                alert("Failed to create user");
            }
        } catch (error) {
            console.error("Failed to create user", error);
            alert("Error creating user");
        }
    };

    const handleExportClick = () => {
        setShowExportModal(true);
        // Default to current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setExportStartDate(format(firstDay, 'yyyy-MM-dd'));
        setExportEndDate(format(now, 'yyyy-MM-dd'));
    };

    const downloadCSV = async (filterByDate = false) => {
        if (expenses.length === 0) {
            alert("No data to export");
            return;
        }

        let expensesToExport = [...expenses];

        if (filterByDate && exportStartDate && exportEndDate) {
            expensesToExport = expensesToExport.filter(e => {
                return e.date >= exportStartDate && e.date <= exportEndDate;
            });
        }

        if (expensesToExport.length === 0) {
            alert("No records found for the selected range");
            return;
        }

        // Define headers
        const headers = ["Date", "Category", "Details", "Amount", "Comment", "Status"];
        const rows = [];

        // Sort expenses by date if not already
        const sortedExpenses = expensesToExport.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Fetch detailed data for each day to populate CSV properly (since summary only has aggregates)
        for (const basicRecord of sortedExpenses) {
            try {
                const res = await fetch(`/api/expenses?date=${basicRecord.date}`);
                if (!res.ok) continue;
                const record = await res.json();
                if (!record) continue;

                const date = record.date;
                const status = record.status;

                // Opening Balance
                rows.push([date, "Opening Balance", "Balance B/F", record.opening || 0, "", status]);

                // Credits
                if (record.creditBank > 0) {
                    rows.push([date, "Credit", "Bank Deposit", record.creditBank, record.creditBankComment || "", status]);
                }
                if (record.creditOthers > 0) {
                    rows.push([date, "Credit", "Cash Deposit", record.creditOthers, record.creditOthersComment || "", status]);
                }

                // Debits - Labor
                if (record.laborDebits) {
                    record.laborDebits.forEach(item => {
                        if (item.amount > 0) {
                            rows.push([date, "Debit", "Labor Bill - Labor Payment", -Math.abs(item.amount), item.comment || "", status]);
                        }
                    });
                }

                // Debits - Truck
                if (record.truckDebits) {
                    record.truckDebits.forEach(item => {
                        if (item.amount > 0) {
                            rows.push([date, "Debit", `Truck Expense - ${item.truckNo || "Truck"}`, -Math.abs(item.amount), item.comment || "", status]);
                        }
                    });
                }

                // Debits - Transport
                if (record.transportDebits) {
                    record.transportDebits.forEach(item => {
                        if (item.amount > 0) {
                            rows.push([date, "Debit", `DIC Transport - ${item.details || "Transport"}`, -Math.abs(item.amount), item.comment || "", status]);
                        }
                    });
                }

                // Debits - Diesel
                if (record.dieselDebits) {
                    record.dieselDebits.forEach(item => {
                        if (item.amount > 0) {
                            rows.push([date, "Debit", `Generator Diesel - ${item.details || "Diesel"}`, -Math.abs(item.amount), item.comment || "", status]);
                        }
                    });
                }

                // Debits - Other
                if (record.debits) {
                    record.debits.forEach(item => {
                        if (item.amount > 0) {
                            rows.push([date, "Debit", `Other Expense - ${item.details || "Expense"}`, -Math.abs(item.amount), item.comment || "", status]);
                        }
                    });
                }

                // Closing Balance
                rows.push([date, "Closing Balance", "Balance C/F", record.closing || 0, "", status]);

                // Empty row separator
                rows.push(["", "", "", "", "", ""]);
            } catch (err) {
                console.error("Failed to fetch detailed record for export", err);
            }
        }

        const csvContent = [
            headers.join(","),
            ...rows.map(e => e.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `expenses_export_${format(new Date(), "yyyy-MM-dd")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowExportModal(false);
    };

    // Filter logic
    const filtered = expenses.filter(exp => exp.date.includes(searchTerm));

    // Stats
    const latestRecord = expenses.length > 0 ? expenses[0] : null; // Sorted by date desc in API
    const currentBalance = latestRecord?.closing || 0;

    const pendingCount = expenses.filter(e => e.status !== 'locked').length;
    const monthCredit = expenses.reduce((acc, curr) => {
        // varied logic for 'this month', keeping simple for now
        return acc + (curr.credit || 0);
    }, 0);

    // Helper to check for mismatch
    const getBalanceMismatch = (row) => {
        // Find immediate previous record (chronologically)
        // Expenses are sorted desc, so previous record is index + 1
        // But we need to use the full expenses array for continuity check, not filtered
        const index = expenses.findIndex(e => e.date === row.date);
        if (index === -1 || index === expenses.length - 1) return false; // No previous record

        const prevRecord = expenses[index + 1];
        // Compare current opening with previous closing
        // Use small epsilon for float comparison safety
        return Math.abs((row.opening || 0) - (prevRecord.closing || 0)) > 0.01;
    };

    return (
        <div className="min-h-screen bg-slate-900 p-6 md:p-12 text-slate-100 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/" className="inline-flex items-center text-slate-400 hover:text-indigo-400 mb-2 transition-colors">
                            {/* <ArrowLeft size={16} className="mr-2" /> Back to Login  -- No longer needed as we have logout */}
                        </Link>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-teal-400">
                            Admin Dashboard
                        </h1>
                        <p className="text-slate-400">Review and approve daily expense reports</p>
                    </div>

                    <div className="flex gap-3">
                        <button className="btn btn-primary bg-indigo-600 hover:bg-indigo-700" onClick={handleExportClick}>
                            <Download size={18} className="mr-2 inline" /> Export CSV
                        </button>
                        <button className="btn btn-secondary" onClick={fetchExpenses}>
                            Refresh Data
                        </button>
                        <button className="btn btn-secondary text-slate-300 hover:text-white" onClick={handleLogout} title="Logout">
                            <LogOut size={18} />
                        </button>
                    </div>
                </header>

                {/* Tab Navigation */}
                <div className="flex gap-4 border-b border-slate-700">
                    <button
                        onClick={() => setActiveTab('ledger')}
                        className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'ledger'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                            }`}
                    >
                        <FileText size={16} /> Ledger View
                    </button>
                    <button
                        onClick={() => setActiveTab('employees')}
                        className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'employees'
                            ? 'border-pink-500 text-pink-400'
                            : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                            }`}
                    >
                        <Users size={16} /> Manage Employee
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                    </div>
                ) : (
                    <>
                        {activeTab === 'ledger' && (
                            <>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                                    <div className="glass-panel p-6 border-l-4 border-indigo-500">
                                        <span className="text-slate-400 text-sm uppercase font-bold">Current Balance</span>
                                        <p className="text-3xl font-mono font-bold mt-2 text-white">{currentBalance.toFixed(2)}</p>
                                    </div>
                                    <div className="glass-panel p-6 border-l-4 border-pink-500">
                                        <span className="text-slate-400 text-sm uppercase font-bold">Pending Approvals</span>
                                        <p className="text-3xl font-mono font-bold mt-2 text-pink-400">{pendingCount}</p>
                                    </div>
                                    <div className="glass-panel p-6 border-l-4 border-teal-500">
                                        <span className="text-slate-400 text-sm uppercase font-bold">Total Credit (All Time)</span>
                                        <p className="text-3xl font-mono font-bold mt-2 text-teal-400">{monthCredit.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Table Section */}
                                <div className="glass-panel overflow-hidden animate-fade-in">
                                    {/* Toolbar */}
                                    <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center">
                                        <h2 className="text-xl font-semibold">Expense Register</h2>
                                        <div className="relative w-full sm:w-64">
                                            <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search by date..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="input-field pl-10 py-2"
                                            />
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-800/50 text-slate-400 text-sm uppercase tracking-wider">
                                                    <th className="p-4 font-semibold border-b border-slate-700">Date</th>
                                                    <th className="p-4 font-semibold border-b border-slate-700 text-right">Opening</th>
                                                    <th className="p-4 font-semibold border-b border-slate-700 text-right">Credit</th>
                                                    <th className="p-4 font-semibold border-b border-slate-700 text-right">Debit</th>
                                                    <th className="p-4 font-semibold border-b border-slate-700 text-right">Closing</th>
                                                    <th className="p-4 font-semibold border-b border-slate-700 text-center">Status</th>
                                                    <th className="p-4 font-semibold border-b border-slate-700 text-right w-48">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700">
                                                {filtered.map((row) => {
                                                    const isMismatch = getBalanceMismatch(row);
                                                    return (
                                                        <tr key={row.date} className="hover:bg-slate-800/30 transition-colors">
                                                            <td className="p-4 font-medium text-white">{row.date}</td>
                                                            <td className={`p-4 text-right font-mono ${isMismatch ? 'text-red-500 font-bold' : 'text-slate-300'}`} title={isMismatch ? "Opening balance mismatch with previous day closing" : ""}>
                                                                {(row.opening || 0).toFixed(2)}
                                                                {isMismatch && <span className="ml-2 text-xs text-red-500">⚠</span>}
                                                            </td>
                                                            <td className="p-4 text-right font-mono text-emerald-400">+{(row.credit || 0).toFixed(2)}</td>
                                                            <td className="p-4 text-right font-mono text-pink-400">-{(row.debit || 0).toFixed(2)}</td>
                                                            <td className="p-4 text-right font-mono font-bold text-white">{(row.closing || 0).toFixed(2)}</td>
                                                            <td className="p-4 text-center">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.status === 'locked'
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                                                    }`}>
                                                                    {row.status === 'locked' ? 'Approved' : 'Pending'}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {row.status !== 'locked' ? (
                                                                        <button
                                                                            onClick={() => updateStatus(row, 'locked')}
                                                                            className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
                                                                            title="Approve & Lock"
                                                                        >
                                                                            <CheckCircle size={18} />
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => updateStatus(row, 'pending')}
                                                                            className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors"
                                                                            title="Unlock"
                                                                        >
                                                                            <Lock size={18} />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleEdit(row.date)}
                                                                        className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
                                                                        title="Edit Record"
                                                                    >
                                                                        <Edit3 size={18} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(row.date)}
                                                                        className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                                                        title="Delete Record"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {filtered.length === 0 && (
                                        <div className="p-12 text-center text-slate-500">
                                            <p>No records found matching your criteria.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {activeTab === 'employees' && (
                            <div className="glass-panel overflow-hidden animate-fade-in">
                                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-semibold">Employee Management</h2>
                                        <p className="text-slate-400 text-sm mt-1">View and manage system access.</p>
                                    </div>
                                    <button
                                        onClick={() => setIsCreatingUser(true)}
                                        className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 text-sm px-4 py-2"
                                    >
                                        <Plus size={16} className="mr-2 inline" /> Add User
                                    </button>
                                </div>

                                {isCreatingUser && (
                                    <div className="p-6 border-b border-white/10 bg-indigo-500/5 animate-fade-in">
                                        <h3 className="text-md font-semibold text-white mb-4">Add New User</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
                                                <input
                                                    type="text"
                                                    value={newUser.username}
                                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                                    className="input-field w-full"
                                                    placeholder="e.g. johndoe"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                                                <input
                                                    type="text"
                                                    value={newUser.password}
                                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                                    className="input-field w-full"
                                                    placeholder="Secret password"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                                                <select
                                                    value={newUser.role}
                                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                                    className="input-field w-full bg-slate-800"
                                                >
                                                    <option value="employee">Employee</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleCreateUser}
                                                    className="btn bg-emerald-600 hover:bg-emerald-500 text-white flex-1"
                                                >
                                                    <Save size={16} className="mr-2 inline" /> Save
                                                </button>
                                                <button
                                                    onClick={() => setIsCreatingUser(false)}
                                                    className="btn bg-slate-700 hover:bg-slate-600 text-white"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800/50 text-slate-400 text-sm uppercase tracking-wider">
                                                <th className="p-4 font-semibold border-b border-slate-700">Role</th>
                                                <th className="p-4 font-semibold border-b border-slate-700">Username</th>
                                                <th className="p-4 font-semibold border-b border-slate-700">Current Password</th>
                                                <th className="p-4 font-semibold border-b border-slate-700">Last Login</th>
                                                <th className="p-4 font-semibold border-b border-slate-700 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {users.map((user) => (
                                                <tr key={user.username} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${user.role === 'admin'
                                                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                            : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                                                            }`}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-medium text-white">{user.username}</td>
                                                    <td className="p-4 font-mono text-slate-400">
                                                        {editingUser === user.username ? (
                                                            <input
                                                                type="text"
                                                                value={newPassword}
                                                                onChange={(e) => setNewPassword(e.target.value)}
                                                                className="input-field py-1 px-2 w-32 text-sm"
                                                                placeholder="New pass..."
                                                            />
                                                        ) : (
                                                            user.password
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-slate-400 text-sm">
                                                        {user.lastLogin
                                                            ? format(new Date(user.lastLogin), "MMM d, yyyy h:mm a")
                                                            : <span className="text-slate-600 italic">Never</span>}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {editingUser === user.username ? (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handlePasswordUpdate(user.username)}
                                                                    className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
                                                                    title="Save Password"
                                                                >
                                                                    <Save size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingUser(null);
                                                                        setNewPassword("");
                                                                    }}
                                                                    className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors"
                                                                    title="Cancel"
                                                                >
                                                                    <ArrowLeft size={18} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingUser(user.username);
                                                                    setNewPassword(user.password);
                                                                }}
                                                                className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-colors"
                                                                title="Change Password"
                                                            >
                                                                <Key size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-md animate-fade-in shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Export Options</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={exportStartDate}
                                    onChange={(e) => setExportStartDate(e.target.value)}
                                    className="input-field w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={exportEndDate}
                                    onChange={(e) => setExportEndDate(e.target.value)}
                                    className="input-field w-full"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => downloadCSV(true)}
                                    className="flex-1 btn bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    Export Selected Range
                                </button>
                                <button
                                    onClick={() => downloadCSV(false)}
                                    className="flex-1 btn bg-slate-700 hover:bg-slate-600 text-white"
                                >
                                    Export All
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
