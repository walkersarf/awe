import { NextResponse } from 'next/server';
import { getExpenses, saveExpense, getExpenseByDate, getOpeningBalanceForDate } from '@/lib/db';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const type = searchParams.get('type');

    if (type === 'opening-balance' && date) {
        const { amount, date: balanceDate } = getOpeningBalanceForDate(date);
        return NextResponse.json({ openingBalance: amount, balanceDate });
    }

    if (date) {
        const expense = getExpenseByDate(date);
        return NextResponse.json(expense || null);
    }

    const expenses = getExpenses();
    return NextResponse.json(expenses);
}

export async function POST(request) {
    try {
        const body = await request.json();

        // Server-side validation could go here

        // If saving a new record, ensure we default status to 'pending' if not provided
        // If it's an update validation, keep existing status unless specified

        const saved = saveExpense(body);
        return NextResponse.json(saved);
    } catch (err) {
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}

export async function DELETE(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
        return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    try {
        const { deleteExpense } = await import('@/lib/db');
        deleteExpense(date);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
