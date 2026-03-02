import pool from '@/lib/mysql';
import { subDays, format } from 'date-fns';

// ----------------------------------------------------------------------------
// Expenses Management
// ----------------------------------------------------------------------------

export async function getExpenses() {
    // Fetch summary of daily ledgers and calculate total credits and debits for each day
    const [rows] = await pool.query(`
        SELECT 
            dl.date, 
            dl.opening_balance as opening, 
            dl.closing_balance as closing, 
            dl.status,
            (
                IFNULL((SELECT SUM(amount) FROM bank_receive WHERE date = dl.date), 0) +
                IFNULL((SELECT SUM(amount) FROM other_receive WHERE date = dl.date), 0)
            ) as credit,
            (
                IFNULL((SELECT SUM(amount) FROM truck_expense WHERE date = dl.date), 0) +
                IFNULL((SELECT SUM(amount) FROM labor_expense WHERE date = dl.date), 0) +
                IFNULL((SELECT SUM(amount) FROM transport_expense WHERE date = dl.date), 0) +
                IFNULL((SELECT SUM(amount) FROM diesel_expense WHERE date = dl.date), 0) +
                IFNULL((SELECT SUM(amount) FROM regular_expense WHERE date = dl.date), 0)
            ) as debit
        FROM 
            daily_ledger dl
        ORDER BY 
            dl.date DESC
    `);

    // Format the date objects to strings like 'YYYY-MM-DD'
    return rows.map(r => ({
        ...r,
        date: format(new Date(r.date), 'yyyy-MM-dd')
    }));
}

export async function getExpenseByDate(dateStr) {
    // Fetch the main ledger record
    const [ledgerRows] = await pool.query('SELECT * FROM daily_ledger WHERE date = ?', [dateStr]);
    if (ledgerRows.length === 0) return null;

    const ledger = ledgerRows[0];

    // Fetch all related tables
    const [[bankCredit], [othersCredit], [truckDebits], [laborDebits], [transportDebits], [dieselDebits], [regularDebits]] = await Promise.all([
        pool.query('SELECT * FROM bank_receive WHERE date = ?', [dateStr]),
        pool.query('SELECT * FROM other_receive WHERE date = ?', [dateStr]),
        pool.query('SELECT * FROM truck_expense WHERE date = ?', [dateStr]),
        pool.query('SELECT * FROM labor_expense WHERE date = ?', [dateStr]),
        pool.query('SELECT * FROM transport_expense WHERE date = ?', [dateStr]),
        pool.query('SELECT * FROM diesel_expense WHERE date = ?', [dateStr]),
        pool.query('SELECT * FROM regular_expense WHERE date = ?', [dateStr])
    ]);

    // Reconstruct the JSON shape expected by the frontend
    return {
        date: format(new Date(ledger.date), 'yyyy-MM-dd'),
        opening: ledger.opening_balance,
        closing: ledger.closing_balance,
        status: ledger.status,

        creditBank: bankCredit.length > 0 ? bankCredit[0].amount : 0,
        creditBankComment: bankCredit.length > 0 ? bankCredit[0].comment : '',

        creditOthers: othersCredit.length > 0 ? othersCredit[0].amount : 0,
        creditOthersComment: othersCredit.length > 0 ? othersCredit[0].comment : '',

        truckDebits: truckDebits.length > 0 ? truckDebits.map(t => ({ id: `truck-${t.id}`, truckNo: t.truck_no, amount: t.amount, comment: t.comment })) : [],
        laborDebits: laborDebits.length > 0 ? laborDebits.map(l => ({ id: `labor-${l.id}`, date: l.date, amount: l.amount, comment: l.comment })) : [],
        transportDebits: transportDebits.length > 0 ? transportDebits.map(t => ({ id: `transport-${t.id}`, amount: t.amount, comment: t.comment })) : [],
        dieselDebits: dieselDebits.length > 0 ? dieselDebits.map(d => ({ id: `diesel-${d.id}`, amount: d.amount, comment: d.comment })) : [],
        debits: regularDebits.length > 0 ? regularDebits.map(r => ({ id: r.id, details: r.details, amount: r.amount, comment: r.comment })) : []
    };
}

export async function saveExpense(expense) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const date = expense.date;

        // 1. Upsert Daily Ledger
        await connection.query(
            "INSERT INTO daily_ledger (date, opening_balance, closing_balance, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE opening_balance=?, closing_balance=?, status=?",
            [date, expense.opening || 0, expense.closing || 0, expense.status || 'pending',
                expense.opening || 0, expense.closing || 0, expense.status || 'pending']
        );

        // 2. Clear out existing entries for this date
        await connection.query('DELETE FROM bank_receive WHERE date = ?', [date]);
        await connection.query('DELETE FROM other_receive WHERE date = ?', [date]);
        await connection.query('DELETE FROM truck_expense WHERE date = ?', [date]);
        await connection.query('DELETE FROM labor_expense WHERE date = ?', [date]);
        await connection.query('DELETE FROM transport_expense WHERE date = ?', [date]);
        await connection.query('DELETE FROM diesel_expense WHERE date = ?', [date]);
        await connection.query('DELETE FROM regular_expense WHERE date = ?', [date]);

        // 3. Insert new items

        if (expense.creditBank !== undefined) {
            await connection.query(
                'INSERT INTO bank_receive (date, amount, comment) VALUES (?, ?, ?)',
                [date, expense.creditBank || 0, expense.creditBankComment || '']
            );
        }

        if (expense.creditOthers !== undefined) {
            await connection.query(
                'INSERT INTO other_receive (date, amount, comment) VALUES (?, ?, ?)',
                [date, expense.creditOthers || 0, expense.creditOthersComment || '']
            );
        }

        if (expense.truckDebits && expense.truckDebits.length > 0) {
            for (const item of expense.truckDebits) {
                if (item.amount > 0 || item.comment || item.truckNo) {
                    await connection.query(
                        'INSERT INTO truck_expense (date, truck_no, amount, comment) VALUES (?, ?, ?, ?)',
                        [date, item.truckNo || '', item.amount || 0, item.comment || '']
                    );
                }
            }
        }

        if (expense.laborDebits && expense.laborDebits.length > 0) {
            for (const item of expense.laborDebits) {
                if (item.amount > 0 || item.comment) {
                    await connection.query(
                        'INSERT INTO labor_expense (date, amount, comment) VALUES (?, ?, ?)',
                        [date, item.amount || 0, item.comment || '']
                    );
                }
            }
        }

        if (expense.transportDebits && expense.transportDebits.length > 0) {
            for (const item of expense.transportDebits) {
                if (item.amount > 0 || item.comment) {
                    await connection.query(
                        'INSERT INTO transport_expense (date, amount, comment) VALUES (?, ?, ?)',
                        [date, item.amount || 0, item.comment || '']
                    );
                }
            }
        }

        if (expense.dieselDebits && expense.dieselDebits.length > 0) {
            for (const item of expense.dieselDebits) {
                if (item.amount > 0 || item.comment) {
                    await connection.query(
                        'INSERT INTO diesel_expense (date, amount, comment) VALUES (?, ?, ?)',
                        [date, item.amount || 0, item.comment || '']
                    );
                }
            }
        }

        if (expense.debits && expense.debits.length > 0) {
            for (const item of expense.debits) {
                if (item.amount > 0 || item.comment || item.details) {
                    await connection.query(
                        'INSERT INTO regular_expense (date, details, amount, comment) VALUES (?, ?, ?, ?)',
                        [date, item.details || '', item.amount || 0, item.comment || '']
                    );
                }
            }
        }

        await connection.commit();
        return expense;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

export async function deleteExpense(dateStr) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('DELETE FROM bank_receive WHERE date = ?', [dateStr]);
        await connection.query('DELETE FROM other_receive WHERE date = ?', [dateStr]);
        await connection.query('DELETE FROM truck_expense WHERE date = ?', [dateStr]);
        await connection.query('DELETE FROM labor_expense WHERE date = ?', [dateStr]);
        await connection.query('DELETE FROM transport_expense WHERE date = ?', [dateStr]);
        await connection.query('DELETE FROM diesel_expense WHERE date = ?', [dateStr]);
        await connection.query('DELETE FROM regular_expense WHERE date = ?', [dateStr]);
        await connection.query('DELETE FROM daily_ledger WHERE date = ?', [dateStr]);

        await connection.commit();
        return true;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

export async function getOpeningBalanceForDate(dateStr) {
    // 1. First, check if there's an exact previous day
    const targetDate = new Date(dateStr);
    const prevDate = subDays(targetDate, 1);
    const prevDateStr = format(prevDate, 'yyyy-MM-dd');

    const [exactPrev] = await pool.query('SELECT closing_balance, date FROM daily_ledger WHERE date = ?', [prevDateStr]);

    if (exactPrev.length > 0) {
        return { amount: exactPrev[0].closing_balance, date: format(exactPrev[0].date, 'yyyy-MM-dd') };
    }

    // 2. If no exact previous day, get the most recent past record
    const [recentPast] = await pool.query(
        'SELECT closing_balance, date FROM daily_ledger WHERE date < ? ORDER BY date DESC LIMIT 1',
        [dateStr]
    );

    if (recentPast.length > 0) {
        return { amount: recentPast[0].closing_balance, date: format(recentPast[0].date, 'yyyy-MM-dd') };
    }

    return { amount: 0, date: null };
}

// ----------------------------------------------------------------------------
// User Management
// ----------------------------------------------------------------------------

export async function getUsers() {
    const [rows] = await pool.query('SELECT username, role, last_login as lastLogin FROM users');
    return rows;
}

export async function saveUser(user) {
    const { username, password, role, lastLogin } = user;

    // If we only have username/lastLogin (e.g. updating timestamp), don't wipe password
    if (!password && !role) {
        await pool.query(
            'UPDATE users SET last_login = ? WHERE username = ?',
            [lastLogin ? new Date(lastLogin) : null, username]
        );
    } else {
        // Full Insert/Update
        await pool.query(
            "INSERT INTO users (username, password, role, last_login) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE password=?, role=?, last_login=?",
            [username, password || '', role || 'employee', lastLogin ? new Date(lastLogin) : null,
                password || '', role || 'employee', lastLogin ? new Date(lastLogin) : null]
        );
    }

    return user;
}

export async function getUser(username) {
    const [rows] = await pool.query('SELECT username, password, role, last_login as lastLogin FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return null;
    return rows[0];
}
