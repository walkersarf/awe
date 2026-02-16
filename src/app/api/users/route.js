import { NextResponse } from 'next/server';
import { getUsers, saveUser } from '@/lib/db';

export async function GET() {
    try {
        const users = getUsers();
        // Return users but maybe filter out admin password for security? 
        // Request says "show employee username, password", so we send all.
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const userData = await request.json();
        // Ideally we should validate, but trusting admin input for now
        const updatedUser = saveUser(userData);
        return NextResponse.json(updatedUser);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
