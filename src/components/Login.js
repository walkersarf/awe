"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, User, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';

export default function Login() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null); // 'admin' | 'employee' | null
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');

    const handleRoleSelect = (role) => {
        setSelectedRole(role);
        setError('');
        setFormData({ username: '', password: '' });
    };

    const handleBack = () => {
        setSelectedRole(null);
        setError('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    password: formData.password,
                    type: selectedRole
                })
            });

            const data = await res.json();

            if (data.success) {
                router.push(selectedRole === 'admin' ? '/admin' : '/employee');
            } else {
                setError(data.message || 'Invalid credentials');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
            <div className="glass-panel w-full max-w-md p-8 animate-fade-in relative">

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-400 mb-2">
                        Al Wasi Enterprise
                    </h1>
                    <p className="text-slate-400">
                        {selectedRole ? `Login to ${selectedRole === 'admin' ? 'Admin' : 'Employee'} Portal` : 'Select your portal to continue'}
                    </p>
                </div>

                {!selectedRole ? (
                    // Role Selection
                    <div className="space-y-4">
                        <button
                            onClick={() => handleRoleSelect('admin')}
                            className="w-full group relative flex items-center justify-center gap-4 p-4 rounded-xl border border-slate-700 hover:border-indigo-500 bg-slate-800/50 hover:bg-slate-800 transition-all duration-300"
                        >
                            <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                <Shield size={24} />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className="font-semibold text-lg text-white group-hover:text-indigo-300 transition-colors">Admin Portal</h3>
                                <p className="text-sm text-slate-500">Manage expenses and approvals</p>
                            </div>
                            <ArrowRight className="text-slate-600 group-hover:text-white transition-colors" />
                        </button>

                        <button
                            onClick={() => handleRoleSelect('employee')}
                            className="w-full group relative flex items-center justify-center gap-4 p-4 rounded-xl border border-slate-700 hover:border-pink-500 bg-slate-800/50 hover:bg-slate-800 transition-all duration-300"
                        >
                            <div className="p-3 rounded-full bg-pink-500/10 text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                                <User size={24} />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className="font-semibold text-lg text-white group-hover:text-pink-300 transition-colors">Employee Portal</h3>
                                <p className="text-sm text-slate-500">Submit daily expense reports</p>
                            </div>
                            <ArrowRight className="text-slate-600 group-hover:text-white transition-colors" />
                        </button>
                    </div>
                ) : (
                    // Login Form
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="input-field w-full"
                                    placeholder="Enter username"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input-field w-full"
                                    placeholder="Enter password"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleBack}
                                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-white shadow-lg transition-all
                                    ${selectedRole === 'admin'
                                        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                                        : 'bg-pink-600 hover:bg-pink-500 shadow-pink-500/20'}
                                    ${loading ? 'opacity-70 cursor-wait' : ''}
                                `}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Login'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-8 text-center text-xs text-slate-600">
                    &copy; {new Date().getFullYear()} Al Wasi Enterprise. All rights reserved.
                </div>
            </div>
        </div>
    );
}
