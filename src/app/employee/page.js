"use client";

import { Suspense, useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, Save, Lock, ArrowLeft, Trash2, Loader2, Edit2, Check, LogOut, Calculator } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

const evaluateFormula = (val) => {
    if (typeof val === 'string' && val.startsWith('=')) {
        try {
            const sanitized = val.slice(1).replace(/[^0-9+\-*/. ]/g, '');
            if (!sanitized) return val;
            const result = new Function(`return ${sanitized}`)();
            return isNaN(result) ? val : String(result);
        } catch (e) {
            return val;
        }
    }
    return val;
};

function EmployeePortalContent() {
    const searchParams = useSearchParams();
    const queryDate = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState(queryDate || format(new Date(), "yyyy-MM-dd"));
    const [isLocked, setIsLocked] = useState(false);

    const router = useRouter();

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            router.push('/');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingOpening, setIsEditingOpening] = useState(false);

    // Ledger State
    const [previousBalance, setPreviousBalance] = useState("");
    const [lastBalanceDate, setLastBalanceDate] = useState(null);
    const [credits, setCredits] = useState({
        bank: "",
        others: ""
    });
    const [creditComments, setCreditComments] = useState({
        bank: "",
        others: ""
    });
    const [debits, setDebits] = useState([
        { id: 1, details: "", amount: "", comment: "" }
    ]);
    // Labor Bill State
    const [laborDebits, setLaborDebits] = useState([
        { id: "labor-1", date: format(new Date(), "yyyy-MM-dd"), amount: "", comment: "" }
    ]);
    // Truck Bill State
    const [truckDebits, setTruckDebits] = useState([
        { id: "truck-1", truckNo: "", amount: "", comment: "" }
    ]);
    // DIC Transport State
    // DIC Transport State (Single Object in Array for compat)
    const [transportDebits, setTransportDebits] = useState([
        { id: `transport-fixed`, details: "DIC Transport", amount: "", comment: "" }
    ]);
    // Generator Diesel State (Single Object in Array for compat)
    const [dieselDebits, setDieselDebits] = useState([
        { id: `diesel-fixed`, details: "Generator Diesel", amount: "", comment: "" }
    ]);

    // Derived state
    const totalCredit = parseFloat(credits.bank || 0) + parseFloat(credits.others || 0);
    const totalRegularDebit = debits.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const totalLaborDebit = laborDebits.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const totalTruckDebit = truckDebits.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const totalTransportDebit = transportDebits.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const totalDieselDebit = dieselDebits.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const totalDebit = totalRegularDebit + totalLaborDebit + totalTruckDebit + totalTransportDebit + totalDieselDebit;

    const closingBalance = parseFloat(previousBalance || 0) + totalCredit - totalDebit;

    const truckOptions = [
        "BSL DA 11-0122",
        "BSL TA 11-0218",
        "DM DA 12-2819",
        "DM NA 11-8898",
        "Dhaka/Tongi Truck",
        "Others"
    ];

    // Fetch data on date change
    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // 1. Try to get existing record
                const res = await fetch(`/api/expenses?date=${selectedDate}`);
                const data = await res.json();

                if (data && data.date) {
                    // Populate form with existing data
                    setPreviousBalance(data.opening || "");
                    setLastBalanceDate(null); // It's an existing record, opening balance is fixed
                    setCredits({ bank: data.creditBank || "", others: data.creditOthers || "" });
                    setCreditComments({ bank: data.creditBankComment || "", others: data.creditOthersComment || "" });
                    setDebits(data.debits || [{ id: Date.now(), details: "", amount: "", comment: "" }]);

                    // Populate Labor Bill data or initialize default
                    if (data.laborDebits && data.laborDebits.length > 0) {
                        setLaborDebits(data.laborDebits);
                    } else {
                        setLaborDebits([{ id: `labor-${Date.now()}`, date: selectedDate, amount: "", comment: "" }]);
                    }

                    // Populate Truck Bill data
                    if (data.truckDebits && data.truckDebits.length > 0) {
                        setTruckDebits(data.truckDebits);
                    } else {
                        setTruckDebits([{ id: `truck-${Date.now()}`, truckNo: "", amount: "", comment: "" }]);
                    }

                    // Populate DIC Transport data
                    if (data.transportDebits && data.transportDebits.length > 0) {
                        setTransportDebits(data.transportDebits);
                    } else {
                        setTransportDebits([{ id: `transport-fixed`, details: "DIC Transport", amount: "", comment: "" }]);
                    }

                    // Populate Generator Diesel data
                    if (data.dieselDebits && data.dieselDebits.length > 0) {
                        setDieselDebits(data.dieselDebits);
                    } else {
                        setDieselDebits([{ id: `diesel-fixed`, details: "Generator Diesel", amount: "", comment: "" }]);
                    }

                    setIsLocked(data.status === 'locked');
                } else {
                    // 2. No record? Fetch opening balance from previous day
                    const balRes = await fetch(`/api/expenses?date=${selectedDate}&type=opening-balance`);
                    const balData = await balRes.json();

                    setPreviousBalance(balData.openingBalance || "");
                    setLastBalanceDate(balData.balanceDate);
                    setCredits({ bank: "", others: "" });
                    setCreditComments({ bank: "", others: "" });
                    setDebits([{ id: Date.now(), details: "", amount: "", comment: "" }]);
                    setLaborDebits([{ id: `labor-${Date.now()}`, date: selectedDate, amount: "", comment: "" }]);
                    setTruckDebits([{ id: `truck-${Date.now()}`, truckNo: "", amount: "", comment: "" }]);
                    setTransportDebits([{ id: `transport-fixed`, details: "DIC Transport", amount: "", comment: "" }]);
                    setDieselDebits([{ id: `diesel-fixed`, details: "Generator Diesel", amount: "", comment: "" }]);
                    setIsLocked(false);
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
                alert("Error loading data. Please try again.");
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [selectedDate]);

    // Regular Debit Handlers
    const addDebitRow = () => {
        setDebits([...debits, { id: Date.now(), details: "", amount: "", comment: "" }]);
    };

    const removeDebitRow = (id) => {
        if (debits.length > 1) {
            setDebits(debits.filter(d => d.id !== id));
        }
    };

    const updateDebit = (id, field, value) => {
        setDebits(debits.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    // Labor Bill Handlers
    const addLaborRow = () => {
        setLaborDebits([...laborDebits, { id: `labor-${Date.now()}`, date: selectedDate, amount: "", comment: "" }]);
    };

    const removeLaborRow = (id) => {
        if (laborDebits.length > 1) {
            setLaborDebits(laborDebits.filter(d => d.id !== id));
        }
    };

    const updateLabor = (id, field, value) => {
        setLaborDebits(laborDebits.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    // Truck Bill Handlers
    const addTruckRow = () => {
        setTruckDebits([...truckDebits, { id: `truck-${Date.now()}`, truckNo: "", amount: "", comment: "" }]);
    };

    const removeTruckRow = (id) => {
        if (truckDebits.length > 1) {
            setTruckDebits(truckDebits.filter(d => d.id !== id));
        }
    };

    const updateTruck = (id, field, value) => {
        setTruckDebits(truckDebits.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    // DIC Transport Handler (Fixed Single Row)
    const updateTransport = (field, value) => {
        const newDebits = [...transportDebits];
        newDebits[0] = { ...newDebits[0], [field]: value };
        setTransportDebits(newDebits);
    };

    // Generator Diesel Handler (Fixed Single Row)
    const updateDiesel = (field, value) => {
        const newDebits = [...dieselDebits];
        newDebits[0] = { ...newDebits[0], [field]: value };
        setDieselDebits(newDebits);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLocked) return;

        setIsSaving(true);
        const payload = {
            date: selectedDate,
            opening: previousBalance,
            creditBank: credits.bank,
            creditBankComment: creditComments.bank,
            creditOthers: credits.others,
            creditOthersComment: creditComments.others,
            credit: totalCredit,
            debits,
            laborDebits, // Add Labor Bill data
            truckDebits, // Add Truck data
            transportDebits, // Add DIC Transport data
            dieselDebits, // Add Generator Diesel data
            debit: totalDebit,
            closing: closingBalance,
            status: 'pending' // Default status
        };

        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save');

            alert("Expense Report Saved Successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to save report.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-6 md:p-12 text-slate-100 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/" className="inline-flex items-center text-slate-400 hover:text-indigo-400 mb-2 transition-colors">
                            {/* <ArrowLeft size={16} className="mr-2" /> Back to Login -- No longer needed */}
                        </Link>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-indigo-400">
                            Daily Expense Entry
                        </h1>
                    </div>

                    <div className="glass-panel px-4 py-2 flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <label className="text-sm text-slate-400 font-medium">Select Date: </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none font-medium text-lg"
                            />
                        </div>
                        <button className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white p-2 rounded-lg transition-colors ml-2" onClick={handleLogout} title="Logout">
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                    </div>
                ) : (
                    <>
                        {/* Status Banner */}
                        {isLocked && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 animate-fade-in text-sm">
                                <Lock size={16} />
                                <span className="font-semibold">Locked by Admin.</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="animate-fade-in">
                            <div className="glass-panel overflow-hidden border border-white/10 rounded-xl">
                                <table className="w-full text-left border-collapse">
                                    <tbody className="divide-y divide-white/10 text-sm">

                                        {/* Opening Balance Section */}
                                        <tr>
                                            <td className="p-6 text-2xl font-black tracking-wide text-indigo-300 bg-indigo-500/10 border-y border-white/10 align-middle w-1/3">
                                                1. OPENING BALANCE
                                                {lastBalanceDate && <span className="text-sm font-normal text-indigo-400 ml-3"> (from {lastBalanceDate})</span>}
                                            </td>
                                            <td className="p-0 bg-indigo-500/10 border-y border-white/10 relative group w-1/3">
                                                {isEditingOpening && !isLocked ? (
                                                    <div className="flex items-center h-full w-full pr-4">
                                                        <input
                                                            type="text"
                                                            value={previousBalance}
                                                            onChange={(e) => setPreviousBalance(e.target.value)}
                                                            onBlur={(e) => setPreviousBalance(evaluateFormula(e.target.value))}
                                                            autoFocus
                                                            className="w-full h-full p-6 bg-transparent text-right font-mono text-2xl font-bold text-white focus:outline-none placeholder-slate-600"
                                                            placeholder="0.00"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsEditingOpening(false)}
                                                            className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                                                            title="Confirm Balance"
                                                        >
                                                            <Check size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end h-full w-full p-6 pr-6">
                                                        <span className="font-mono text-2xl font-bold text-white mr-4">
                                                            {parseFloat(previousBalance || 0).toFixed(2)}
                                                        </span>&nbsp;&nbsp;&nbsp;&nbsp;
                                                        {!isLocked && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsEditingOpening(true)}
                                                                className="p-2 text-slate-500 hover:text-indigo-300 hover:bg-white/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Edit Opening Balance"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-6 bg-indigo-500/10 border-y border-white/10 w-1/3"></td>
                                        </tr>

                                        {/* Credits Section */}
                                        <tr>
                                            <td className="p-6 text-2xl font-black tracking-wide text-emerald-300 bg-emerald-500/10 border-y border-white/10">
                                                2. CREDIT
                                            </td>
                                            <td className="p-6 text-right font-mono text-emerald-400 font-bold text-2xl bg-emerald-500/10 border-y border-white/10">
                                                {totalCredit.toFixed(2)}
                                            </td>
                                            <td className="p-6 bg-emerald-500/10 border-y border-white/10"></td>
                                        </tr>
                                        <tr className="bg-slate-800/20">
                                            <td className="p-4 pl-24 border-r border-white/10 text-lg text-slate-300">&nbsp;&nbsp;&nbsp;&nbsp;Received from Bank</td>
                                            <td className="p-0 border-r border-white/10">
                                                {isLocked ? (
                                                    <div className="w-full h-full p-4 text-right font-mono text-lg text-white opacity-100 flex items-center justify-end">
                                                        {credits.bank?.toFixed(2) || "0.00"}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={credits.bank}
                                                        onChange={(e) => setCredits({ ...credits, bank: e.target.value })}
                                                        onBlur={(e) => setCredits({ ...credits, bank: evaluateFormula(e.target.value) })}
                                                        disabled={isLocked}
                                                        className="w-full h-full p-4 bg-transparent text-right font-mono text-lg focus:bg-white/5 focus:outline-none"
                                                        placeholder="0.00"
                                                    />
                                                )}
                                            </td>
                                            <td className="p-0">
                                                {isLocked ? (
                                                    <div className="w-full h-full p-4 text-lg text-slate-300 opacity-100 flex items-center">
                                                        {creditComments.bank || <span className="italic text-slate-500">No comment</span>}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={creditComments.bank}
                                                        onChange={(e) => setCreditComments({ ...creditComments, bank: e.target.value })}
                                                        disabled={isLocked}
                                                        className="w-full h-full p-4 bg-transparent text-lg text-slate-300 placeholder-slate-600 focus:bg-white/5 focus:outline-none"
                                                        placeholder="Comment..."
                                                        autoComplete="off"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-800/20">
                                            <td className="p-4 pl-32 border-r border-white/10 text-lg text-slate-300">&nbsp;&nbsp;&nbsp;&nbsp;Received Others</td>
                                            <td className="p-0 border-r border-white/10">
                                                {isLocked ? (
                                                    <div className="w-full h-full p-4 text-right font-mono text-lg text-white opacity-100 flex items-center justify-end">
                                                        {credits.others?.toFixed(2) || "0.00"}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={credits.others}
                                                        onChange={(e) => setCredits({ ...credits, others: e.target.value })}
                                                        onBlur={(e) => setCredits({ ...credits, others: evaluateFormula(e.target.value) })}
                                                        disabled={isLocked}
                                                        className="w-full h-full p-4 bg-transparent text-right font-mono text-lg focus:bg-white/5 focus:outline-none"
                                                        placeholder="0.00"
                                                    />
                                                )}
                                            </td>
                                            <td className="p-0">
                                                {isLocked ? (
                                                    <div className="w-full h-full p-4 text-lg text-slate-300 opacity-100 flex items-center">
                                                        {creditComments.others || <span className="italic text-slate-500">No comment</span>}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={creditComments.others}
                                                        onChange={(e) => setCreditComments({ ...creditComments, others: e.target.value })}
                                                        disabled={isLocked}
                                                        className="w-full h-full p-4 bg-transparent text-lg text-slate-300 placeholder-slate-600 focus:bg-white/5 focus:outline-none"
                                                        placeholder="Comment..."
                                                        autoComplete="off"
                                                    />
                                                )}
                                            </td>
                                        </tr>

                                        {/* Debits Section Header */}
                                        <tr>
                                            <td className="p-6 text-2xl font-black tracking-wide text-pink-300 bg-pink-500/10 border-y border-white/10">
                                                3. DEBIT
                                            </td>
                                            <td className="p-6 text-right font-mono text-pink-400 font-bold text-2xl bg-pink-500/10 border-y border-white/10">
                                                {totalDebit.toFixed(2)}
                                            </td>
                                            <td className="p-6 bg-pink-500/10 border-y border-white/10"></td>
                                        </tr>

                                        {/* Labor Bill Subsection */}
                                        <tr className="bg-pink-900/20">
                                            <td className="p-4 pl-8 font-bold text-pink-200 border-r border-white/10 flex justify-between items-center bg-pink-500/5">
                                                <span>A. Labor Bill</span>
                                                <button
                                                    type="button"
                                                    onClick={addLaborRow}
                                                    disabled={isLocked}
                                                    className="p-1 bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 rounded transition-colors"
                                                    title="Add Labor Row"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </td>
                                            <td className="p-4 bg-pink-500/5 border-r border-white/10"></td>
                                            <td className="p-4 bg-pink-500/5"></td>
                                        </tr>

                                        {laborDebits.map((item, index) => (
                                            <tr key={item.id} className="group bg-slate-800/20">
                                                <td className="p-0 pl-16 border-r border-white/10 relative">
                                                    {/* Delete Button for Labor Row */}
                                                    {!isLocked && laborDebits.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLaborRow(item.id)}
                                                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Delete Labor Row"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}

                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-lg text-slate-300 opacity-100 flex items-center gap-2">
                                                            <CalendarIcon size={16} className="text-slate-500" />
                                                            {item.date}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center h-full w-full px-4">
                                                            <CalendarIcon size={16} className="text-slate-500 mr-2" />
                                                            <input
                                                                type="date"
                                                                value={item.date}
                                                                onChange={(e) => updateLabor(item.id, 'date', e.target.value)}
                                                                disabled={isLocked}
                                                                className="bg-transparent text-lg text-slate-300 focus:outline-none w-full"
                                                            />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-0 border-r border-white/10">
                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-right font-mono text-lg text-white opacity-100 flex items-center justify-end">
                                                            {item.amount?.toFixed(2) || "0.00"}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={item.amount}
                                                            onChange={(e) => updateLabor(item.id, 'amount', e.target.value)}
                                                            onBlur={(e) => updateLabor(item.id, 'amount', evaluateFormula(e.target.value))}
                                                            disabled={isLocked}
                                                            className="w-full h-full p-4 bg-transparent text-right font-mono focus:bg-white/5 focus:outline-none"
                                                            placeholder="0.00"
                                                        />
                                                    )}
                                                </td>
                                                <td className="p-0">
                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-lg text-slate-300 opacity-100 flex items-center">
                                                            {item.comment || <span className="italic text-slate-500">No comment</span>}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={item.comment}
                                                            onChange={(e) => updateLabor(item.id, 'comment', e.target.value)}
                                                            disabled={isLocked}
                                                            className="w-full h-full p-4 bg-transparent text-lg text-slate-300 placeholder-slate-600 focus:bg-white/5 focus:outline-none"
                                                            placeholder="Comment..."
                                                            autoComplete="off"
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Truck Section */}
                                        <tr className="bg-pink-900/20">
                                            <td className="p-4 pl-8 font-bold text-pink-200 border-r border-white/10 flex justify-between items-center bg-pink-500/5">
                                                <span>B. Truck</span>
                                                <button
                                                    type="button"
                                                    onClick={addTruckRow}
                                                    disabled={isLocked}
                                                    className="p-1 bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 rounded transition-colors"
                                                    title="Add Truck Row"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </td>
                                            <td className="p-4 bg-pink-500/5 border-r border-white/10"></td>
                                            <td className="p-4 bg-pink-500/5"></td>
                                        </tr>

                                        {truckDebits.map((item, index) => (
                                            <tr key={item.id} className="group bg-slate-800/20">
                                                <td className="p-0 pl-16 border-r border-white/10 relative">
                                                    {!isLocked && truckDebits.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeTruckRow(item.id)}
                                                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Delete Truck Row"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}

                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-lg text-slate-300 flex items-center">
                                                            {item.truckNo || <span className="italic text-slate-500">Select Truck</span>}
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={item.truckNo}
                                                            onChange={(e) => updateTruck(item.id, 'truckNo', e.target.value)}
                                                            disabled={isLocked}
                                                            className="w-full h-full p-4 bg-transparent text-lg text-slate-300 focus:bg-white/5 focus:outline-none appearance-none"
                                                        >
                                                            <option value="" disabled className="bg-slate-800 text-slate-500">Select Truck</option>
                                                            {truckOptions.map(opt => (
                                                                <option key={opt} value={opt} className="bg-slate-800 text-slate-100">{opt}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="p-0 border-r border-white/10">
                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-right font-mono text-lg text-white opacity-100 flex items-center justify-end">
                                                            {item.amount?.toFixed(2) || "0.00"}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center w-full h-full relative">
                                                            <input
                                                                type="text"
                                                                value={item.amount}
                                                                onChange={(e) => updateTruck(item.id, 'amount', e.target.value)}
                                                                onBlur={(e) => updateTruck(item.id, 'amount', evaluateFormula(e.target.value))}
                                                                disabled={isLocked}
                                                                className="w-full h-full p-4 pr-12 bg-transparent text-right font-mono focus:bg-white/5 focus:outline-none"
                                                                placeholder="0.00"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => updateTruck(item.id, 'amount', evaluateFormula(item.amount))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                                                title="Calculate amount"
                                                            >
                                                                <Calculator size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-0">
                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-lg text-slate-300 flex items-center">
                                                            {item.comment || <span className="italic text-slate-500">No comment</span>}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={item.comment}
                                                            onChange={(e) => updateTruck(item.id, 'comment', e.target.value)}
                                                            disabled={isLocked}
                                                            className="w-full h-full p-4 bg-transparent text-lg text-slate-300 placeholder-slate-600 focus:bg-white/5 focus:outline-none"
                                                            placeholder="Comment..."
                                                            autoComplete="off"
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Other Debits Subsection */}
                                        {/* DIC Transport Section */}
                                        {/* DIC Transport Section (Fixed Row) */}
                                        <tr className="bg-slate-800/20">
                                            <td className="p-4 pl-32 border-r border-white/10 text-lg text-slate-300 font-medium">
                                                C. DIC Transport
                                            </td>
                                            <td className="p-0 border-r border-white/10">
                                                {isLocked ? (
                                                    <div className="w-full h-full p-4 text-right font-mono text-lg text-white opacity-100 flex items-center justify-end">
                                                        {transportDebits[0]?.amount?.toFixed(2) || "0.00"}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={transportDebits[0]?.amount}
                                                        onChange={(e) => updateTransport('amount', e.target.value)}
                                                        onBlur={(e) => updateTransport('amount', evaluateFormula(e.target.value))}
                                                        disabled={isLocked}
                                                        className="w-full h-full p-4 bg-transparent text-right font-mono focus:bg-white/5 focus:outline-none"
                                                        placeholder="0.00"
                                                    />
                                                )}
                                            </td>
                                            <td className="p-0">
                                                {isLocked ? (
                                                    <div className="w-full h-full p-4 text-lg text-slate-300 opacity-100 flex items-center">
                                                        {transportDebits[0]?.comment || <span className="italic text-slate-500">No comment</span>}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={transportDebits[0]?.comment || ""}
                                                        onChange={(e) => updateTransport('comment', e.target.value)}
                                                        disabled={isLocked}
                                                        className="w-full h-full p-4 bg-transparent text-lg text-slate-300 placeholder-slate-600 focus:bg-white/5 focus:outline-none"
                                                        placeholder="Comment..."
                                                        autoComplete="off"
                                                    />
                                                )}
                                            </td>
                                        </tr>

                                        {/* Generator Diesel Section (Fixed Row) */}
                                        <tr className="bg-slate-800/20">
                                            <td className="p-4 pl-32 border-r border-white/10 text-lg text-slate-300 font-medium">
                                                D. Generator Diesel
                                            </td>
                                            <td className="p-0 border-r border-white/10">
                                                {isLocked ? (
                                                    <div className="w-full h-full p-4 text-right font-mono text-lg text-white opacity-100 flex items-center justify-end">
                                                        {dieselDebits[0]?.amount?.toFixed(2) || "0.00"}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={dieselDebits[0]?.amount}
                                                        onChange={(e) => updateDiesel('amount', e.target.value)}
                                                        onBlur={(e) => updateDiesel('amount', evaluateFormula(e.target.value))}
                                                        disabled={isLocked}
                                                        className="w-full h-full p-4 bg-transparent text-right font-mono focus:bg-white/5 focus:outline-none"
                                                        placeholder="0.00"
                                                    />
                                                )}
                                            </td>
                                            <td className="p-0">
                                                {isLocked ? (
                                                    <div className="w-full h-full p-4 text-lg text-slate-300 opacity-100 flex items-center">
                                                        {dieselDebits[0]?.comment || <span className="italic text-slate-500">No comment</span>}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={dieselDebits[0]?.comment || ""}
                                                        onChange={(e) => updateDiesel('comment', e.target.value)}
                                                        disabled={isLocked}
                                                        className="w-full h-full p-4 bg-transparent text-lg text-slate-300 placeholder-slate-600 focus:bg-white/5 focus:outline-none"
                                                        placeholder="Comment..."
                                                        autoComplete="off"
                                                    />
                                                )}
                                            </td>
                                        </tr>

                                        {/* E. Other Expenses Section */}
                                        <tr className="bg-pink-900/20">
                                            <td className="p-4 pl-8 font-bold text-pink-200 border-r border-white/10 flex justify-between items-center bg-pink-500/5">
                                                <span>E. Other Expenses</span>
                                                <button
                                                    type="button"
                                                    onClick={addDebitRow}
                                                    disabled={isLocked}
                                                    className="p-1 bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 rounded transition-colors"
                                                    title="Add Expense Row"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </td>
                                            <td className="p-4 bg-pink-500/5 border-r border-white/10"></td>
                                            <td className="p-4 bg-pink-500/5"></td>
                                        </tr>

                                        {debits.map((item, index) => (
                                            <tr key={item.id} className="group bg-slate-800/20">
                                                <td className="p-0 pl-16 border-r border-white/10 relative">
                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-lg text-slate-300 opacity-100 flex items-center">
                                                            {item.details || <span className="italic text-slate-500">No details</span>}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={item.details}
                                                            onChange={(e) => updateDebit(item.id, 'details', e.target.value)}
                                                            disabled={isLocked}
                                                            className="w-full h-full p-4 bg-transparent text-lg text-slate-300 placeholder-slate-600 focus:bg-white/5 focus:outline-none"
                                                            placeholder="Expense details..."
                                                            autoComplete="off"
                                                        />
                                                    )}
                                                    {!isLocked && debits.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeDebitRow(item.id)}
                                                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Delete Row"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="p-0 border-r border-white/10">
                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-right font-mono text-lg text-white opacity-100 flex items-center justify-end">
                                                            {item.amount?.toFixed(2) || "0.00"}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={item.amount}
                                                            onChange={(e) => updateDebit(item.id, 'amount', e.target.value)}
                                                            onBlur={(e) => updateDebit(item.id, 'amount', evaluateFormula(e.target.value))}
                                                            disabled={isLocked}
                                                            className="w-full h-full p-4 bg-transparent text-right font-mono focus:bg-white/5 focus:outline-none"
                                                            placeholder="0.00"
                                                        />
                                                    )}
                                                </td>
                                                <td className="p-0">
                                                    {isLocked ? (
                                                        <div className="w-full h-full p-4 text-lg text-slate-300 opacity-100 flex items-center">
                                                            {item.comment || <span className="italic text-slate-500">No comment</span>}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={item.comment}
                                                            onChange={(e) => updateDebit(item.id, 'comment', e.target.value)}
                                                            disabled={isLocked}
                                                            className="w-full h-full p-4 bg-transparent text-lg text-slate-300 placeholder-slate-600 focus:bg-white/5 focus:outline-none"
                                                            placeholder="Comment..."
                                                            autoComplete="off"
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Closing Balance */}
                                        <tr>
                                            <td className="p-6 text-2xl font-black tracking-wide text-white bg-indigo-500/20 border-t-2 border-indigo-500/50">
                                                4. CLOSING BALANCE
                                            </td>
                                            <td className={`p-6 text-right font-mono text-3xl font-bold bg-indigo-500/20 border-t-2 border-indigo-500/50 ${closingBalance < 0 ? 'text-red-400' : 'text-white'}`}>
                                                {closingBalance.toFixed(2)}
                                            </td>
                                            <td className="p-6 bg-indigo-500/20 border-t-2 border-indigo-500/50"></td>
                                        </tr>

                                    </tbody>
                                </table>
                            </div>

                            {/* Submit Action */}
                            {!isLocked && (
                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="btn btn-primary text-base px-6 py-2 shadow-lg"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                        {isSaving ? 'Saving...' : 'Save Record'}
                                    </button>
                                </div>
                            )}
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

export default function EmployeePortal() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center p-6"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>}>
            <EmployeePortalContent />
        </Suspense>
    );
}
