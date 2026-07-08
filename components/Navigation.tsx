"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
    { label: "Home", href: "/" },
    { label: "Objectbeheer", href: "/objecten" },
    { label: "Parameters & Sets", href: "/parameters" },
    { label: "Basistabellen", href: "/basistabellen" },
    { label: "Koppelingen", href: "/koppelingen" },
];

export default function Navigation() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    return (
        <nav className="bg-slate-900 text-white sticky top-0 z-50 shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo / Brand */}
                    <div className="shrink-0">
                        <Link href="/" className="font-mono text-xl font-bold tracking-wider text-blue-400">
                            DIKIS v3
                        </Link>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {/* Sla de actieve status check plat met een slimme conditie */}
                            {MENU_ITEMS.map((item) => {
                                // Als het item de homepagina is, check dan op een exacte match. 
                                // Anders check je of het pad begint met de href.
                                const isActive = item.href === "/"
                                    ? pathname === "/"
                                    : pathname.startsWith(item.href);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                                ? "bg-blue-600 text-white"
                                                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Hamburger Knop (Mobiel) */}
                    <div className="-mr-2 flex md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            type="button"
                            className="bg-slate-800 inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none"
                            aria-controls="mobile-menu"
                            aria-expanded="false"
                        >
                            <span className="sr-only">Menu openen</span>
                            {/* Hamburger icoon */}
                            <svg
                                className={`${isOpen ? "hidden" : "block"} h-6 w-6`}
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            {/* Kruis icoon bij open */}
                            <svg
                                className={`${isOpen ? "block" : "hidden"} h-6 w-6`}
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobiel Menu (Dropdown) */}
            <div className={`${isOpen ? "block" : "hidden"} md:hidden`} id="mobile-menu">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-slate-800">
                    {MENU_ITEMS.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsOpen(false)} // Sluit menu na klik
                                className={`block px-3 py-2 rounded-md text-base font-medium ${isActive
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                                    }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}