import pool from '../src/lib/mysql.js';

async function seedUsers() {
    try {
        console.log('Seeding default users into the database...');

        const defaultUsers = [
            { username: 'admin', password: 'admin123', role: 'admin' },
            { username: 'user', password: 'user123', role: 'employee' }
        ];

        for (const user of defaultUsers) {
            await pool.query(
                `INSERT IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
                [user.username, user.password, user.role]
            );
            console.log(`Added user: ${user.username} with role: ${user.role}`);
        }

        console.log('User seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('Failed to seed users:', error);
        process.exit(1);
    }
}

seedUsers();
