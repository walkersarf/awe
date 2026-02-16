import { NextResponse } from 'next/server';

export function middleware(request) {
    const path = request.nextUrl.pathname;

    // Define protected routes
    const isProtectedAdmin = path.startsWith('/admin');
    const isProtectedEmployee = path.startsWith('/employee');

    // Get auth cookie
    const authCookie = request.cookies.get('auth_session');

    // If trying to access protected routes without auth
    if ((isProtectedAdmin || isProtectedEmployee) && !authCookie) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // Check role-based access if cookie exists
    if (authCookie) {
        try {
            const user = JSON.parse(authCookie.value);

            // Admin trying to access employee? allowed based on earlier request flow (admin can edit employee view), 
            // but let's be strict if needed. Admin CAN access employee view for editing.
            // Employee trying to access admin? forbidden.

            if (isProtectedAdmin && user.role !== 'admin') {
                return NextResponse.redirect(new URL('/', request.url));
            }

            // Logged in user trying to access login page (root)?
            if (path === '/') {
                if (user.role === 'admin') return NextResponse.redirect(new URL('/admin', request.url));
                if (user.role === 'employee') return NextResponse.redirect(new URL('/employee', request.url));
            }

        } catch (e) {
            // Invalid cookie
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
