"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Menu, X, ArrowRight } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#08090e]/85 backdrop-blur-xl border-b border-zinc-800/80 py-3 shadow-2xl shadow-black/40"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-40 blur transition duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                OmniMind
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Agent AI
                </span>
              </span>
              <span className="text-[10px] text-zinc-400 font-medium tracking-wide">
                GMAIL • WHATSAPP • TELEGRAM • OUTLOOK • DISCORD
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Fonctionnalités
            </Link>
            <Link
              href="#integrations"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Écosystème
            </Link>
            <Link
              href="#bento"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Bento Hub
            </Link>
            <Link
              href="#demo"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Simulateur
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Tarifs
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-indigo-300 hover:text-white transition-colors duration-200 flex items-center gap-1"
            >
              <span>Console</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Live</span>
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Agents Actifs 24/7</span>
            </div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Console
            </Link>
            <Link
              href="/dashboard"
              className="relative group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <span>Ouvrir la Console</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a0c14] border-b border-zinc-800/80 px-6 py-5 space-y-4 shadow-2xl">
          <nav className="flex flex-col space-y-3">
            <Link
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base text-zinc-300 hover:text-white py-1"
            >
              Fonctionnalités
            </Link>
            <Link
              href="#integrations"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base text-zinc-300 hover:text-white py-1"
            >
              Écosystème Connecté
            </Link>
            <Link
              href="#bento"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base text-zinc-300 hover:text-white py-1"
            >
              Bento Hub
            </Link>
            <Link
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base text-zinc-300 hover:text-white py-1"
            >
              Simulateur d&apos;Agent
            </Link>
            <Link
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base text-zinc-300 hover:text-white py-1"
            >
              Tarifs
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-indigo-400 hover:text-white py-1"
            >
              Console Agent
            </Link>
          </nav>

          <div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-200 hover:bg-zinc-800/60"
            >
              Console
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30"
            >
              Ouvrir la Console
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
