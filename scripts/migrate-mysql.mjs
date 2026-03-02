import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

const DB_NAME = process.env.DB_NAME || 'awe_db';

// Extract database name from config to create DB first if needed
const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
};

async function migrate() {
    console.log('Starting MySQL migration...');

    try {
        // 1. Create Database if it doesn't exist
        const initConnection = await mysql.createConnection(poolConfig);
        await initConnection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
        await initConnection.end();

        console.log(`Database ${DB_NAME} ensured.`);

        // 2. Connect to the specified database
        const pool = mysql.createPool({
            ...poolConfig,
            database: DB_NAME
        });

        // 3. Create Tables
        const schema = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'employee') DEFAULT 'employee',
                last_login DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS daily_ledger (
                date DATE PRIMARY KEY,
                opening_balance DECIMAL(15, 2) DEFAULT 0.00,
                closing_balance DECIMAL(15, 2) DEFAULT 0.00,
                status ENUM('pending', 'locked') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS bank_receive (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                amount DECIMAL(15, 2) DEFAULT 0.00,
                comment TEXT,
                entry_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (date) REFERENCES daily_ledger(date)
            );

            CREATE TABLE IF NOT EXISTS other_receive (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                amount DECIMAL(15, 2) DEFAULT 0.00,
                comment TEXT,
                entry_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (date) REFERENCES daily_ledger(date)
            );

            CREATE TABLE IF NOT EXISTS truck_expense (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                truck_no VARCHAR(100),
                amount DECIMAL(15, 2) DEFAULT 0.00,
                comment TEXT,
                entry_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (date) REFERENCES daily_ledger(date)
            );

            CREATE TABLE IF NOT EXISTS labor_expense (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                amount DECIMAL(15, 2) DEFAULT 0.00,
                comment TEXT,
                entry_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (date) REFERENCES daily_ledger(date)
            );

            CREATE TABLE IF NOT EXISTS transport_expense (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                amount DECIMAL(15, 2) DEFAULT 0.00,
                comment TEXT,
                entry_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (date) REFERENCES daily_ledger(date)
            );

            CREATE TABLE IF NOT EXISTS diesel_expense (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                amount DECIMAL(15, 2) DEFAULT 0.00,
                comment TEXT,
                entry_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (date) REFERENCES daily_ledger(date)
            );

            CREATE TABLE IF NOT EXISTS regular_expense (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                details VARCHAR(255),
                amount DECIMAL(15, 2) DEFAULT 0.00,
                comment TEXT,
                entry_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (date) REFERENCES daily_ledger(date)
            );
        `;

        console.log('Creating tables...');
        await pool.query(schema);
        console.log('Tables created successfully.');


        // 4. Migrate Users Data
        const usersPath = path.join(rootDir, 'data', 'users.json');
        if (fs.existsSync(usersPath)) {
            const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
            console.log(`Migrating ${usersData.length} users...`);

            for (const user of usersData) {
                await pool.query(
                    `INSERT IGNORE INTO users (username, password, role, last_login) VALUES (?, ?, ?, ?)`,
                    [user.username, user.password, user.role, user.lastLogin]
                );
            }
        }

        // 5. Migrate Expenses Data
        const expensesPath = path.join(rootDir, 'data', 'expenses.json');
        if (fs.existsSync(expensesPath)) {
            const expensesData = JSON.parse(fs.readFileSync(expensesPath, 'utf-8'));
            console.log(`Migrating ${expensesData.length} expense records...`);

            for (const day of expensesData) {
                // Insert Daily Ledger
                await pool.query(
                    `INSERT IGNORE INTO daily_ledger (date, opening_balance, closing_balance, status) VALUES (?, ?, ?, ?)`,
                    [day.date, day.opening || 0, day.closing || 0, day.status || 'pending']
                );

                // Insert Bank Receive
                if (day.creditBank) {
                    await pool.query(
                        `INSERT INTO bank_receive (date, amount, comment) VALUES (?, ?, ?)`,
                        [day.date, day.creditBank, day.creditBankComment || '']
                    );
                }

                // Insert Other Receive
                if (day.creditOthers) {
                    await pool.query(
                        `INSERT INTO other_receive (date, amount, comment) VALUES (?, ?, ?)`,
                        [day.date, day.creditOthers, day.creditOthersComment || '']
                    );
                }

                // Insert Labor Debits
                if (day.laborDebits && day.laborDebits.length > 0) {
                    for (const labor of day.laborDebits) {
                        // Some existing data might have empty amounts or 0, filter if needed or just insert
                        if (labor.amount > 0 || labor.comment) {
                            await pool.query(
                                `INSERT INTO labor_expense (date, amount, comment) VALUES (?, ?, ?)`,
                                [day.date, labor.amount || 0, labor.comment || '']
                            );
                        }
                    }
                }

                // Insert Truck Debits
                if (day.truckDebits && day.truckDebits.length > 0) {
                    for (const truck of day.truckDebits) {
                        if (truck.amount > 0 || truck.comment || truck.truckNo) {
                            await pool.query(
                                `INSERT INTO truck_expense (date, truck_no, amount, comment) VALUES (?, ?, ?, ?)`,
                                [day.date, truck.truckNo || '', truck.amount || 0, truck.comment || '']
                            );
                        }
                    }
                }

                // Insert Transport Debits
                if (day.transportDebits && day.transportDebits.length > 0) {
                    for (const transport of day.transportDebits) {
                        if (transport.amount > 0 || transport.comment) {
                            await pool.query(
                                `INSERT INTO transport_expense (date, amount, comment) VALUES (?, ?, ?)`,
                                [day.date, transport.amount || 0, transport.comment || '']
                            );
                        }
                    }
                }

                // Insert Diesel Debits
                if (day.dieselDebits && day.dieselDebits.length > 0) {
                    for (const diesel of day.dieselDebits) {
                        if (diesel.amount > 0 || diesel.comment) {
                            await pool.query(
                                `INSERT INTO diesel_expense (date, amount, comment) VALUES (?, ?, ?)`,
                                [day.date, diesel.amount || 0, diesel.comment || '']
                            );
                        }
                    }
                }

                // Insert Regular Debits
                if (day.debits && day.debits.length > 0) {
                    for (const debit of day.debits) {
                        if (debit.amount > 0 || debit.comment || debit.details) {
                            await pool.query(
                                `INSERT INTO regular_expense (date, details, amount, comment) VALUES (?, ?, ?, ?)`,
                                [day.date, debit.details || '', debit.amount || 0, debit.comment || '']
                            );
                        }
                    }
                }
            }
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
