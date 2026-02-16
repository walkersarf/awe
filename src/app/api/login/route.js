import { NextResponse } from 'next/server';
import { getUser, saveUser } from '@/lib/db';

export async function POST(request) {
    try {
        const { username, password, type } = await request.json();

        const user = getUser(username);
        let isAuthenticated = false;

        if (user && user.password === password && user.role === type) {
            isAuthenticated = true;
        }

        if (isAuthenticated) {
            // Update last login
            saveUser({ ...user, lastLogin: new Date().toISOString() });

            const response = NextResponse.json({ success: true, role: user.role });

            // Set HttpOnly cookie
            response.cookies.set({
                name: 'auth_session',
                value: JSON.stringify({ role: user.role, username: user.username }),
                httpOnly: true,
                path: '/',
                maxAge: 60 * 60 * 24, // 1 day
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            });

            return response;
        }

        return NextResponse.json(
            { success: false, message: 'Invalid credentials' },
            { status: 401 }
        );
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { success: false, message: 'Server error' },
            { status: 500 }
        );
    }
}
