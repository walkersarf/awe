import fs from 'fs';
import path from 'path';
import { subDays, format } from 'date-fns';

const DB_PATH = path.join(process.cwd(), 'data', 'expenses.json');

// Ensure DB file exists
function ensureDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
    }
}

export function getExpenses() {
    ensureDB();
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
}

export function saveExpense(expense) {
    ensureDB();
    const expenses = getExpenses();
    const index = expenses.findIndex(e => e.date === expense.date);

    if (index >= 0) {
        expenses[index] = { ...expenses[index], ...expense };
    } else {
        expenses.push(expense);
    }

    // Sort by date descending
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync(DB_PATH, JSON.stringify(expenses, null, 2));
    return expense;
}

export function deleteExpense(date) {
    ensureDB();
    const expenses = getExpenses();
    const newExpenses = expenses.filter(e => e.date !== date);
    fs.writeFileSync(DB_PATH, JSON.stringify(newExpenses, null, 2));
    return true;
}

export function getExpenseByDate(date) {
    const expenses = getExpenses();
    return expenses.find(e => e.date === date);
}

export function getOpeningBalanceForDate(dateStr) {
    const expenses = getExpenses();

    // Try to find exact previous day
    const targetDate = new Date(dateStr);
    const prevDate = subDays(targetDate, 1);
    const prevDateStr = format(prevDate, 'yyyy-MM-dd');

    const prevRecord = expenses.find(e => e.date === prevDateStr);

    if (prevRecord) {
        return { amount: prevRecord.closing || 0, date: prevRecord.date };
    }

    // If no exact previous day, find the most recent past record
    const curDateObj = new Date(dateStr);
    const sortedPast = expenses
        .filter(e => new Date(e.date) < curDateObj)
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Descending

    if (sortedPast.length > 0) {
        return { amount: sortedPast[0].closing || 0, date: sortedPast[0].date };
    }

    return { amount: 0, date: null };
}

// User Management
const USERS_DB_PATH = path.join(process.cwd(), 'data', 'users.json');

function ensureUsersDB() {
    if (!fs.existsSync(USERS_DB_PATH)) {
        const defaultUsers = [
            { username: 'admin', password: 'admin123', role: 'admin', lastLogin: null },
            { username: 'user', password: 'user123', role: 'employee', lastLogin: null }
        ];
        fs.writeFileSync(USERS_DB_PATH, JSON.stringify(defaultUsers, null, 2));
    }
}

export function getUsers() {
    ensureUsersDB();
    const data = fs.readFileSync(USERS_DB_PATH, 'utf-8');
    return JSON.parse(data);
}

export function saveUser(user) {
    ensureUsersDB();
    const users = getUsers();
    const index = users.findIndex(u => u.username === user.username);

    if (index >= 0) {
        users[index] = { ...users[index], ...user };
    } else {
        users.push(user);
    }

    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
    return user;
}

export function getUser(username) {
    const users = getUsers();
    return users.find(u => u.username === username);
}
