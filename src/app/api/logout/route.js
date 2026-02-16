import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });

    // Clear the auth cookie
    response.cookies.set({
        name: 'auth_session',
        value: '',
        httpOnly: true,
        expires: new Date(0),
        path: '/',
    });

    return response;
}
