import "./globals.css";

export const metadata = {
  title: "Al Wasi Enterprise",
  description: "Company Daily Expense Manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

