import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables manually if not in Next.js context
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Create a connection pool instead of a single connection to handle multiple requests
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'awe_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export default pool;
